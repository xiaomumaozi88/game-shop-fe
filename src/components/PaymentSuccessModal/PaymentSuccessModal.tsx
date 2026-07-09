import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useUser } from '@/hooks/useUser';
import { bmallOrderApi } from '@/utils/api';
import {
  formatPrice,
  storage,
  STORAGE_KEYS,
  trackStoreIapSuccess,
  resolveAnalyticsPaymentType,
  formatServerChannelForDisplay,
} from '@/utils';
import {
  parseProductMultiName,
  resolveOrderProductFallbackName,
} from '@/utils/productMultiName';
import { Product } from '@/types';
import { Loading } from '../Loading';
import paymentSuccessWindowBg from '@/assets/img2/pay_com_buy_window1.png';
import styles from './PaymentSuccessModal.module.less';

export interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  sessionId: string | null;
  orderNo?: string | null;
  productName?: string | null;
  quantity?: string | null;
  price?: string | null;
  totalAmount?: string | null;
  currency?: string | null;
  gameServer?: string | null;
  characterName?: string | null;
}

interface PaymentInfo {
  totalAmount: number;
  currency: string;
  productName: string;
  quantity: number;
  price: number;
  paymentMethod: string;
  orderId: string;
  orderDate: string;
  customerEmail: string;
  gameServer?: string;
  characterName?: string;
}

