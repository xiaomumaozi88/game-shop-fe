import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useCart } from '@/hooks/useCart';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { useUser } from '@/hooks/useUser';
import { useGameRole } from '@/hooks/useGameRole';
import { useResponsive } from '@/hooks/useResponsive';
import { userStore } from '@/store/userStore';
import { gameRoleStore } from '@/store/gameRoleStore';
import { messageStore } from '@/store/messageStore';
import { ProductModal } from '@/components/ProductModal';
import { LoginModal } from '@/components/LoginModal';
import { PurchaseConfirmModal } from '@/components/PurchaseConfirmModal';
import { ServerSelectModal } from '@/components/ServerSelectModal';
import { PaymentSuccessModal } from '@/components/PaymentSuccessModal';
import { Loading } from '@/components/Loading';
import { Product } from '@/types';
import { gameApi, userDetailApi, productListApi, quickLoginApi, gameRoleApi, bmallOrderApi } from '@/utils/api';
import { formatCountdown, formatPrice, storage, STORAGE_KEYS, PAYMENT_TYPES } from '@/utils';
import { thinkingData } from '@/utils/thinkingData';
import { trackStoreSdkLoginOnce, trackStoreRoleSelect, trackStoreIapShow, trackStoreIapFail } from '@/utils/analytics';
import shoppingCartIcon from '@/assets/imgs/touka_commodity_ShoppingCart.png';
import timeIcon from '@/assets/imgs/time.png';
import styles from './Products.module.less';

// 商品类型
type ProductCategory = 'vouchers' | 'diamond' | 'giftPacks';

// 导入图片
import shadowImg from '@/assets/imgs/touka_buy_Item_ic_shadow.png';
import crocoBannerImg from '@/assets/imgs/croco_banner.png';
import banBamBannerImg from '@/assets/imgs/ban_bam_banner.jpg';
import toukaWebHomeBanner1 from '@/assets/imgs/touka_web_home_banner1.png';
import toukaWebHomeBanner2 from '@/assets/imgs/touka_web_home_banner2.png';
import productVoucherBg from '@/assets/imgs/product-voucher-bg.png';
import productPackBg from '@/assets/imgs/product-pack-bg.png';
import productDiamondBg from '@/assets/imgs/product-diamond-bg.png';

// 商品卡片包装组件，用于处理曝光追踪
interface ProductCardWrapperProps {
  product: Product;
  getBackgroundImage: () => string;
  onProductClick: (product: Product) => void;
  t: (key: string) => string;
  formatCountdown: (seconds: number) => string;
  formatPrice: (price: number, currency: string) => string;
}

