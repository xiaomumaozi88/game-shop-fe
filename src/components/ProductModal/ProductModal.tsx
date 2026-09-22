import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product } from '@/types';
import {
  formatPrice,
  storage,
  STORAGE_KEYS,
  trackStoreIapClick,
  navigateTo,
  isAirwallexOrderPaymentData,
  resolveAirwallexPaymentType,
  isProductPurchaseDisabled,
  getProductMaxPurchasableQuantity,
  isProductQuantityOverPurchaseLimit,
  resolveAnalyticsEnvironment,
} from '@/utils';
import { useFitText } from '@/hooks/useFitText';
import { useResponsive } from '@/hooks/useResponsive';
import { ChevronUpIcon } from '../Icons/ChevronUpIcon';
import { PurchaseConfirmModal } from '../PurchaseConfirmModal';
// 暂时注释掉 Stripe 相关逻辑，因为目前都使用 h5_url 的支付方式
// import { StripeCheckout } from '../StripeCheckout';
import { AirwallexCheckout } from '../AirwallexCheckout/AirwallexCheckout';
import { LoginModal } from '../LoginModal';
import { useLanguage } from '@/hooks/useLanguage';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { useUser } from '@/hooks/useUser';
import { bmallOrderApi } from '@/utils/api';
import { getErrorMessage } from '@/utils/errorHandler';
import { SinglePurchaseQuantityLimitReached } from '@/utils/bizCodes';
import { messageStore } from '@/store/messageStore';
import loginModalClose from '@/assets/img2/login_modal_close.png';
import buyWindowImg from '@/assets/img2/product-bg-close.png';
import buyWindowExpandedImg from '@/assets/img2/product-bg-open.png';
import buyItemBgImg from '@/assets/img2/pay_com_buy_itembg1.png';
import purchaseDetailBgImg from '@/assets/img2/purchase-detail-bg.png';
import buyItemNameImg from '@/assets/img2/pay_com_buy_itemname.png';
import shadowImg from '@/assets/img2/touka_buy_Item_ic_shadow.png';
import purchaseTokenItemImg from '@/assets/img2/purchase-token-item.png';
import { getVoucherBonusGemCount } from '@/utils/voucherGem';
import { ProductModalGiftShowcase } from './components/ProductModalGiftShowcase';
import styles from './ProductModal.module.less';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  preConfirmed?: boolean;
}

