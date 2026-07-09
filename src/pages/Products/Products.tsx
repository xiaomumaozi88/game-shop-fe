import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useCart } from '@/hooks/useCart';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { useUser } from '@/hooks/useUser';
import { useGameRole } from '@/hooks/useGameRole';
import { useResponsive } from '@/hooks/useResponsive';
import { userStore } from '@/store/userStore';
import { gameRoleStore } from '@/store/gameRoleStore';
import { messageStore } from '@/store/messageStore';
import { productsUserPanelStore } from '@/store/productsUserPanelStore';
import { ProductModal } from '@/components/ProductModal';
import { LoginModal } from '@/components/LoginModal';
import { PurchaseConfirmModal } from '@/components/PurchaseConfirmModal';
import { ServerSelectModal } from '@/components/ServerSelectModal';
import { PaymentSuccessModal, PaymentSuccessCelebration } from '@/components/PaymentSuccessModal';
import { Loading } from '@/components/Loading';
import { Product } from '@/types';
import { gameApi, userDetailApi, productListApi, quickLoginApi, gameRoleApi, bmallOrderApi } from '@/utils/api';
import {
  formatCountdown,
  formatPrice,
  storage,
  STORAGE_KEYS,
  resolveAnalyticsPaymentType,
  buildNoRoleHomeState,
  refreshGameStoreRoles,
  isProductPurchaseDisabled,
} from '@/utils';
import { logoutUser } from '@/utils/auth';
import { thinkingData } from '@/utils/thinkingData';
import { trackStoreSdkLoginOnce, trackStoreRoleSelect, trackStoreIapShow, trackStoreIapFail } from '@/utils/analytics';
import {
  parseProductMultiName,
  resolveOrderProductFallbackName,
} from '@/utils/productMultiName';
import { parseGiftPackSmallImages } from '@/utils/parseGiftPackSmallImages';
import { parseGiftPackPurchaseLimitType } from '@/utils/giftPackPurchaseLimitType';
import { ProductCountdown } from './components/ProductCountdown';
import { ProductsPageBackground } from './components/ProductsPageBackground';
import { GiftPackProductCard } from './components/GiftPackProductCard';
import {
  ProductsCatalogSections,
  getCategorySectionId,
  type ProductCategory,
} from './components/ProductsCatalogSections';
import { scrollToCategorySection, isCategoryScrollSpyPaused } from './utils/scrollToCategorySection';
import { VoucherProductCard } from './components/VoucherProductCard';
import { CategoryNavBrandText } from './components/CategoryNavBrandText';
import { LogoutModal } from '@/components/LogoutModal';
import { ProductsUserPanel } from './components/ProductsUserPanel';
import styles from './Products.module.less';

// 导入图片
import productDiamondCardBg from '@/assets/img2/pay_item_diamond_bg.png';
import toukaCoinGuideArrowIcon from '@/assets/img2/touka-coin-guide-arrow.png';

// 商品卡片包装组件，用于处理曝光追踪
interface ProductCardWrapperProps {
  product: Product;
  onProductClick: (product: Product) => void;
  t: (key: string) => string;
  formatCountdown: (seconds: number) => string;
  formatPrice: (price: number, currency: string) => string;
}

const ProductCardWrapper: React.FC<ProductCardWrapperProps> = ({
  product,
  onProductClick,
  t,
  formatCountdown,
  formatPrice,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const hasTracked = useRef(false);

  // 使用 IntersectionObserver 监听商品卡片曝光
  useEffect(() => {
    if (!cardRef.current || hasTracked.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTracked.current) {
            // 商品按钮曝光，上报事件
            trackStoreIapShow(product);
            hasTracked.current = true;
            observer.disconnect();
          }
        });
      },
      {
        threshold: 0.5, // 当50%可见时触发
        rootMargin: '0px',
      }
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
    };
  }, [product]);

  if (product.categoryId === 'giftPacks') {
    return (
      <GiftPackProductCard
        cardRef={cardRef}
        product={product}
        onProductClick={onProductClick}
        t={t}
        formatCountdown={formatCountdown}
        formatPrice={formatPrice}
      />
    );
  }

  if (product.categoryId === 'vouchers') {
    return (
      <VoucherProductCard
        cardRef={cardRef}
        product={product}
        onProductClick={onProductClick}
        t={t}
        formatCountdown={formatCountdown}
        formatPrice={formatPrice}
      />
    );
  }

  const isDiamondCard = product.categoryId === 'diamond';
  const isUnavailable = isProductPurchaseDisabled(product);
  const displayLabel = product.name || product.description;

  return (
    <div 
      ref={cardRef}
      className={`${styles.productCard} ${isDiamondCard ? styles.productCardDiamond : ''}${
        isUnavailable ? ` ${styles.productCardUnavailable}` : ''
      }`}
      style={
        isDiamondCard
          ? {
              backgroundImage: `url(${productDiamondCardBg})`,
            }
          : undefined
      }
      onClick={() => onProductClick(product)}
    >
      <img
        src={product.image}
        alt={product.name}
        className={styles.productImageMain}
        loading="lazy"
        decoding="async"
      />
      {product.expire_time_left !== undefined && product.expire_time_left > 0 && (
        <ProductCountdown
          text={`${t('products.remainingShort')}:${formatCountdown(product.expire_time_left)}`}
        />
      )}
      {product.purchase_limit !== undefined && product.purchase_limit > 0 && (
        <div
          className={`${styles.limitInfo} ${
            product.categoryId === 'giftPacks' ? styles.limitInfoGiftPack : styles.limitInfoDefault
          }`}
        >
          {`${t('products.limitShort')} ${product.purchase_used ?? 0}/${product.purchase_limit}`}
        </div>
      )}
      <div className={styles.productInfo}>
        <div className={styles.productDescriptionWrapper}>
          <p className={styles.productDescription}>{displayLabel}</p>
        </div>
      </div>
      <button className={styles.productPriceButton}>{formatPrice(product.price, product.currency)}</button>
    </div>
  );
};