/** 订单日期展示：YYYY/MM/DD HH:mm:ss（24 小时制），各语言环境一致 */
function formatOrderDateDisplay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}/${m}/${d} ${h}:${min}:${s}`;
}

function formatCurrencyAmount(amount: number, currency: string): string {
  if (currency === 'CNY') return `¥${amount.toFixed(2)}`;
  if (currency === 'USD') return `$${amount.toFixed(2)}`;
  return formatPrice(amount, currency);
}

export const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  sessionId,
  orderNo,
  productName: productNameProp,
  quantity: quantityProp,
  price: priceProp,
  totalAmount: totalAmountProp,
  currency: currencyProp,
  gameServer: gameServerProp,
  characterName: characterNameProp,
}) => {
  const { gameId } = useParams<{ gameId: string }>();
  const { t, locale } = useLanguage();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const successEventTracked = useRef(false);

  const getAppKeyByGameId = (id: string | undefined): string | undefined => {
    if (!id) return undefined;
    if (id === 'bam-bam-squad' || id === 'bam-bam-squad') {
      return 'f6594168ce3a9cc57ab7ed74426e25e1';
    } else if (id === 'oopsie' || id === 'oopsie-croco') {
      return '45a56d38bbdd60353438aa25d1ccff20';
    }
    return undefined;
  };

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

  useEffect(() => {
    if (isOpen) {
      if (sessionId || orderNo) {
        fetchPaymentInfo();
      } else {
        loadPaymentInfoFromURL();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    sessionId,
    orderNo,
    productNameProp,
    quantityProp,
    priceProp,
    totalAmountProp,
    currencyProp,
    gameServerProp,
    characterNameProp,
  ]);

  const loadPaymentInfoFromURL = () => {
    setLoading(true);
    setError(null);

    try {
      const productName = productNameProp || new URLSearchParams(window.location.search).get('productName') || '商品';
      const quantity = parseInt(quantityProp || new URLSearchParams(window.location.search).get('quantity') || '1');
      const price = parseFloat(priceProp || new URLSearchParams(window.location.search).get('price') || '0');
      const totalAmount = parseFloat(totalAmountProp || new URLSearchParams(window.location.search).get('totalAmount') || '0');
      const orderId = Date.now().toString().substring(0, 9);
      const orderDate = formatOrderDateDisplay(new Date());

      setPaymentInfo({
        totalAmount,
        currency: currencyProp || new URLSearchParams(window.location.search).get('currency') || 'CNY',
        productName,
        quantity,
        price,
        paymentMethod: 'cup',
        orderId,
        orderDate,
        customerEmail: user?.gameAccount || user?.username || user?.email || 'demo@touka.com',
        gameServer: formatServerChannelForDisplay(gameServerProp ?? user?.gameServer),
        characterName: characterNameProp ?? user?.characterName,
      });
    } catch (err) {
      // console.error('加载支付信息失败:', err);
      setError(t('paymentSuccess.getPaymentInfoFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentInfo = async () => {
    if (!sessionId && !orderNo) {
      loadPaymentInfoFromURL();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const appKey = getAppKeyByGameId(gameId) || storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
      if (!appKey) {
        throw new Error('无法获取游戏配置，请刷新页面重试');
      }

      const language = getLanguageCode(locale);
      const result = await bmallOrderApi.queryOrder({
        appKey,
        language,
        ...(orderNo ? { orderNo } : {}),
        ...(sessionId ? { sessionId } : {}),
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || '获取订单信息失败');
      }

      const orderData = result.data;

      let orderDate = formatOrderDateDisplay(new Date());
      if (orderData.pay_success_time) {
        try {
          const payTime = new Date(orderData.pay_success_time);
          if (!isNaN(payTime.getTime())) {
            orderDate = formatOrderDateDisplay(payTime);
          }
        } catch (e) {
          // console.warn('解析支付时间失败:', e);
        }
      }

      const paymentMethod = 'cup';
      const productName = parseProductMultiName(
        orderData.multi_name,
        locale,
        resolveOrderProductFallbackName(orderData)
      );

      setPaymentInfo({
        totalAmount: orderData.price,
        currency: orderData.currency || 'USD',
        productName,
        quantity: orderData.quantity,
        price: orderData.unit_price,
        paymentMethod,
        orderId: orderData.order_no,
        orderDate,
        customerEmail: orderData.user_email || user?.email || '',
        gameServer: orderData.game_server_channel
          ? `${t('common.server')} ${formatServerChannelForDisplay(orderData.game_server_channel)}`
          : user?.gameServer,
        characterName: user?.characterName,
      });

      const isPaymentSuccess = orderData.pay_status === 1 || !!orderData.pay_success_time;

      if (!successEventTracked.current && isPaymentSuccess) {
        try {
          const mapPositionToCategoryId = (position?: string): string => {
            if (!position) return 'vouchers';
            const positionLower = position.toLowerCase();
            if (positionLower === 'coupon') return 'vouchers';
            if (positionLower === 'luxury' || positionLower === 'diamond') return 'diamond';
            if (positionLower === 'gift') return 'giftPacks';
            return 'vouchers';
          };

          const categoryId = mapPositionToCategoryId(orderData.product_position);

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

          trackStoreIapSuccess(product, paymentType, environment);
          successEventTracked.current = true;
        } catch (trackError) {
          // console.error('❌ PaymentSuccessModal: 上报支付成功事件失败:', trackError);
        }
      }
    } catch (err) {
      // console.error('获取订单信息失败:', err);
      setError(err instanceof Error ? err.message : t('paymentSuccess.getPaymentInfoFailed'));
      loadPaymentInfoFromURL();
    } finally {
      setLoading(false);
    }
  };

  const paymentMethodLabel = (method: string): string => {
    const m = method.toLowerCase();
    if (m === 'paypal') return t('paymentSuccess.paypal');
    if (m === 'cup' || m === 'unionpay') return t('paymentSuccess.unionPay');
    return method;
  };

  useScrollLock(isOpen);

  if (!isOpen) return null;

  const isChineseLocale = locale === 'zh-CN' || locale === 'zh-TW';

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirmClick = () => {
    if (paymentInfo && !error && !loading) {
      if (onConfirm) {
        onConfirm();
      } else {
        onClose();
      }
    }
  };

  return (
    <div className={styles.overlay} data-scroll-lock-overlay onClick={handleBackdropClick}>
      <div
        className={`${styles.modal}${isChineseLocale ? '' : ` ${styles.modalCompactLocale}`}`}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={paymentSuccessWindowBg}
          alt=""
          className={styles.modalSizeSpacer}
          aria-hidden
        />
        <img
          src={paymentSuccessWindowBg}
          alt=""
          className={styles.modalFrameImg}
          aria-hidden
        />

        {loading ? (
          <div className={styles.loading}>
            <Loading />
          </div>
        ) : error ? (
          <div className={styles.error}>
            <p>{error}</p>
          </div>
        ) : paymentInfo ? (
          <div className={styles.modalContent}>
            <div className={styles.header}>
              <div className={styles.totalSummary}>
                <span className={styles.totalLabel}>{t('paymentSuccess.total')}</span>
                <span className={styles.totalValue}>
                  {formatCurrencyAmount(paymentInfo.totalAmount, paymentInfo.currency)}
                </span>
              </div>
              <p className={styles.thankYou}>{t('paymentSuccess.title')}</p>
            </div>

            <div className={styles.headerDivider} aria-hidden />

            <div className={styles.details}>
              <div className={styles.detailRow}>
                <span className={styles.label}>{t('paymentSuccess.purchaseContent')}</span>
                <span className={styles.value}>
                  {paymentInfo.productName}*{paymentInfo.quantity}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>{t('paymentSuccess.paymentMethod')}</span>
                <span className={styles.value}>{paymentMethodLabel(paymentInfo.paymentMethod)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>{t('paymentSuccess.price')}</span>
                <span className={styles.value}>
                  {formatCurrencyAmount(paymentInfo.price, paymentInfo.currency)}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>{t('paymentSuccess.quantity')}</span>
                <span className={styles.value}>{paymentInfo.quantity}</span>
              </div>
              {paymentInfo.gameServer && (
                <div className={styles.detailRow}>
                  <span className={styles.label}>{t('paymentSuccess.serverAndCharacter')}</span>
                  <span className={styles.value}>
                    {paymentInfo.gameServer}
                    {paymentInfo.characterName && `-${paymentInfo.characterName}`}
                  </span>
                </div>
              )}
              <div className={styles.detailRow}>
                <span className={styles.label}>{t('paymentSuccess.orderId')}</span>
                <span className={styles.value}>{paymentInfo.orderId}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>{t('paymentSuccess.orderDate')}</span>
                <span className={styles.value}>{paymentInfo.orderDate}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>{t('paymentSuccess.account')}</span>
                <span className={styles.value}>{paymentInfo.customerEmail}</span>
              </div>
            </div>

            <button type="button" className={styles.confirmButton} onClick={handleConfirmClick}>
              {t('paymentSuccess.confirm')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