const PRODUCT_MODAL_MAX_QUANTITY = 99;

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  onClose,
  onAddToCart,
  preConfirmed = false,
}) => {
  const { t, locale } = useLanguage();
  const { breakpoint } = useResponsive();
  const { requireLogin, showLoginModal, setShowLoginModal } = useLoginGuard();
  const { user } = useUser();
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();  const productNameRef = useRef<HTMLSpanElement>(null);
  const [quantity, setQuantity] = useState(1);
  const [showDetails, setShowDetails] = useState(false); // 默认收起，只显示价格信息
  const [frameOpen, setFrameOpen] = useState(false); // 背景图与详情动画同步，避免切换闪烁
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // 暂时注释掉 Stripe 相关逻辑，因为目前都使用 h5_url 的支付方式
  // const [showStripeCheckout, setShowStripeCheckout] = useState(false);
  // const [stripeClientSecret, setStripeClientSecret] = useState<string | undefined>(undefined);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [showPendingOrderDialog, setShowPendingOrderDialog] = useState(false);  // Airwallex 支付相关状态
  const [showAirwallexCheckout, setShowAirwallexCheckout] = useState(false);
  const [airwallexCheckoutParams, setAirwallexCheckoutParams] = useState<{
    intentId: string;
    clientSecret: string;
    currency: string;
    countryCode?: string;
    orderNo?: string;
  } | null>(null);
  const skipNextQuantityClickRef = React.useRef(false);
  const isVoucher = product?.categoryId === 'vouchers';
  const isGiftPack = product?.categoryId === 'giftPacks';
  const productNameText = isGiftPack
    ? product?.name || product?.description || ''
    : product?.description || product?.name || '';
  const productNameMinFontSize = isGiftPack
    ? { mobile: 6, tablet: 7.5, desktop: 9 }
    : { mobile: 7, tablet: 8.5, desktop: 10 };

  useFitText(productNameRef, productNameText, {
    minFontSize: productNameMinFontSize[breakpoint],
    step: 0.25,
    fitHeight: true,
    allowWrapAtMin: true,
    wrapClassName: styles.productNameWrap,
  });

  const getInitialQuantity = (nextProduct: Product | null) => {
    if (!nextProduct) return 1;
    const effectiveMax = Math.min(
      getProductMaxPurchasableQuantity(nextProduct),
      PRODUCT_MODAL_MAX_QUANTITY
    );
    return effectiveMax > 0 ? 1 : 0;
  };

  const resetModalState = (nextProduct: Product | null = null) => {
    setQuantity(getInitialQuantity(nextProduct));
    setShowDetails(false);
    setFrameOpen(false);
    setShowConfirmModal(false);
    // 暂时注释掉 Stripe 相关逻辑
    // setShowStripeCheckout(false);
    // setStripeClientSecret(undefined);
    setIsCreatingOrder(false);
    setShowAirwallexCheckout(false);
    setAirwallexCheckoutParams(null);
    setShowPendingOrderDialog(false);  };

  const handleClose = () => {
    resetModalState();
    onClose();
  };

  // 预加载收起/展开背景，避免切换时解码闪烁
  useEffect(() => {
    if (!product) return;

    const sources = [buyWindowImg, buyWindowExpandedImg];
    sources.forEach(src => {
      const img = new Image();
      img.src = src;
      void img.decode?.().catch(() => undefined);
    });
  }, [product]);

  useEffect(() => {
    if (showDetails) {
      setFrameOpen(true);
      return;
    }

    const timer = window.setTimeout(() => setFrameOpen(false), 300);
    return () => window.clearTimeout(timer);
  }, [showDetails]);

  // 当弹窗关闭或商品变化时，重置状态
  useEffect(() => {
    if (!product) {
      resetModalState();
    } else {
      resetModalState(product);
    }
  }, [product]);

  useScrollLock(Boolean(product));

  if (!product) return null;

  const effectiveMaxQuantity = Math.min(
    getProductMaxPurchasableQuantity(product),
    PRODUCT_MODAL_MAX_QUANTITY
  );
  const isOutOfStock = isProductPurchaseDisabled(product);
  const totalPrice = product.price * quantity;

  // 使用接口返回的商品图片
  const productImage = product.image;
  const productImageBg = isVoucher ? purchaseDetailBgImg : buyItemBgImg;
  const gemCount = product.gem_count ?? 0;
  const valueRatio = product.value_ratio ?? 0;
  const bonusGemCount = getVoucherBonusGemCount(gemCount, valueRatio);
  const showVoucherGemTitle = isVoucher && gemCount > 0;
  const voucherTitleLabel = showVoucherGemTitle
    ? bonusGemCount > 0
      ? `${gemCount}+${bonusGemCount}`
      : String(gemCount)
    : product.description || product.name;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleDecrease = () => {
    setQuantity(prev => Math.max(effectiveMaxQuantity > 0 ? 1 : 0, prev - 1));
  };

  const handleIncrease = () => {
    setQuantity(prev => Math.min(effectiveMaxQuantity, prev + 1));
  };

  const handleQuantityPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    action: () => void
  ) => {
    if (event.currentTarget.disabled) return;

    skipNextQuantityClickRef.current = true;
    event.preventDefault();
    action();
  };

  const handleQuantityClickFallback = (
    event: React.MouseEvent<HTMLButtonElement>,
    action: () => void
  ) => {
    if (skipNextQuantityClickRef.current) {
      skipNextQuantityClickRef.current = false;
      return;
    }

    if (event.currentTarget.disabled) return;
    action();
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
        handleClose();
      } else {
        // 显示确认弹窗
        setShowConfirmModal(true);
      }
    });
  };

  const handlePurchaseConfirm = () => {
    onAddToCart(product, quantity);
    handleClose();
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

  const handleProceedToPayment = async (): Promise<string | null> => {
    if (!product) return '商品信息缺失，请重试';

    if (
      quantity <= 0 ||
      quantity > effectiveMaxQuantity ||
      isProductQuantityOverPurchaseLimit(product, quantity)
    ) {
      const errorMessage = getErrorMessage(SinglePurchaseQuantityLimitReached);
      messageStore.show(errorMessage);
      return errorMessage;
    }

    // 获取必要的参数
    const appKey =
      getAppKeyByGameId(gameId) ||
      storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
    if (!appKey) {
      const errorMessage = '无法获取游戏配置，请刷新页面重试';
      messageStore.show(errorMessage);
      return errorMessage;
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
        if (
          res.bizCode === ProductPurchaseLimitExceeded &&
          product &&
          (product.purchase_limit ?? 0) > 0 &&
          ((product.purchase_limit ?? 0) - (product.purchase_used ?? 0)) >= quantity
        ) {
          setShowPendingOrderDialog(true);
          return null;
        }
        const errorMessage = res.error || '创建订单失败';
        messageStore.show(errorMessage);
        return errorMessage;
      }
      const isAirwallexFlow = isAirwallexOrderPaymentData(res.data);
      const paymentType = isAirwallexFlow
        ? resolveAirwallexPaymentType(res.data.payment_type)
        : res.data.payment_type;

      // 上报内购点击事件（Airwallex 走 airwallex_store / airwallex_h5store）
      const environment = resolveAnalyticsEnvironment(
        res.data.environment,
        res.data.payment_environment,
        res.data.env
      );
      await trackStoreIapClick(product, paymentType, environment);

      // 如果返回了 h5_url，等待事件上报完成后再跳转（通用 H5 支付页面）
      if (res.data.h5_url) {
        navigateTo(res.data.h5_url);
        return null;
      }

      // 判断支付方式：优先检查 Airwallex 相关字段
      if (res.data.billing_checkout_url) {
        // 方式1: 后端已创建 Billing Checkout，直接使用 URL 跳转
        navigateTo(res.data.billing_checkout_url);
        return null;
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
        return null;
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
        const errorMessage = '支付配置错误，请联系客服';
        messageStore.show(errorMessage);
        // console.error('创建订单成功但未返回支付信息:', res.data);
        return errorMessage;
      }
      return null;
    } catch (error) {
      // console.error('创建订单异常:', error);
      const errorMessage = '创建订单失败，请重试';
      messageStore.show(errorMessage);
      return errorMessage;
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

  // 暂时注释掉 Stripe 相关逻辑，因为目前都使用 h5_url 的支付方式
  // // 计算金额（Stripe 需要以分为单位的整数）
  // const convertToStripeAmount = (price: number): number => {
  //   // 将价格转换为美分（Stripe 的最小单位）
  //   // 假设 1 虚拟货币单位 = 0.01 USD，所以 price * 100 = 美分数
  //   return Math.round(price * 100);
  // };

  // const stripeAmount = convertToStripeAmount(product.price * quantity);

  return (
    <div className={styles.overlay} data-scroll-lock-overlay onClick={handleBackdropClick}>
      <div
        className={`${styles.modal} ${showDetails ? styles.modalDetailsExpanded : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalFrameAnchor} aria-hidden>
          <img
            src={buyWindowImg}
            alt=""
            decoding="async"
            className={`${styles.modalFrameImg} ${!frameOpen ? styles.modalFrameVisible : ''}`}
          />
          <img
            src={buyWindowExpandedImg}
            alt=""
            decoding="async"
            className={`${styles.modalFrameImg} ${frameOpen ? styles.modalFrameVisible : ''}`}
          />
        </div>
        <img src={buyWindowImg} alt="" className={styles.modalSizeSpacer} aria-hidden />

        <button
          type="button"
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="关闭"
        >
          <img src={loginModalClose} alt="" className={styles.closeButtonImg} />
        </button>

        <div className={styles.modalContent}>
          <div
            className={`${styles.imageSection} ${isGiftPack ? styles.imageSectionGiftPack : ''}`}
          >
            <div
              className={`${styles.productShowcase} ${
                isGiftPack ? styles.productShowcaseGiftPack : ''
              }`}
            >
              {isGiftPack ? (
                <div className={styles.productImageGiftPack}>
                  <ProductModalGiftShowcase product={product} />
                  <div className={styles.productNamePlate}>
                    <img
                      src={buyItemNameImg}
                      alt=""
                      className={styles.productNamePlateBg}
                      aria-hidden
                    />
                    {productNameText ? (
                      <span ref={productNameRef} className={styles.productName}>
                        {productNameText}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className={styles.productImage}>
                  <img src={productImageBg} alt="" className={styles.productImageBg} aria-hidden />
                  <img src={productImage} alt={product.name} className={styles.productImageMain} />
                  <img src={shadowImg} alt="" className={styles.productImageShadow} />
                  <div className={styles.productNamePlate}>
                    <img
                      src={buyItemNameImg}
                      alt=""
                      className={styles.productNamePlateBg}
                      aria-hidden
                    />
                    {showVoucherGemTitle ? (
                      <div
                        className={styles.productNamePlateVoucherRow}
                        aria-label={voucherTitleLabel}
                      >
                        <img
                          src={purchaseTokenItemImg}
                          alt=""
                          className={styles.productNamePlateGemIcon}
                          aria-hidden
                        />
                        <span className={styles.productNamePlateGemText}>{gemCount}</span>
                        {bonusGemCount > 0 && (
                          <>
                            <span className={styles.productNamePlateGemPlus}>+</span>
                            <img
                              src={purchaseTokenItemImg}
                              alt=""
                              className={styles.productNamePlateGemIcon}
                              aria-hidden
                            />
                            <span className={styles.productNamePlateGemText}>{bonusGemCount}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <span ref={productNameRef} className={styles.productName}>
                        {productNameText}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.quantityRow}>
              <div className={styles.quantitySelector}>
                <button
                  type="button"
                  className={styles.quantityButton}
                  onPointerDown={event => handleQuantityPointerDown(event, handleDecrease)}
                  onClick={event => handleQuantityClickFallback(event, handleDecrease)}
                  disabled={quantity <= 1 || isOutOfStock}
                  aria-label="减少"
                >
                  <span className={styles.quantityButtonSymbol} aria-hidden />
                </button>
                <span className={styles.quantityValue}>{quantity}</span>
                <button
                  type="button"
                  className={styles.quantityButton}
                  onPointerDown={event => handleQuantityPointerDown(event, handleIncrease)}
                  onClick={event => handleQuantityClickFallback(event, handleIncrease)}
                  disabled={quantity >= effectiveMaxQuantity || isOutOfStock}
                  aria-label="增加"
                >
                  <span className={styles.quantityButtonSymbol} aria-hidden />
                </button>
              </div>
            </div>
          </div>

          <div className={styles.purchaseSection}>
            <button
              type="button"
              className={styles.detailsToggle}
              onClick={() => setShowDetails(!showDetails)}
              aria-expanded={showDetails}
            >
              <span className={styles.detailsToggleLabel}>{t('productModal.purchaseDetails')}</span>
              <ChevronUpIcon
                className={`${styles.detailsArrow} ${showDetails ? styles.arrowDown : styles.arrowUp}`}
                color="#5e5447"
              />
            </button>

            <div className={styles.detailsDivider} />

            <div className={styles.detailsExpandArea}>
              <div
                className={`${styles.detailsContent} ${!showDetails ? styles.detailsCollapsed : ''}`}
              >
                <div className={styles.priceInfo}>
                  <div className={styles.priceRow}>
                    <span className={styles.priceLabel}>{t('productModal.unitPrice')}</span>
                    <span className={styles.priceValue}>
                      {formatPrice(product.price, product.currency)}
                    </span>
                  </div>
                  <div className={styles.priceRow}>
                    <span className={styles.priceLabel}>{t('productModal.quantity')}</span>
                    <span className={styles.priceValue}>{quantity}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.purchaseFooter}>
            <div className={styles.totalSection}>
              <span className={styles.totalLabel}>{t('productModal.total')}</span>
              <span className={styles.totalPrice}>{formatPrice(totalPrice, product.currency)}</span>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.confirmButton}
                disabled={isOutOfStock || isCreatingOrder}
                onClick={handleConfirm}
              >
                {isCreatingOrder ? t('common.loading') || '处理中...' : t('productModal.confirm')}
              </button>
            </div>
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

      {/* 待支付订单提示弹窗 */}
      {showPendingOrderDialog && (
        <div className={styles.pendingOrderOverlay} data-scroll-lock-overlay onClick={() => setShowPendingOrderDialog(false)}>
          <div className={styles.pendingOrderModal} onClick={e => e.stopPropagation()}>
            <button type="button" className={styles.pendingOrderCloseButton} onClick={() => setShowPendingOrderDialog(false)} aria-label="关闭">
              <img src={loginModalClose} alt="" className={styles.pendingOrderCloseButtonImg} />
            </button>
            <h2 className={styles.pendingOrderTitle}>{t('pendingOrder.title')}</h2>
            <p className={styles.pendingOrderDescription}>{t('pendingOrder.message')}</p>
            <div className={styles.pendingOrderActions}>
              <button type="button" className={styles.pendingOrderGoButton} onClick={() => { setShowPendingOrderDialog(false); navigate(gameId ? `/game/${gameId}/history?status=inProgress` : '/history?status=inProgress'); }}>{t('pendingOrder.goToOrders')}</button>
              <button type="button" className={styles.pendingOrderCancelButton} onClick={() => setShowPendingOrderDialog(false)}>{t('pendingOrder.cancel')}</button>
            </div>
          </div>
        </div>
      )}      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
};