interface ToukaCoinGuideViewProps {
  t: (key: string) => string;
  onBack: () => void;
}

const ToukaCoinGuideBackButton: React.FC<{ label: string; onClick: () => void }> = ({
  label,
  onClick,
}) => (
  <button
    type="button"
    className={`${styles.toukaCoinGuideEntry} ${styles.toukaCoinGuideBackButton}`}
    onClick={onClick}
  >
    <span className={styles.toukaCoinGuideEntryBgMiddle} aria-hidden />
    <span className={styles.toukaCoinGuideEntryContent}>
      <span className={styles.toukaCoinGuideEntryLabel}>
        <span className={styles.toukaCoinGuideEntryText}>{label}</span>
      </span>
      <img src={toukaCoinGuideArrowIcon} alt="" className={styles.toukaCoinGuideEntryArrow} />
    </span>
  </button>
);

const ToukaCoinGuideView: React.FC<ToukaCoinGuideViewProps> = ({ t, onBack }) => (
  <section className={styles.toukaCoinGuidePage} aria-labelledby="touka-coin-guide-title">
    <h1 id="touka-coin-guide-title" className={styles.toukaCoinGuideTitle}>
      {t('products.voucherGuide.title')}
    </h1>

    <div className={styles.toukaCoinGuideSteps}>
      <article className={styles.toukaCoinGuideStep}>
        <p className={styles.toukaCoinGuideStepText}>{t('products.voucherGuide.step1')}</p>
        <div
          className={`${styles.toukaCoinGuideImageSlot} ${styles.toukaCoinGuideImageSlotMail}`}
          aria-hidden
        />
      </article>

      <article className={styles.toukaCoinGuideStep}>
        <p className={styles.toukaCoinGuideStepText}>{t('products.voucherGuide.step2')}</p>
        <div
          className={`${styles.toukaCoinGuideImageSlot} ${styles.toukaCoinGuideImageSlotStore}`}
          aria-hidden
        />
      </article>
    </div>

    <ToukaCoinGuideBackButton
      label={t('products.voucherGuide.backToProducts')}
      onClick={onBack}
    />
  </section>
);