const ProductCardWrapper: React.FC<ProductCardWrapperProps> = ({
  product,
  getBackgroundImage,
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

  return (
    <div 
      ref={cardRef}
      className={styles.productCard}
      onClick={() => onProductClick(product)}
    >
      <div className={styles.productImage}>
        <div
          className={styles.productImageBg}
          style={{
            backgroundImage: `url(${getBackgroundImage()})`,
          }}
        ></div>
        <img src={product.image} alt={product.name} className={styles.productImageMain} />
        <img src={shadowImg} alt="shadow" className={styles.productImageShadow} />
        {product.expire_time_left !== undefined && product.expire_time_left > 0 && (
          <div className={styles.countdown}>
            <img src={timeIcon} alt="time" className={styles.countdownIcon} />
            <div className={styles.countdownText}>
              {t('products.remainingShort')}:{formatCountdown(product.expire_time_left)}
            </div>
          </div>
        )}
        {product.purchase_limit !== undefined && product.purchase_limit > 0 && (
          <div className={`${styles.limitInfo} ${
            product.categoryId === 'giftPacks' ? styles.limitInfoGiftPack : styles.limitInfoDefault
          }`}>
            {
                `${t('products.limitShort')} ${product.purchase_used ?? 0}/${product.purchase_limit}`
            }
          </div>
        )}
      </div>
      <div className={styles.productInfo}>
        <div className={styles.productDescriptionWrapper}>
          <p className={styles.productDescription}>{product.description}</p>
        </div>
      </div>
      <button className={styles.productPriceButton}>{formatPrice(product.price, product.currency)}</button>
    </div>
  );
};

export const Products: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, locale } = useLanguage();
  const { addItem } = useCart();
  const { requireLogin, showLoginModal, setShowLoginModal } = useLoginGuard();
  const { user, clearGameSpecificFields, saveGameRoleSelection, getGameRoleSelection } = useUser();
  const { roles } = useGameRole(); // 获取全局角色列表状态
  const { isDesktop } = useResponsive();
  const [activeCategory, setActiveCategory] = useState<ProductCategory>('vouchers');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showAccountConfirm, setShowAccountConfirm] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showServerSelect, setShowServerSelect] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false); // 用户详情接口 loading 状态
  const [products, setProducts] = useState<Product[]>([]); // 从API获取的商品列表
  const [showVoucherGuide, setShowVoucherGuide] = useState(false); // 是否显示代金券使用引导
  const quickLoginTriggered = useRef<boolean>(false);
  
  // 记录每个游戏是否已经上报过登录事件（本次登录会话内）
  const loginTrackedGames = useRef<Set<string>>(new Set());

  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  
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
            console.log('🟢 Products 数数SDK初始化成功（从保存的配置）');
          }
        }
      }
      
      // 更新 ref 和 localStorage
      previousAppKeyRef.current = currentAppKey;
      storage.set(STORAGE_KEYS.CURRENT_GAME_APP_KEY, currentAppKey);
    }
  }, [gameId, clearGameSpecificFields, user, getGameRoleSelection]);

  // 注意：游戏角色列表现在从登录接口返回，不再需要单独请求

  // 根据游戏ID获取对应的banner图
  const getBannerImage = () => {
    // PC端使用新的banner图
    if (isDesktop) {
      if (gameId === 'bam-bam-squad') {
        return toukaWebHomeBanner1;
      } else if (gameId === 'oopsie-croco' || gameId === 'oopsie') {
        return toukaWebHomeBanner2;
      }
      // 默认返回第一个banner
      return toukaWebHomeBanner1;
    }
    
    // 移动端使用原有banner图
    if (gameId === 'bam-bam-squad') {
      return banBamBannerImg;
    } else if (gameId === 'oopsie-croco' || gameId === 'oopsie') {
      return crocoBannerImg;
    }
    // 默认返回第一个banner
    return crocoBannerImg;
  };

  const categories: { id: ProductCategory; label: string }[] = [
    { id: 'vouchers', label: t('products.vouchers') },
    { id: 'diamond', label: t('products.diamond') },
    { id: 'giftPacks', label: t('products.giftPacks') },
  ];

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
            console.error('获取游戏角色列表失败:', error);
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
        console.error('quick_sign 登录失败:', error);
        messageStore.show('快速登录失败');
        quickLoginTriggered.current = false;
      }
    };

    doQuickLogin();
  }, []);

  // 将语言代码转换为API需要的格式（如 zh-CN -> zh, en-US -> en）
  const getLanguageCode = (locale: string): string => {
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
    return langMap[locale] || locale.split('-')[0] || 'en';
  };

  // 解析多语言名称（兼容大小写），英文直接返回空以便回退到 name
  const parseMultiName = (multiNameStr: string, locale: string, fallbackName: string): string => {
    try {
      const multiNameRaw = JSON.parse(multiNameStr || '{}') || {};
      const multiName: Record<string, string> = {};
      // 统一键为小写，兼容大小写
      Object.keys(multiNameRaw || {}).forEach((k) => {
        multiName[k.toLowerCase()] = multiNameRaw[k];
      });

      const langCode = getLanguageCode(locale).toLowerCase();
      // 英文使用 name 字段，不取 multi_name
      if (langCode === 'en') {
        return '';
      }

      // 多语言键映射（兼容中文的 cn / zh，且区分简繁优先级）
      const langKeyMap: Record<string, string[]> = {
        // 简体优先 cn，其次 zh
        'zh-cn': ['cn', 'zh'],
        // 繁体优先 zh，其次 cn
        'zh-tw': ['zh', 'cn'],
        zh: ['zh', 'cn'],
        de: ['de'],
        es: ['es'],
        fr: ['fr'],
        ja: ['ja'],
        ko: ['ko'],
        pt: ['pt'],
        vi: ['vi'],
        ru: ['ru'],
      };

      const localeKey = locale.toLowerCase();
      const candidates =
        langKeyMap[localeKey] ||
        langKeyMap[langCode] ||
        [langCode];
      const found = candidates.find((code) => multiName[code]);
      if (found) return multiName[found];

      // 再尝试中文及英文兜底
      // 对于简体中文，优先使用 cn
      const localeLower = locale.toLowerCase();
      if (localeLower === 'zh-cn' && multiName['cn']) return multiName['cn'];
      if (multiName['zh']) return multiName['zh'];
      if (multiName['cn']) return multiName['cn'];
      if (multiName['en']) return multiName['en'];

      // 返回第一个可用值
      const firstKey = Object.keys(multiName)[0];
      return firstKey ? multiName[firstKey] : '';
    } catch (error) {
      console.error('解析多语言名称失败:', error);
      return '';
    }
  };

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

  // 将API返回的商品数据转换为Product类型
  const convertApiProductToProduct = (apiProduct: import('@/utils/api').ProductListItem, locale: string): Product => {
    const parsedName = apiProduct.multi_name 
      ? parseMultiName(apiProduct.multi_name, locale, apiProduct.name) 
      : '';
    const name = parsedName || apiProduct.name;
    
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
    };
  };

  const filteredProducts = products.filter((p) => p.categoryId === activeCategory);

  // 当切换分类时，如果不在代金券分类，则隐藏使用引导
  useEffect(() => {
    if (activeCategory !== 'vouchers') {
      setShowVoucherGuide(false);
    }
  }, [activeCategory]);

  const shouldSkipAccountConfirm = () => {
    const dontAskExpiry = localStorage.getItem('purchaseConfirmDontAsk');
    return !!dontAskExpiry && new Date(dontAskExpiry) > new Date();
  };

  const handleProductClick = (product: Product) => {
    requireLogin(() => {
      const currentUser = userStore.getUser();
      if (!currentUser?.gameServer) {
        setSelectedProduct(product);
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

  const handleServerConfirm = async (serverName: string, characterName: string, game_user_id: string) => {
    // characterName 实际上是 game_user_id
    const gameUserId = game_user_id || characterName;
    const appKey = getAppKeyByGameId(gameId) || storage.get(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
    if (!appKey) {
      setShowServerSelect(false);
      return;
    }
    
    if (!gameUserId) {
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

      // 如果之前选择了商品，继续购买流程
      if (selectedProduct) {
        if (shouldSkipAccountConfirm()) {
          setShowProductModal(true);
        } else {
          setShowAccountConfirm(true);
        }
      }
    } catch (error) {
      console.error('获取用户详情异常:', error);
      // 即使异常，也更新基本的区服信息
      const currentUser = userStore.getUser();
      if (currentUser) {
        userStore.setUser({
          ...currentUser,
          gameServer: serverName,
          characterName: gameUserId,
        });
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
        console.warn('无法获取 appKey，跳过订单状态检查');
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
        console.warn('查询订单详情失败，无法判断支付状态');
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

        // 解析多语言名称
        const parseMultiName = (multiNameStr: string | undefined, locale: string, fallbackName: string): string => {
          if (!multiNameStr) return fallbackName;
          try {
            const multiNameRaw = JSON.parse(multiNameStr || '{}') || {};
            const multiName: Record<string, string> = {};
            Object.keys(multiNameRaw || {}).forEach((k) => {
              multiName[k.toLowerCase()] = multiNameRaw[k];
            });
            const localeLower = locale.toLowerCase();
            const candidates = [
              localeLower,
              localeLower.split('-')[0],
              localeLower,
            ];
            const found = candidates.find((code) => multiName[code]);
            if (found) return multiName[found];
            if (localeLower === 'zh-cn' && multiName['cn']) return multiName['cn'];
            if (multiName['zh']) return multiName['zh'];
            if (multiName['cn']) return multiName['cn'];
            if (multiName['en']) return multiName['en'];
            const firstKey = Object.keys(multiName)[0];
            return firstKey ? multiName[firstKey] : fallbackName;
          } catch (error) {
            console.warn('解析 multi_name 失败:', error);
            return fallbackName;
          }
        };

        const productName = parseMultiName(orderData.multi_name, locale, orderData.product_name);
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
        const paymentType = orderData.payment_type;
        
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
        
        console.log('✅ Products: 已上报支付失败事件', { 
          orderNo: orderData.order_no, 
          payStatus: orderData.pay_status, 
          failReason,
          paymentType,
          productId: product.id 
        });
      }
    } catch (error) {
      console.error('❌ Products: 检查订单状态失败:', error);
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
        console.warn('无法获取 appKey，跳过支付失败检查');
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
        console.warn('查询订单详情失败，无法判断支付状态');
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

        // 解析多语言名称
        const parseMultiName = (multiNameStr: string | undefined, locale: string, fallbackName: string): string => {
          if (!multiNameStr) return fallbackName;
          try {
            const multiNameRaw = JSON.parse(multiNameStr || '{}') || {};
            const multiName: Record<string, string> = {};
            Object.keys(multiNameRaw || {}).forEach((k) => {
              multiName[k.toLowerCase()] = multiNameRaw[k];
            });
            const localeLower = locale.toLowerCase();
            const candidates = [
              localeLower,
              localeLower.split('-')[0],
              localeLower,
            ];
            const found = candidates.find((code) => multiName[code]);
            if (found) return multiName[found];
            if (localeLower === 'zh-cn' && multiName['cn']) return multiName['cn'];
            if (multiName['zh']) return multiName['zh'];
            if (multiName['cn']) return multiName['cn'];
            if (multiName['en']) return multiName['en'];
            const firstKey = Object.keys(multiName)[0];
            return firstKey ? multiName[firstKey] : fallbackName;
          } catch (error) {
            console.warn('解析 multi_name 失败:', error);
            return fallbackName;
          }
        };

        const productName = parseMultiName(orderData.multi_name, locale, orderData.product_name);
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
        const paymentType = orderData.payment_type;
        
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
        
        console.log('✅ Products: 已上报支付失败事件', { 
          orderNo: orderData.order_no, 
          payStatus: orderData.pay_status, 
          failReason,
          paymentType,
          productId: product.id 
        });
      }
    } catch (error) {
      console.error('❌ Products: 检查订单状态并上报支付失败事件失败:', error);
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
  };

  // 获取商品列表
  useEffect(() => {
    const loadProducts = async () => {
      const appKey = getAppKeyByGameId(gameId);
      if (!appKey) {
        console.warn('无法获取appKey');
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
          const convertedProducts = res.data.map((item) => 
            convertApiProductToProduct(item, locale)
          );
          setProducts(convertedProducts);
        } else {
          console.error('获取商品列表失败:', res.error);
          setProducts([]);
        }
      } catch (error) {
        console.error('获取商品列表异常:', error);
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProducts();
  }, [gameId, user?.platform, locale]); // 当游戏ID、平台或语言变化时重新加载

  return (
    <div className={styles.products}>
      {/* 用户详情接口 loading 蒙层 */}
      {loadingUserDetail && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner}></div>
        </div>
      )}
      {/* 促销横幅 */}
      <div className={styles.bannerSection}>
        <img src={getBannerImage()} alt="Product Banner" className={styles.bannerImage} />
      </div>

      <div className={styles.productsContent}>
      {/* 商品按钮 */}
      <div className={styles.productsButton}>
        <button className={styles.productsBtn}>
          <img src={shoppingCartIcon} alt="购物车" className={styles.cartIcon} />
          <span>{t('products.products')}</span>
        </button>
      </div>

      {/* 分类标签 */}
      <div className={styles.tabs}>
        {categories.map((category) => (
          <button
            key={category.id}
            className={`${styles.tab} ${activeCategory === category.id ? styles.tabActive : ''}`}
            onClick={() => setActiveCategory(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* 商品网格或使用引导 */}
      {showVoucherGuide && activeCategory === 'vouchers' ? (
        <div className={styles.voucherGuide}>
          <h2 className={styles.voucherGuideTitle}>{t('products.voucherGuide.title')}</h2>
          <div className={styles.voucherGuideStep}>
            <p className={styles.voucherGuideText}>{t('products.voucherGuide.step1')}</p>
            <div className={styles.voucherGuideImage}>
              {/* 步骤1截图占位符 - 需要替换为实际图片 */}
              <div className={styles.voucherGuideImagePlaceholder}>
                {/* TODO: 添加步骤1的游戏内截图 */}
              </div>
            </div>
          </div>
          <div className={styles.voucherGuideStep}>
            <p className={styles.voucherGuideText}>{t('products.voucherGuide.step2')}</p>
            <div className={styles.voucherGuideImage}>
              {/* 步骤2截图占位符 - 需要替换为实际图片 */}
              <div className={styles.voucherGuideImagePlaceholder}>
                {/* TODO: 添加步骤2的游戏内截图 */}
              </div>
            </div>
          </div>
          <button 
            className={styles.voucherGuideBackButton}
            onClick={() => setShowVoucherGuide(false)}
          >
            {t('products.voucherGuide.backToProducts')}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.productGrid}>
        {loadingProducts ? (
          <div className={styles.tableLoading}>
            <Loading size="small" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className={styles.tableLoading}>{t('common.noData')}</div>
        ) : (
          filteredProducts.map((product) => {
            // 所有商品类型使用统一的卡片样式
            // 根据商品类型获取对应的背景图
            const getBackgroundImage = () => {
              switch (product.categoryId) {
                case 'vouchers':
                  return productVoucherBg;
                case 'giftPacks':
                  return productPackBg;
                case 'diamond':
                  return productDiamondBg;
                default:
                  return productVoucherBg;
              }
            };

              return (
              <ProductCardWrapper 
                  key={product.id}
                  product={product}
                getBackgroundImage={getBackgroundImage}
                onProductClick={handleProductClick}
                t={t}
                formatCountdown={formatCountdown}
                formatPrice={formatPrice}
              />
            );
          })
                )}
                </div>
          {/* 如何使用代金券按钮 - 仅在代金券分类时显示 */}
          {activeCategory === 'vouchers' && !loadingProducts && filteredProducts.length > 0 && (
            <button 
              className={styles.howToUseVouchersButton}
              onClick={() => setShowVoucherGuide(true)}
            >
              {t('products.howToUseVouchers')}
            </button>
          )}
        </>
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

      {/* 区服选择弹窗：未选择区服时先提示选择 */}
      <ServerSelectModal
        isOpen={showServerSelect}
        onClose={() => setShowServerSelect(false)}
        onConfirm={handleServerConfirm}
        appKey={getAppKeyByGameId(gameId)}
      />

      {/* 支付成功弹窗 */}
      {paymentParams && (
        <PaymentSuccessModal
          isOpen={showPaymentSuccess}
          onClose={handlePaymentSuccessClose}
          sessionId={paymentParams.sessionId}
          orderNo={paymentParams.orderNo}
          productName={paymentParams.productName}
          quantity={paymentParams.quantity}
          price={paymentParams.price}
          totalAmount={paymentParams.totalAmount}
        />
      )}
    </div>
  );
};

