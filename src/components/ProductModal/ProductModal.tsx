import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Product } from '@/types';
import { formatPrice, storage, STORAGE_KEYS, trackStoreIapClick, PAYMENT_TYPES, navigateTo } from '@/utils';
import { ModalCloseIcon } from '../Icons/ModalCloseIcon';
import { ChevronUpIcon } from '../Icons/ChevronUpIcon';
import { PurchaseConfirmModal } from '../PurchaseConfirmModal';
// 暂时注释掉 Stripe 相关逻辑，因为目前都使用 h5_url 的支付方式
// import { StripeCheckout } from '../StripeCheckout';
import { AirwallexCheckout } from '../AirwallexCheckout/AirwallexCheckout';
import { LoginModal } from '../LoginModal';
import { useLanguage } from '@/hooks/useLanguage';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { useUser } from '@/hooks/useUser';
import { bmallOrderApi } from '@/utils/api';
import { messageStore } from '@/store/messageStore';
import addIcon from '@/assets/imgs/touka_buy_Item_Add.png';
import reduceIcon from '@/assets/imgs/touka_buy_Item_Reduce.png';
import shadowImg from '@/assets/imgs/touka_buy_Item_ic_shadow.png';
import productVoucherBg from '@/assets/imgs/product-voucher-bg.png';
import productPackBg from '@/assets/imgs/product-pack-bg.png';
import productDiamondBg from '@/assets/imgs/product-diamond-bg.png';
import styles from './ProductModal.module.less';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  preConfirmed?: boolean;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  onClose,
  onAddToCart,
  preConfirmed = false,
}) => {
  const { t, locale } = useLanguage();
  const { requireLogin, showLoginModal, setShowLoginModal } = useLoginGuard();
  const { user } = useUser();
  const { gameId } = useParams<{ gameId: string }>();
  const [quantity, setQuantity] = useState(1);
  const [showDetails, setShowDetails] = useState(false); // 默认收起，只显示价格信息
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // 暂时注释掉 Stripe 相关逻辑，因为目前都使用 h5_url 的支付方式
  // const [showStripeCheckout, setShowStripeCheckout] = useState(false);
  // const [stripeClientSecret, setStripeClientSecret] = useState<string | undefined>(undefined);
  const [currentOrderPaymentType, setCurrentOrderPaymentType] = useState<string | undefined>(undefined);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  // Airwallex 支付相关状态
  const [showAirwallexCheckout, setShowAirwallexCheckout] = useState(false);
  const [airwallexCheckoutParams, setAirwallexCheckoutParams] = useState<{
    intentId: string;
    clientSecret: string;
    currency: string;
    countryCode?: string;
    orderNo?: string;
  } | null>(null);

  // 当弹窗关闭或商品变化时，重置状态
  useEffect(() => {
    if (!product) {
      setQuantity(1);
      setShowDetails(false);
      setShowConfirmModal(false);
      // 暂时注释掉 Stripe 相关逻辑
      // setShowStripeCheckout(false);
      // setStripeClientSecret(undefined);
      setCurrentOrderPaymentType(undefined);
      setIsCreatingOrder(false);
    } else {
      // 当商品变化时，重置数量，并应用限购/库存上限
      const resetQuantity = () => {
        const stockLimit = product.stock ?? 999;
        const purchaseLimit = product.purchase_limit ?? 0;
        const purchaseUsed = product.purchase_used ?? 0;
        const remainingPurchaseLimit =
          purchaseLimit > 0 ? Math.max(purchaseLimit - purchaseUsed, 0) : undefined;
        const effectiveMax = Math.min(stockLimit, remainingPurchaseLimit ?? stockLimit);
        setQuantity(effectiveMax > 0 ? 1 : 0);
      };
      resetQuantity();
      setShowDetails(false);
    }
  }, [product]);

  if (!product) return null;

  const stockLimit = product.stock ?? 999;
  const purchaseLimit = product.purchase_limit ?? 0;
  const purchaseUsed = product.purchase_used ?? 0;
  const remainingPurchaseLimit =
    purchaseLimit > 0 ? Math.max(purchaseLimit - purchaseUsed, 0) : undefined;
  const effectiveMaxQuantity = Math.min(stockLimit, remainingPurchaseLimit ?? stockLimit);
  const noPurchasable = effectiveMaxQuantity <= 0;
  const isOutOfStock = product.stock === 0 || noPurchasable;
  const totalPrice = product.price * quantity;
  
  // 使用接口返回的商品图片
  const productImage = product.image;
  const isDiamond = product.categoryId === 'diamond';
  const isGiftPack = product.categoryId === 'giftPacks';
  
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDecrease = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleIncrease = () => {
    if (quantity < effectiveMaxQuantity) {
      setQuantity(quantity + 1);
    }
  };

  const handleConfirm = () => {
    requireLogin(() => {
      if (preConfirmed) {
        handleProceedToPayment();
        return;
      }
      // 检查是否需要显示确认弹窗
      const dontAskExpiry = localStorage.getItem('purchaseConfirmDontAsk');
      if (dontAskExpiry && new Date(dontAskExpiry) > new Date()) {
        // 在30天内，直接添加到购物车
        onAddToCart(product, quantity);
        onClose();
      } else {
        // 显示确认弹窗
        setShowConfirmModal(true);
      }
    });
  };

  const handlePurchaseConfirm = () => {
    onAddToCart(product, quantity);
    onClose();
  };

  // 根据游戏ID获取对应的 app_key
  const getAppKeyByGameId = (id: string | undefined): string | undefined => {
    if (!id) return undefined;
    // 游戏ID到app_key的映射（与Products页面保持一致）
    if (id === 'bam-bam-squad' || id === 'bam-bam-squad') {
      return 'f6594168ce3a9cc57ab7ed74426e25e1';
    } else if (id === 'oopsie' || id === 'oopsie-croco') {
      return '45a56d38bbdd60353438aa25d1ccff20';
    }
    return undefined;
  };

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

  const handleProceedToPayment = async () => {
    if (!product) return;

    // 获取必要的参数
    const appKey = getAppKeyByGameId(gameId) || storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
    if (!appKey) {
      messageStore.show('无法获取游戏配置，请刷新页面重试');
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
        platform = 'web'; // 默认值
      }
    }

    // 获取语言
    const language = getLanguageCode(locale);

    setIsCreatingOrder(true);
    try {
      // 调用创建订单接口
      const res = await bmallOrderApi.createOrder({
        appKey,
        platform,
        language,
        productId: product.id,
        quantity,
      });

      if (!res.success || !res.data) {
        const errorMessage = res.error || '创建订单失败';
        messageStore.show(errorMessage);
        console.error('创建订单失败:', errorMessage);
        return;
      }

      // 获取支付方式（从接口返回）
      const paymentType = res.data.payment_type;
      
      // 保存支付方式到 state（暂时注释 Stripe 相关说明，因为目前都使用 h5_url 的支付方式）
      // 用于支付失败事件上报
      setCurrentOrderPaymentType(paymentType);
      
      // 上报内购点击事件（使用接口返回的 payment_type）
      const environment = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
      await trackStoreIapClick(product, paymentType, environment);

      // 如果返回了 h5_url，等待事件上报完成后再跳转（通用 H5 支付页面）
      if (res.data.h5_url) {
        navigateTo(res.data.h5_url);
        return;
      }

      // 判断支付方式：优先检查 Airwallex 相关字段
      if (res.data.billing_checkout_url) {
        // 方式1: 后端已创建 Billing Checkout，直接使用 URL 跳转
        navigateTo(res.data.billing_checkout_url);
        return;
      } else if (res.data.intent_id && res.data.client_secret) {
        // 方式2: 后端返回 Airwallex Payment Intent 参数，使用 AirwallexCheckout 组件重定向
        setAirwallexCheckoutParams({
          intentId: res.data.intent_id,
          clientSecret: res.data.client_secret,
          currency: product.currency || 'USD',
          countryCode: user?.country,
          orderNo: res.data.order_no,
        });
        setShowAirwallexCheckout(true);
        return;
      }
      // 暂时注释掉 Stripe 支付方式，因为目前都使用 h5_url 的支付方式
      // // Stripe 支付方式（向后兼容）
      // else if (res.data.checkout_session_client_secret) {
      // // 优先使用 checkout_session_client_secret（用于 Embedded Checkout）
      //   setStripeClientSecret(res.data.checkout_session_client_secret);
      //   setShowStripeCheckout(true);
      // } else if (res.data.payment_intent_client_secret) {
      // // 如果没有 checkout_session_client_secret，尝试使用 payment_intent_client_secret（向后兼容）
      //   console.warn('使用 payment_intent_client_secret，建议后端改为返回 checkout_session_client_secret');
      //   setStripeClientSecret(res.data.payment_intent_client_secret);
      //   setShowStripeCheckout(true);
      // } else {
      //   messageStore.show('支付配置错误，请联系客服');
      //   console.error('创建订单成功但未返回支付信息:', res.data);
      // }
      
      // 如果没有匹配到任何支付方式，显示错误提示
      if (!res.data.h5_url && !res.data.billing_checkout_url && !res.data.intent_id) {
        messageStore.show('支付配置错误，请联系客服');
        console.error('创建订单成功但未返回支付信息:', res.data);
      }
    } catch (error) {
      console.error('创建订单异常:', error);
      messageStore.show('创建订单失败，请重试');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // 暂时注释掉 Stripe 相关逻辑，因为目前都使用 h5_url 的支付方式
  // const handleStripeCheckoutClose = () => {
  //   setShowStripeCheckout(false);
  //   setStripeClientSecret(undefined);
  //   setCurrentOrderPaymentType(undefined);
  // };

  const handleAirwallexCheckoutClose = () => {
    setShowAirwallexCheckout(false);
    setAirwallexCheckoutParams(null);
  };

  // 暂时注释掉 Stripe 相关逻辑，因为目前都使用 h5_url 的支付方式
  // // 计算金额（Stripe 需要以分为单位的整数）
  // const convertToStripeAmount = (price: number): number => {
  //   // 将价格转换为美分（Stripe 的最小单位）
  //   // 假设 1 虚拟货币单位 = 0.01 USD，所以 price * 100 = 美分数
  //   return Math.round(price * 100);
  // };

  // const stripeAmount = convertToStripeAmount(product.price * quantity);

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} aria-label="关闭">
          <ModalCloseIcon size={24} />
        </button>
        
        {/* 上部分：商品展示区域 - 棕色背景 + 背景图底板 */}
        <div className={styles.imageSection}>
          <div className={styles.productImage}>
            <div
              className={styles.productImageBg}
              style={{
                backgroundImage: `url(${getBackgroundImage()})`,
              }}
            ></div>
            <img src={productImage} alt={product.name} className={styles.productImageMain} />
            <img src={shadowImg} alt="shadow" className={styles.productImageShadow} />
          </div>
          {/* 商品名称 */}
          <div className={styles.productNameRow}>
            <span className={styles.productName}>{product.description || product.name}</span>
          </div>
          
          {/* 数量选择器 - 灰色横条 */}
          <div className={styles.quantityRow}>
                <div className={styles.quantitySelector}>
                  <button
                    className={styles.quantityButton}
                    onClick={handleDecrease}
                    disabled={quantity <= 1 || isOutOfStock}
                  >
                    <img src={reduceIcon} alt="减少" className={styles.quantityButtonIcon} />
                  </button>
                  <span className={styles.quantityValue}>{quantity}</span>
                  <button
                    className={styles.quantityButton}
                    onClick={handleIncrease}
                    disabled={quantity >= effectiveMaxQuantity || isOutOfStock}
                  >
                    <img src={addIcon} alt="增加" className={styles.quantityButtonIcon} />
                  </button>
              </div>
            </div>
        </div>

        {/* 下部分：购买详情区域 - 深棕色背景 */}
        <div className={styles.purchaseSection}>
          {/* 购买详情标题 - 可展开收起 */}
          <button
            className={styles.detailsToggle}
            onClick={() => setShowDetails(!showDetails)}
          >
            <span>{t('productModal.purchaseDetails')}</span>
            <ChevronUpIcon
              className={`${styles.detailsArrow} ${showDetails ? styles.arrowUp : styles.arrowDown}`}
              color="#000000"
            />
          </button>

          {/* 购买详情内容 - 可展开收起 */}
          <div className={`${styles.detailsContent} ${!showDetails ? styles.detailsCollapsed : ''}`}>
            {/* 价格信息 - 展开时显示单价和数量 */}
            {showDetails && (
              <div className={styles.priceInfo}>
                <div className={styles.priceRow}>
                  <span className={styles.priceLabel}>{t('productModal.unitPrice')}</span>
                  <span className={styles.priceValue}>{formatPrice(product.price, product.currency)}</span>
                </div>
                <div className={styles.priceRow}>
                  <span className={styles.priceLabel}>{t('productModal.quantity')}</span>
                  <span className={styles.priceValue}>{quantity}</span>
                </div>
              </div>
            )}
          </div>

          {/* 全部 - 始终显示 */}
          <div className={styles.totalSection}>
            <span className={styles.totalLabel}>{t('productModal.total')}</span>
            <span className={styles.totalPrice}>
              {formatPrice(totalPrice, product.currency)}
            </span>
          </div>

          {/* 确认按钮 */}
          <div className={styles.actions}>
            <button
              className={styles.confirmButton}
              disabled={isOutOfStock || isCreatingOrder}
              onClick={handleConfirm}
            >
              {isCreatingOrder ? t('common.loading') || '处理中...' : t('productModal.confirm')}
            </button>
          </div>
        </div>
      </div>

      {/* 购买确认弹窗 */}
      {!preConfirmed && (
        <PurchaseConfirmModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handlePurchaseConfirm}
          product={product}
          quantity={quantity}
          onProceedToPayment={handleProceedToPayment}
        />
      )}

      {/* 暂时注释掉 Stripe 支付弹窗，因为目前都使用 h5_url 的支付方式 */}
      {/* <StripeCheckout
        isOpen={showStripeCheckout}
        onClose={handleStripeCheckoutClose}
        productId={product.id}
        quantity={quantity}
        amount={stripeAmount}
        currency="usd"
        productName={product.name}
        product={product}
        clientSecret={stripeClientSecret}
        paymentType={currentOrderPaymentType}
      /> */}

      {/* Airwallex 支付组件 */}
      {showAirwallexCheckout && airwallexCheckoutParams && (
        <AirwallexCheckout
          intentId={airwallexCheckoutParams.intentId}
          clientSecret={airwallexCheckoutParams.clientSecret}
          currency={airwallexCheckoutParams.currency}
          countryCode={airwallexCheckoutParams.countryCode}
          orderNo={airwallexCheckoutParams.orderNo}
      />
      )}

      {/* 登录弹窗 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
};