export const Products: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, locale } = useLanguage();
  const { addItem } = useCart();
  const { requireLogin, showLoginModal, setShowLoginModal } = useLoginGuard();
  const { user, clearGameSpecificFields, saveGameRoleSelection, getGameRoleSelection } = useUser();
  const { loading: rolesLoading, hasRolesForAppKey, roles } = useGameRole();
  const { isMobile, isTablet, isTouchLandscape } = useResponsive();

  useEffect(() => {
    productsUserPanelStore.show();
  }, []);

  // 进入商品页时拉取最新角色，避免本地缓存误判可进入
  useEffect(() => {
    if (!user?.token) return;
    refreshGameStoreRoles();
  }, [user?.token, gameId]);

  // 商品页需有效登录态；无该游戏角色时与首页点击游戏一致，回首页并提示
  useEffect(() => {
    if (!user?.token) {
      navigate('/', { replace: true });
      return;
    }
    if (rolesLoading) return;

    const appKey = getAppKeyByGameId(gameId);
    if (appKey && !hasRolesForAppKey(appKey)) {
      navigate('/', {
        replace: true,
        state: buildNoRoleHomeState(gameId ?? ''),
      });
    }
  }, [user?.token, gameId, rolesLoading, roles, navigate, hasRolesForAppKey]);
  const [activeCategory, setActiveCategory] = useState<ProductCategory>('diamond');
  const [showToukaCoinGuide, setShowToukaCoinGuide] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showAccountConfirm, setShowAccountConfirm] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showServerSelect, setShowServerSelect] = useState(false);
  const serverSelectForProductRef = useRef(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false); // 用户详情接口 loading 状态
  const [products, setProducts] = useState<Product[]>([]); // 从API获取的商品列表
  const [productsRefreshToken, setProductsRefreshToken] = useState(0);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const productsPageBodyRef = useRef<HTMLDivElement>(null);

  const handleLogout = async (): Promise<boolean> => {
    if (logoutLoading) return false;

    setLogoutLoading(true);
    try {
      const result = await logoutUser();
      if (!result.success) {
        messageStore.show(result.error || t('logout.failed'));
        return false;
      }

      navigate('/', { replace: true });
      return true;
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleLogoutClick = () => {
    if (logoutLoading) return;
    const dontRemind = localStorage.getItem('logout_dont_remind') === 'true';
    if (dontRemind) {
      void handleLogout();
      return;
    }
    setLogoutModalOpen(true);
  };

  useEffect(() => {
    setShowToukaCoinGuide(false);
  }, [gameId]);

  useEffect(() => {
    if (showToukaCoinGuide) {
      productsUserPanelStore.hide();
      return () => {
        productsUserPanelStore.show();
      };
    }

    productsUserPanelStore.show();
    return undefined;
  }, [showToukaCoinGuide]);

  useEffect(() => {
    const shouldAutoHidePanel = isMobile || isTablet || isTouchLandscape;
    if (!shouldAutoHidePanel || showToukaCoinGuide) return undefined;

    const hidePanelOnScroll = () => {
      productsUserPanelStore.hide();
    };

    window.addEventListener('scroll', hidePanelOnScroll, { passive: true, capture: true });
    window.addEventListener('wheel', hidePanelOnScroll, { passive: true });
    window.addEventListener('touchmove', hidePanelOnScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', hidePanelOnScroll, { capture: true });
      window.removeEventListener('wheel', hidePanelOnScroll);
      window.removeEventListener('touchmove', hidePanelOnScroll);
    };
  }, [isMobile, isTablet, isTouchLandscape, showToukaCoinGuide]);

  const scrollToProductsBodyTop = () => {
    window.requestAnimationFrame(() => {
      const top = productsPageBodyRef.current
        ? productsPageBodyRef.current.getBoundingClientRect().top + window.scrollY - 16
        : 0;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    });
  };

  const scrollToPageTop = () => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handleShowToukaCoinGuide = () => {
    setShowToukaCoinGuide(true);
    scrollToPageTop();
  };

  const handleBackToProducts = () => {
    setShowToukaCoinGuide(false);
    scrollToProductsBodyTop();
  };

  const quickLoginTriggered = useRef<boolean>(false);
  
  // 记录每个游戏是否已经上报过登录事件（本次登录会话内）
  const loginTrackedGames = useRef<Set<string>>(new Set());

  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [showPaymentCelebration, setShowPaymentCelebration] = useState(false);
  
  // 保存支付参数，避免 URL 参数被清除后丢失
  const [paymentParams, setPaymentParams] = useState<{
    sessionId: string | null;
    orderNo: string | null;
    productName: string | null;
    quantity: string | null;
    price: string | null;
    totalAmount: string | null;
  } | null>(null);
  
  // 使用 ref 确保只在组件挂载时读取一次 URL 参数
  const paymentParamsReadRef = useRef(false);
  // 使用 ref 确保支付失败事件只上报一次
  const paymentFailTrackedRef = useRef(false);

  // 根据游戏ID获取对应的 app_key
  const getAppKeyByGameId = (id: string | undefined): string | undefined => {
    if (!id) return undefined;
    // 游戏ID到app_key的映射（与Home页面保持一致）
    if (id === 'bam-bam-squad' || id === 'bam-bam-squad') {
      return 'f6594168ce3a9cc57ab7ed74426e25e1';
    } else if (id === 'oopsie' || id === 'oopsie-croco') {
      return '45a56d38bbdd60353438aa25d1ccff20';
    }
    return undefined;
  };

  // 获取所有游戏的 app_key（用于请求角色列表）
  const getAllAppKeys = (): string[] => {
    return [
      'f6594168ce3a9cc57ab7ed74426e25e1', // Bam! Bam Squad
      '45a56d38bbdd60353438aa25d1ccff20', // Oopsie Croco
    ];
  };

  // 使用 ref 跟踪之前的 appKey，用于检测游戏切换
  const previousAppKeyRef = useRef<string | undefined>(undefined);

  // 保存当前游戏的 appKey 到 localStorage，并在切换游戏时清除游戏特定字段
  useEffect(() => {
    const currentAppKey = getAppKeyByGameId(gameId);
    if (currentAppKey) {
      // 初始化 ref（仅在第一次）
      if (previousAppKeyRef.current === undefined) {
        const storedAppKey = storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
        previousAppKeyRef.current = storedAppKey ?? undefined;
      }
      
      const previousAppKey = previousAppKeyRef.current;
      // 如果游戏切换了（appKey 变化），清除游戏特定的用户字段并加载新游戏的选择
      if (previousAppKey && previousAppKey !== currentAppKey) {
        clearGameSpecificFields(previousAppKey, currentAppKey);
      }

      // 如果页面刷新后或切换游戏后，尝试从保存的配置中初始化数数SDK
      if (user && user.token) {
        const selection = getGameRoleSelection(currentAppKey);
        if (selection?.ss_app_id && selection?.ss_url) {
          const initSuccess = thinkingData.initForGame(currentAppKey, {
            appId: selection.ss_app_id,
            serverUrl: selection.ss_url,
          });
      
          if (initSuccess) {
            thinkingData.setCurrentGame(currentAppKey);
            if (user.sdkId) {
              thinkingData.login(user.sdkId);
              // 设置用户属性
              thinkingData.userSet({
                username: user.username || user.gameAccount || '',
                gameAccount: user.gameAccount || '',
                nickName: user.username || '',
                gameUserId: user.characterName || '',
                gameServerChannel: user.gameServer || '',
                platform: user.platform || '',
              });
      }
            // console.log('🟢 Products 数数SDK初始化成功（从保存的配置）');
          }
        }
      }
      
      // 更新 ref 和 localStorage
      previousAppKeyRef.current = currentAppKey;
      storage.set(STORAGE_KEYS.CURRENT_GAME_APP_KEY, currentAppKey);
    }
  }, [gameId, clearGameSpecificFields, user, getGameRoleSelection]);

  // 注意：游戏角色列表现在从登录接口返回，不再需要单独请求

  const categories: { id: ProductCategory; label: string }[] = [
    { id: 'diamond', label: t('products.diamond') },
    { id: 'giftPacks', label: t('products.giftPacks') },
    { id: 'vouchers', label: t('products.toukaCoin') },
  ];

  // 仅展示有数据的分类 tab（无数据则不显示该 tab）
  const visibleCategories = useMemo(
    () => categories.filter((c) => products.some((p) => p.categoryId === c.id)),
    [products, categories]
  );

  const productsByCategory = useMemo(() => {
    const result: Record<ProductCategory, Product[]> = {
      diamond: [],
      giftPacks: [],
      vouchers: [],
    };
    for (const product of products) {
      const list = result[product.categoryId];
      if (list) list.push(product);
    }
    return result;
  }, [products]);

  const handleCategoryTabClick = (categoryId: ProductCategory) => {
    setActiveCategory(categoryId);
    scrollToCategorySection(categoryId);
  };

  // 滚动时根据当前可见分区高亮 Tab
  useEffect(() => {
    if (loadingProducts || visibleCategories.length === 0) return;

    const sections = visibleCategories
      .map((c) => document.getElementById(getCategorySectionId(c.id)))
      .filter((el): el is HTMLElement => el != null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isCategoryScrollSpyPaused()) return;

        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        const topSection = visible[0]?.target;
        if (!topSection) return;

        const categoryId = topSection.getAttribute('data-category-section') as ProductCategory | null;
        if (categoryId) {
          setActiveCategory((prev) => (prev === categoryId ? prev : categoryId));
        }
      },
      {
        root: null,
        rootMargin: '-88px 0px -58% 0px',
        threshold: [0, 0.05, 0.15],
      }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [loadingProducts, visibleCategories]);

  // 处理 quick_sign 快速登录：仅执行一次（只做轻量校验 + 调用后端校验）
  useEffect(() => {
    const doQuickLogin = async () => {
      if (quickLoginTriggered.current) return;
      const params = new URLSearchParams(window.location.search);
      const quickSign = params.get('quick_sign');
      if (!quickSign) return;

      quickLoginTriggered.current = true;

      try {
        // 基础校验：长度 + hex 形式，避免明显垃圾流量
        const cleanSign = quickSign.trim();
        if (
          cleanSign.length < 64 ||
          cleanSign.length > 1024 ||
          !/^[0-9a-fA-F]+$/.test(cleanSign)
        ) {
          messageStore.show('快速登录参数不正确');
          quickLoginTriggered.current = false;
          return;
        }

        // 获取所有游戏的 app_key 列表
        const appKeys = getAllAppKeys();
        const res = await quickLoginApi.quickLogin(quickSign, appKeys);
        if (res.success && res.data?.token) {
          // 保存角色列表到 gameRoleStore（如果快速登录接口返回了角色列表）
          if (res.data.items && res.data.items.length > 0) {
            gameRoleStore.setRoles(res.data.items);
          }

          const prev = userStore.getUser();
          userStore.setUser({
            ...(prev || {}),
            // 具体账号信息以后端 quick-login + user-detail 返回为准
            token: res.data.token,
            email: res.data.email || prev?.email, // 保存登录邮箱
            quickLogin: true,
          } as any);

          // 快速登录后，再次请求 gameRoleApi 以确保获取完整的角色列表
            try {
            const roleRes = await gameRoleApi.getGameServerRoleList(appKeys);
              if (roleRes.success && roleRes.data) {
                gameRoleStore.setRoles(roleRes.data);
            }
          } catch (error) {
            // console.error('获取游戏角色列表失败:', error);
            // 即使失败也不影响快速登录，因为快速登录接口可能已经返回了角色列表
          }

          messageStore.show('快速登录成功');

          // 使用过 quick_sign 后，从 URL 中移除该参数，避免重复使用
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.delete('quick_sign');
          window.history.replaceState(null, '', currentUrl.toString());
        } else {
          messageStore.show(res.error || '快速登录失败');
          quickLoginTriggered.current = false;
        }
      } catch (error) {
        // console.error('quick_sign 登录失败:', error);
        messageStore.show('快速登录失败');
        quickLoginTriggered.current = false;
      }
    };

    doQuickLogin();
  }, []);

  // 根据position映射到categoryId
  const mapPositionToCategoryId = (position: string): ProductCategory => {
    const positionMap: Record<string, ProductCategory> = {
      'coupon': 'vouchers',
      'voucher': 'vouchers',
      'luxury': 'diamond',
      'diamond': 'diamond',
      'gift': 'giftPacks',
      'giftpack': 'giftPacks',
    };
    return positionMap[position.toLowerCase()] || 'vouchers';
  };

  // 将 locale 转为商品列表等接口所需的 language 参数（如 zh-CN -> zh）
  const getLanguageCode = (loc: string): string => {
    const langMap: Record<string, string> = {
      'zh-CN': 'zh',
      'zh-TW': 'zh',
      'en-US': 'en',
      'ja-JP': 'ja',
      'ko-KR': 'ko',
      'ru-RU': 'ru',
      'vi-VN': 'vi',
      'de-DE': 'de',
      'pt-PT': 'pt',
      'es-ES': 'es',
      'fr-FR': 'fr',
    };
    return langMap[loc] || loc.split('-')[0] || 'en';
  };

  const isApiProductVisible = (apiProduct: import('@/utils/api').ProductListItem): boolean => {
    const expireTimeLeft = apiProduct.expire_time_left;
    return expireTimeLeft === undefined || expireTimeLeft === -1 || expireTimeLeft > 0;
  };

  // 将API返回的商品数据转换为Product类型
  const convertApiProductToProduct = (apiProduct: import('@/utils/api').ProductListItem, locale: string): Product => {
    const name = apiProduct.multi_name
      ? parseProductMultiName(apiProduct.multi_name, locale, apiProduct.name)
      : apiProduct.name;
    
    const categoryId = apiProduct.position 
      ? mapPositionToCategoryId(apiProduct.position)
      : 'vouchers';
    
    // 根据categoryId设置category显示名称
    const categoryMap: Record<ProductCategory, string> = {
      vouchers: t('products.vouchers'),
      diamond: t('products.diamond'),
      giftPacks: t('products.giftPacks'),
    };
    
    return {
      id: apiProduct.id,
      name: name,
      description: name, // 使用名称作为描述
      price: parseFloat(apiProduct.price) || 0,
      image: apiProduct.image || '',
      category: categoryMap[categoryId] || '',
      categoryId: categoryId,
      stock: 999, // API没有返回库存，使用默认值
      currency: apiProduct.currency || 'USD',
      expire_time_left: apiProduct.expire_time_left !== undefined && apiProduct.expire_time_left !== -1 
        ? apiProduct.expire_time_left 
        : undefined,
      purchase_limit: apiProduct.purchase_limit || 0,
      purchase_used: apiProduct.purchase_used || 0,
      position: apiProduct.position,
      iap: apiProduct.iap,
      iap_id: apiProduct.iap_id,
      value_ratio: apiProduct.value_ratio ?? 0,
      gem_count: apiProduct.gem_count ?? 0,
      small_images: parseGiftPackSmallImages(apiProduct.small_images),
      purchase_limit_type: parseGiftPackPurchaseLimitType(apiProduct.purchase_limit_type),
      is_gray: apiProduct.is_gray ?? 0,
    };
  };

  // 当某分类无数据被隐藏后，若当前选中的正是该分类，则自动切换到第一个有数据的分类
  useEffect(() => {
    if (loadingProducts || visibleCategories.length === 0) return;
    const isActiveVisible = visibleCategories.some((c) => c.id === activeCategory);
    if (!isActiveVisible) {
      setActiveCategory(visibleCategories[0].id);
    }
  }, [loadingProducts, products, activeCategory, visibleCategories]);

  const shouldSkipAccountConfirm = () => {
    const dontAskExpiry = localStorage.getItem('purchaseConfirmDontAsk');
    return !!dontAskExpiry && new Date(dontAskExpiry) > new Date();
  };

  const handleProductClick = (product: Product) => {
    requireLogin(() => {
      const currentUser = userStore.getUser();
      if (!currentUser?.gameServer || !currentUser?.characterName || !currentUser?.platform) {
        setSelectedProduct(product);
        serverSelectForProductRef.current = true;
        setShowServerSelect(true);
        return;
      }
      setSelectedProduct(product);
      if (shouldSkipAccountConfirm()) {
        setShowProductModal(true);
      } else {
        setShowAccountConfirm(true);
      }
    });
  };

  const handleCloseModal = () => {
    setSelectedProduct(null);
    setShowProductModal(false);
  };

  const handleCloseServerSelect = () => {
    if (serverSelectForProductRef.current) {
      setSelectedProduct(null);
      setShowAccountConfirm(false);
      setShowProductModal(false);
    }
    setShowServerSelect(false);
    serverSelectForProductRef.current = false;
  };

  // 商品列表刷新后同步弹窗内商品（更新限购次数 / 置灰状态）
  useEffect(() => {
    if (!selectedProduct) return;
    const updated = products.find((p) => p.id === selectedProduct.id);
    if (updated) {
      setSelectedProduct(updated);
    }
  }, [products, selectedProduct?.id]);

  const handleServerConfirm = async (serverName: string, characterName: string, game_user_id: string) => {
    // characterName 实际上是 game_user_id
    const shouldStopProductFlowAfterRoleSelect = serverSelectForProductRef.current;
    serverSelectForProductRef.current = false;
    const resetPendingProductFlow = () => {
      if (!shouldStopProductFlowAfterRoleSelect) return;
      setSelectedProduct(null);
      setShowAccountConfirm(false);
      setShowProductModal(false);
      setProductsRefreshToken((n) => n + 1);
    };
    const gameUserId = game_user_id || characterName;
    const appKey = getAppKeyByGameId(gameId) || storage.get(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
    const previousCharacterId = userStore.getUser()?.characterName;
    const characterChanged = !!gameUserId && gameUserId !== previousCharacterId;
    if (!appKey) {
      resetPendingProductFlow();
      setShowServerSelect(false);
      return;
    }
    
    if (!gameUserId) {
      resetPendingProductFlow();
      setShowServerSelect(false);
      return;
    }

    // 立即关闭区服选择弹窗
    setShowServerSelect(false);
    // 开始 loading
    setLoadingUserDetail(true);


    try {

      // 调用用户详情接口
      const res = await userDetailApi.getUserDetail(appKey, gameUserId);
      
      if (!res.success || !res.data) {
        // 即使失败，也更新基本的区服信息
        const currentUser = userStore.getUser();
        if (currentUser) {
          userStore.setUser({
            ...currentUser,
            gameServer: serverName,
            characterName: gameUserId, // 存储 game_user_id
          });
        }
        resetPendingProductFlow();
        setShowServerSelect(false);
        return;
      }

      const userDetail = res.data;
      const currentUser = userStore.getUser();
      // 更新用户信息
      if (currentUser) {
        userStore.setUser({
          ...currentUser,
          gameServer: userDetail.game_server_channel, // 使用接口返回的区服ID
          characterName: userDetail.game_user_id, // 存储 game_user_id
          avatar: userDetail.user_avatar, // 更新用户头像
          sdkId: userDetail.sdk_id, // 存储 sdk_id（用于数数上报的account_id）
          country: userDetail.country, // 存储国家代码（用于数数上报的#country_code）
          ip: userDetail.ip, // 存储IP地址（用于数数上报的#ip）
          platform: userDetail.platform, // 存储平台（用于数数上报的#os）
            quickLogin: userDetail.quick_login === true, // 标记是否游戏内直链快速登录
        });
      }

      // 使用返回的数数配置初始化数数SDK
      if (userDetail.ss_app_id && userDetail.ss_url && appKey) {
        const initSuccess = thinkingData.initForGame(appKey, {
          appId: userDetail.ss_app_id,
          serverUrl: userDetail.ss_url,
        });
        if (initSuccess) {
          // 设置当前游戏
          thinkingData.setCurrentGame(appKey);
          
          // 设置账号ID（使用 sdk_id）
          if (userDetail.sdk_id) {
            thinkingData.login(userDetail.sdk_id);
            
            // 设置用户属性
            thinkingData.userSet({
              username: currentUser?.username || currentUser?.gameAccount || '',
              gameAccount: currentUser?.gameAccount || '',
              nickName: userDetail.nick_name,
              gameUserId: userDetail.game_user_id,
              gameServerChannel: userDetail.game_server_channel,
              platform: userDetail.platform,
            });
          }

          // 上报登录事件：按 appKey+token 维度仅上报一次
          trackStoreSdkLoginOnce(appKey, userDetail.sdk_id, user?.token);

          // 上报角色选择事件（确保数数配置已初始化后）
          const serverChannelNum = parseInt(userDetail.game_server_channel) || 0;
          trackStoreRoleSelect(serverChannelNum, userDetail.game_user_id);
        }
        
        // 保存当前游戏的角色选择信息和数数配置
        if (appKey) {
          saveGameRoleSelection(appKey, {
            ss_app_id: userDetail.ss_app_id,
            ss_url: userDetail.ss_url,
          });
        }
      }

      if (shouldStopProductFlowAfterRoleSelect) {
        resetPendingProductFlow();
        return;
      }

      // 如果之前选择了商品，继续购买流程
      if (selectedProduct) {
        if (shouldSkipAccountConfirm()) {
          setShowProductModal(true);
        } else {
          setShowAccountConfirm(true);
        }
      }
    } catch (error) {
      // console.error('获取用户详情异常:', error);
      // 即使异常，也更新基本的区服信息
      const currentUser = userStore.getUser();
      if (currentUser) {
        userStore.setUser({
          ...currentUser,
          gameServer: serverName,
          characterName: gameUserId,
        });
      }
      
      if (shouldStopProductFlowAfterRoleSelect) {
        resetPendingProductFlow();
        return;
      }

      // 如果之前选择了商品，继续购买流程
      if (selectedProduct) {
        if (shouldSkipAccountConfirm()) {
          setShowProductModal(true);
        } else {
          setShowAccountConfirm(true);
        }
      }
    } finally {
      // 无论成功或失败，都关闭 loading
      setLoadingUserDetail(false);
      if (characterChanged) {
        setProductsRefreshToken((n) => n + 1);
      }
    }
  };

  const handleAddToCart = (product: Product, quantity: number) => {
    requireLogin(() => {
      addItem(product, quantity);
    });
  };

  // 读取支付参数并检查订单状态（仅在组件挂载时执行一次）
  useEffect(() => {
    // 只在组件挂载时读取一次，避免重复读取
    if (paymentParamsReadRef.current) return;
    
    const sessionId = searchParams.get('session_id');
    const orderNo = searchParams.get('order_no');
    const type = searchParams.get('type'); // SUCCESS_URL 或 FAIL_URL
    const productName = searchParams.get('productName');
    const quantity = searchParams.get('quantity');
    const price = searchParams.get('price');
    const totalAmount = searchParams.get('totalAmount');
    // 支付失败相关参数
    const failReason = searchParams.get('fail_reason') || searchParams.get('error_code') || searchParams.get('error_message');
    const paymentFailed = searchParams.get('payment_failed') === 'true' || searchParams.get('status') === 'failed' || type === 'FAIL_URL';
    
    // 标记为已读取，避免重复执行
    paymentParamsReadRef.current = true;
    
    // 如果有支付相关参数，保存到 state
    if (sessionId || orderNo || productName || quantity || price || totalAmount) {
      // 先保存参数到 state
      setPaymentParams({
        sessionId,
        orderNo,
        productName,
        quantity,
        price,
        totalAmount,
      });
    }
    
    // 如果只有 order_no 且没有 session_id，需要检查订单状态
    // 这种情况通常是跳转到外部支付页面后返回的情况
    if (orderNo && !sessionId && user?.token) {
      // 如果是支付成功返回（type=SUCCESS_URL），检查订单状态并可能显示成功弹窗
      // 如果是支付失败返回（type=FAIL_URL 或 paymentFailed），检查订单状态并上报失败事件
      checkOrderStatusAndShowModal(orderNo, type === 'SUCCESS_URL', failReason || undefined, paymentFailed);
    }
    
    // 无条件清除所有 URL 参数
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]); // 当 user?.token 变化时重新执行（用于处理延迟登录的情况）
  
  // 检查订单状态并显示支付成功/失败弹窗
  const checkOrderStatusAndShowModal = async (
    orderNo: string,
    isSuccessUrl: boolean,
    failReasonFromUrl?: string,
    isFailedFromUrl?: boolean
  ) => {
    try {
      const appKey = getAppKeyByGameId(gameId) || storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
      if (!appKey) {
        // console.warn('无法获取 appKey，跳过订单状态检查');
        return;
      }

      // 获取语言
      const getLanguageCode = (locale: string): string => {
        const langMap: Record<string, string> = {
          'zh-CN': 'zh',
          'zh-TW': 'zh',
          'en-US': 'en',
          'vi-VN': 'vi',
          'ru-RU': 'ru',
          'pt-PT': 'pt',
          'ja-JP': 'ja',
          'ko-KR': 'ko',
          'de-DE': 'de',
          'fr-FR': 'fr',
          'es-ES': 'es',
        };
        return langMap[locale] || locale.split('-')[0] || 'en';
      };

      const language = getLanguageCode(locale);

      // 查询订单详情
      const result = await bmallOrderApi.queryOrder({
        appKey,
        language,
        orderNo,
      });

      if (!result.success || !result.data) {
        // console.warn('查询订单详情失败，无法判断支付状态');
        return;
      }

      const orderData = result.data;
      
      // 检查支付状态：pay_status 为 1 表示支付成功，0 或其他表示支付失败或未支付
      const isPaymentSuccess = orderData.pay_status === 1 || !!orderData.pay_success_time;
      
      // 如果是支付成功 URL 且订单状态为成功，显示支付成功弹窗
      if (isSuccessUrl && isPaymentSuccess) {
        // 更新 paymentParams，确保有 orderNo
        setPaymentParams(prev => ({
          sessionId: prev?.sessionId || null,
          orderNo: orderNo || null,
          productName: prev?.productName || null,
          quantity: prev?.quantity || null,
          price: prev?.price || null,
          totalAmount: prev?.totalAmount || null,
        }));
        return; // 支付成功，显示弹窗，不需要上报失败事件
      }
      
      // 如果支付失败或从 URL 参数判断为失败，上报失败事件
      if (!isPaymentSuccess || isFailedFromUrl) {
        // 确保不会重复上报
        if (paymentFailTrackedRef.current) return;
        
        // 从订单详情接口返回的数据构建 Product 对象
        const mapPositionToCategoryId = (position?: string): string => {
          if (!position) return 'vouchers';
          const positionLower = position.toLowerCase();
          if (positionLower === 'coupon') return 'vouchers';
          if (positionLower === 'luxury' || positionLower === 'diamond') return 'diamond';
          if (positionLower === 'gift') return 'giftPacks';
          return 'vouchers';
        };

        const productName = parseProductMultiName(
          orderData.multi_name,
          locale,
          resolveOrderProductFallbackName(orderData)
        );
        const categoryId = mapPositionToCategoryId(orderData.product_position);
        
        // 构建 Product 对象
        const product: Product = {
          id: orderData.product_id,
          name: productName,
          description: productName,
          price: orderData.unit_price,
          image: orderData.product_image || '',
          category: categoryId === 'vouchers' ? '代金券' : categoryId === 'diamond' ? '钻石' : '礼包',
          categoryId,
          stock: 0,
          currency: orderData.currency || 'USD',
          iap: orderData.iap,
          iap_id: orderData.iap_id,
          position: orderData.product_position,
        };

        const environment = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
        
        // 获取支付方式：从订单详情接口返回中获取
        const paymentType = resolveAnalyticsPaymentType(orderData.payment_type);

        // 确定失败原因
        let failReason = failReasonFromUrl;
        if (!failReason) {
          // 根据支付状态推断失败原因
          if (orderData.pay_status === 0) {
            failReason = 'Payment not completed or cancelled';
          } else if (orderData.order_status === 'closed') {
            failReason = 'Order closed';
          } else {
            failReason = 'Payment failed - unknown reason';
          }
        }

        trackStoreIapFail(product, paymentType, environment, failReason);
        paymentFailTrackedRef.current = true;

        // console.log('✅ Products: 已上报支付失败事件', {
          // orderNo: orderData.order_no,
          // payStatus: orderData.pay_status,
          // failReason,
          // paymentType,
          // productId: product.id,
        // });
      }
    } catch (error) {
      // console.error('❌ Products: 检查订单状态失败:', error);
    }
  };
  
  // 检查订单状态并上报支付失败事件
  const checkOrderStatusAndReportFailure = async (
    orderNo: string,
    failReasonFromUrl?: string,
    isFailedFromUrl?: boolean
  ) => {
    if (paymentFailTrackedRef.current) return; // 已经上报过，不再重复
    
    try {
      const appKey = getAppKeyByGameId(gameId) || storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
      if (!appKey) {
        // console.warn('无法获取 appKey，跳过支付失败检查');
        return;
      }

      // 获取语言
      const getLanguageCode = (locale: string): string => {
        const langMap: Record<string, string> = {
          'zh-CN': 'zh',
          'zh-TW': 'zh',
          'en-US': 'en',
          'vi-VN': 'vi',
          'ru-RU': 'ru',
          'pt-PT': 'pt',
          'ja-JP': 'ja',
          'ko-KR': 'ko',
          'de-DE': 'de',
          'fr-FR': 'fr',
          'es-ES': 'es',
        };
        return langMap[locale] || locale.split('-')[0] || 'en';
      };

      const language = getLanguageCode(locale);

      // 查询订单详情
      const result = await bmallOrderApi.queryOrder({
        appKey,
        language,
        orderNo,
      });

      if (!result.success || !result.data) {
        // console.warn('查询订单详情失败，无法判断支付状态');
        return;
      }

      const orderData = result.data;
      
      // 检查支付状态：pay_status 为 1 表示支付成功，0 或其他表示支付失败或未支付
      const isPaymentSuccess = orderData.pay_status === 1 || !!orderData.pay_success_time;
      
      // 如果支付失败或从 URL 参数判断为失败，上报失败事件
      if (!isPaymentSuccess || isFailedFromUrl) {
        // 从订单详情接口返回的数据构建 Product 对象
        const mapPositionToCategoryId = (position?: string): string => {
          if (!position) return 'vouchers';
          const positionLower = position.toLowerCase();
          if (positionLower === 'coupon') return 'vouchers';
          if (positionLower === 'luxury' || positionLower === 'diamond') return 'diamond';
          if (positionLower === 'gift') return 'giftPacks';
          return 'vouchers';
        };

        const productName = parseProductMultiName(
          orderData.multi_name,
          locale,
          resolveOrderProductFallbackName(orderData)
        );
        const categoryId = mapPositionToCategoryId(orderData.product_position);
        
        // 构建 Product 对象
        const product: Product = {
          id: orderData.product_id,
          name: productName,
          description: productName,
          price: orderData.unit_price,
          image: orderData.product_image || '',
          category: categoryId === 'vouchers' ? '代金券' : categoryId === 'diamond' ? '钻石' : '礼包',
          categoryId,
          stock: 0,
          currency: orderData.currency || 'USD',
          iap: orderData.iap,
          iap_id: orderData.iap_id,
          position: orderData.product_position,
        };

        const environment = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';

        const paymentType = resolveAnalyticsPaymentType(orderData.payment_type);

        // 确定失败原因
        let failReason = failReasonFromUrl;
        if (!failReason) {
          // 根据支付状态推断失败原因
          if (orderData.pay_status === 0) {
            failReason = 'Payment not completed or cancelled';
          } else if (orderData.order_status === 'closed') {
            failReason = 'Order closed';
          } else {
            failReason = 'Payment failed - unknown reason';
          }
        }

        trackStoreIapFail(product, paymentType, environment, failReason);
        paymentFailTrackedRef.current = true;

        // console.log('✅ Products: 已上报支付失败事件', {
          // orderNo: orderData.order_no,
          // payStatus: orderData.pay_status,
          // failReason,
          // paymentType,
          // productId: product.id,
        // });
      }
    } catch (error) {
      // console.error('❌ Products: 检查订单状态并上报支付失败事件失败:', error);
    }
  };
  
  // 根据 state 中的参数判断是否显示支付成功弹窗
  useEffect(() => {
    if (paymentParams) {
      const hasPaymentParams = paymentParams.sessionId || 
                               paymentParams.orderNo || 
                               paymentParams.productName || 
                               paymentParams.quantity || 
                               paymentParams.price || 
                               paymentParams.totalAmount;
    if (hasPaymentParams) {
      setShowPaymentSuccess(true);
      }
    }
  }, [paymentParams]);

  const handlePaymentSuccessClose = () => {
    setShowPaymentSuccess(false);
    setProductsRefreshToken((n) => n + 1);
  };

  const handlePaymentSuccessConfirm = () => {
    setShowPaymentSuccess(false);
    setShowPaymentCelebration(true);
  };

  const handlePaymentCelebrationClose = () => {
    setShowPaymentCelebration(false);
    setProductsRefreshToken((n) => n + 1);
  };

  useEffect(() => {
    if (!showPaymentCelebration) return;

    const timer = window.setTimeout(handlePaymentCelebrationClose, 3000);
    return () => window.clearTimeout(timer);
  }, [showPaymentCelebration]);

  // 获取商品列表
  useEffect(() => {
    const loadProducts = async () => {
      const appKey = getAppKeyByGameId(gameId);
      if (!appKey) {
        // console.warn('无法获取appKey');
        setProducts([]);
        setLoadingProducts(false);
        return;
      }

      // 获取platform，优先使用user.platform，否则检测浏览器平台
      let platform = user?.platform || '';
      if (!platform) {
        const userAgent = navigator.userAgent.toLowerCase();
        if (/iphone|ipad|ipod/.test(userAgent)) {
          platform = 'ios';
        } else if (/android/.test(userAgent)) {
          platform = 'android';
        } else {
          platform = 'ios';
        }
      }

      // 获取语言
      const language = getLanguageCode(locale);

      setLoadingProducts(true);

      try {
        const res = await productListApi.getProductList(appKey, platform, language);
        
        if (res.success && res.data) {
          const convertedProducts = res.data
            .filter(isApiProductVisible)
            .map((item) => convertApiProductToProduct(item, locale));
          setProducts(convertedProducts);
        } else {
          // console.error('获取商品列表失败:', res.error);
          setProducts([]);
        }
      } catch (error) {
        // console.error('获取商品列表异常:', error);
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProducts();
  }, [gameId, user?.platform, locale, productsRefreshToken]); // 购买成功 / 更换角色后刷新

  return (
    <div className={styles.products}>
      <ProductsPageBackground />

      {loadingUserDetail && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner} />
        </div>
      )}

      <div className={styles.productsTopSpacer} aria-hidden>
        {!loadingProducts && !showToukaCoinGuide && (
          <ProductsUserPanel
            gameId={gameId}
            onSwitchServer={() => {
              requireLogin(() => {
                serverSelectForProductRef.current = false;
                setShowServerSelect(true);
              });
            }}
            onLogout={handleLogoutClick}
          />
        )}
      </div>

      <div ref={productsPageBodyRef} className={styles.productsPageBody}>
        {showToukaCoinGuide ? (
          <ToukaCoinGuideView t={t} onBack={handleBackToProducts} />
        ) : (
          <div className={styles.productsMainColumn}>
            {visibleCategories.length > 0 && (
              <div className={styles.categoryNav}>
                <div className={styles.categoryNavInner}>
                  <div className={styles.categoryNavInnerBg} aria-hidden>
                    <span className={styles.categoryNavInnerBgLeft} />
                    <span className={styles.categoryNavInnerBgMiddle} />
                    <span className={styles.categoryNavInnerBgRight} />
                  </div>
                  <div className={styles.categoryNavBrand} aria-hidden>
                    <CategoryNavBrandText text={t('products.products')} locale={locale} />
                  </div>
                  <div className={styles.categoryNavTabs}>
                    {visibleCategories.map((category, tabIndex) => {
                      const isActive = activeCategory === category.id;
                      const useTraditionalChineseTabFont = locale === 'zh-TW' && category.id === 'vouchers';
                      return (
                        <button
                          key={category.id}
                          type="button"
                          className={`${styles.categoryTab} ${isActive ? styles.categoryTabActive : ''} ${
                            useTraditionalChineseTabFont ? styles.categoryTabTraditionalChinese : ''
                          }`}
                          style={
                            {
                              '--tab-slot': tabIndex + 1,
                              '--tab-total': visibleCategories.length,
                            } as React.CSSProperties
                          }
                          onClick={() => handleCategoryTabClick(category.id)}
                        >
                          <span>{category.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className={styles.productsCatalog}>
              <ProductsCatalogSections
                visibleCategories={visibleCategories}
                productsByCategory={productsByCategory}
                loading={loadingProducts}
                t={t}
                onToukaCoinGuideClick={handleShowToukaCoinGuide}
                renderProduct={(product) => (
                  <ProductCardWrapper
                    key={product.id}
                    product={product}
                    onProductClick={handleProductClick}
                    t={t}
                    formatCountdown={formatCountdown}
                    formatPrice={formatPrice}
                  />
                )}
              />
            </div>
          </div>
        )}
      </div>

      {/* 商品详情弹窗 */}
      <ProductModal
        product={showProductModal ? selectedProduct : null}
        onClose={handleCloseModal}
        onAddToCart={handleAddToCart}
        preConfirmed
      />

      {/* 账户确认弹窗（先于商品详情） */}
      <PurchaseConfirmModal
        isOpen={showAccountConfirm}
        onClose={() => setShowAccountConfirm(false)}
        onConfirm={() => {}}
        onProceedToPayment={() => {
          setShowAccountConfirm(false);
          setShowProductModal(true);
        }}
        product={selectedProduct}
        quantity={1}
      />

      {/* 登录弹窗 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />

      <LogoutModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />

      {/* 区服选择弹窗：未选择区服时先提示选择 */}
      <ServerSelectModal
        isOpen={showServerSelect}
        onClose={handleCloseServerSelect}
        onConfirm={handleServerConfirm}
        appKey={getAppKeyByGameId(gameId)}
      />

      {/* 支付成功弹窗 */}
      {paymentParams && (
        <PaymentSuccessModal
          isOpen={showPaymentSuccess}
          onClose={handlePaymentSuccessClose}
          onConfirm={handlePaymentSuccessConfirm}
          sessionId={paymentParams.sessionId}
          orderNo={paymentParams.orderNo}
          productName={paymentParams.productName}
          quantity={paymentParams.quantity}
          price={paymentParams.price}
          totalAmount={paymentParams.totalAmount}
        />
      )}

      <PaymentSuccessCelebration
        isOpen={showPaymentCelebration}
        onClose={handlePaymentCelebrationClose}
      />
    </div>
  );
};
