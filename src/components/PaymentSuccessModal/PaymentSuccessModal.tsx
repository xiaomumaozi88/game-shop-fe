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
  resolveAnalyticsEnvironment,
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

const SUCCESS_STATUS_POLL_MAX_RETRIES = 6;
const SUCCESS_STATUS_POLL_INTERVAL_MS = 1500;
const SUCCESS_TRACK_MAX_RETRIES = 5;
const SUCCESS_TRACK_RETRY_INTERVAL_MS = 600;

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

function parseOrderDate(value?: string | null): Date | null {
  const raw = value?.trim();
  if (!raw) return null;

  const normalized = raw.includes('T') ? raw : raw.replace(/-/g, '/');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
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
  const successStatusPollTimerRef = useRef<number | null>(null);
  const successTrackRetryTimerRef = useRef<number | null>(null);

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
      successEventTracked.current = false;
      clearSuccessStatusPollTimer();
      clearSuccessTrackRetryTimer();
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

  useEffect(() => {
    return () => {
      clearSuccessStatusPollTimer();
      clearSuccessTrackRetryTimer();
    };
  }, []);

  const clearSuccessStatusPollTimer = () => {
    if (successStatusPollTimerRef.current !== null) {
      window.clearTimeout(successStatusPollTimerRef.current);
      successStatusPollTimerRef.current = null;
    }
  };

  const clearSuccessTrackRetryTimer = () => {
    if (successTrackRetryTimerRef.current !== null) {
      window.clearTimeout(successTrackRetryTimerRef.current);
      successTrackRetryTimerRef.current = null;
    }
  };

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

  const fetchPaymentInfo = async (attempt = 0) => {
    if (!sessionId && !orderNo) {
      loadPaymentInfoFromURL();
      return;
    }

    if (attempt === 0) {
      setLoading(true);
      setError(null);
    }

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

      const orderDateValue = orderData.pay_success_time || orderData.created_time;
      const orderDate = formatOrderDateDisplay(parseOrderDate(orderDateValue) || new Date());

      const paymentMethod = orderData.payment_type?.trim() || 'cup';
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
          : formatServerChannelForDisplay(gameServerProp ?? user?.gameServer),
        characterName: orderData.game_user_id || characterNameProp || user?.characterName,
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
            category: categoryId === 'vouchers' ? t('products.toukaCoin') : categoryId === 'diamond' ? t('products.diamond') : t('products.giftPacks'),
            categoryId,
            stock: 0,
            currency: orderData.currency || 'USD',
            iap: orderData.iap,
            iap_id: orderData.iap_id,
            position: orderData.product_position,
          };

          const environment = resolveAnalyticsEnvironment(
            orderData.environment,
            orderData.payment_environment,
            orderData.env
          );
          const paymentType = resolveAnalyticsPaymentType(orderData.payment_type);

          scheduleStoreIapSuccessTrack(product, paymentType, environment, {
            serverChannel: orderData.game_server_channel,
            gameUserId: orderData.game_user_id,
            platform: orderData.platform,
          });
        } catch (trackError) {
          // console.error('❌ PaymentSuccessModal: 上报支付成功事件失败:', trackError);
        }
      } else if (!isPaymentSuccess && attempt < SUCCESS_STATUS_POLL_MAX_RETRIES) {
        clearSuccessStatusPollTimer();
        successStatusPollTimerRef.current = window.setTimeout(() => {
          void fetchPaymentInfo(attempt + 1);
        }, SUCCESS_STATUS_POLL_INTERVAL_MS);
      }
    } catch (err) {
      // console.error('获取订单信息失败:', err);
      if (attempt === 0) {
        setError(err instanceof Error ? err.message : t('paymentSuccess.getPaymentInfoFailed'));
        loadPaymentInfoFromURL();
      }
    } finally {
      if (attempt === 0) {
        setLoading(false);
      }
    }
  };

  const scheduleStoreIapSuccessTrack = (
    product: Product,
    paymentType: string | undefined,
    environment: 'production' | 'sandbox',
    context: {
      serverChannel?: string | number | null;
      gameUserId?: string | null;
      platform?: string | null;
    },
    attempt = 0
  ) => {
    if (successEventTracked.current) return;

    const tracked = trackStoreIapSuccess(product, paymentType, environment, context);
    if (tracked) {
      successEventTracked.current = true;
      clearSuccessTrackRetryTimer();
      return;
    }

    if (attempt >= SUCCESS_TRACK_MAX_RETRIES) return;

    clearSuccessTrackRetryTimer();
    successTrackRetryTimerRef.current = window.setTimeout(() => {
      scheduleStoreIapSuccessTrack(product, paymentType, environment, context, attempt + 1);
    }, SUCCESS_TRACK_RETRY_INTERVAL_MS);
  };

  const paymentMethodLabel = (method: string): string => {
    const m = method.toLowerCase();
    if (m === 'paypal') return t('paymentSuccess.paypal');
    if (m === 'cup' || m === 'unionpay') return t('paymentSuccess.unionPay');
    if (m.startsWith('airwallex')) return 'Airwallex';
    if (m.startsWith('stripe')) return 'Stripe';
    if (m === 'apple' || m === 'applepay' || m === 'apple_pay') return 'Apple Pay';
    if (m === 'google' || m === 'googlepay' || m === 'google_pay') return 'Google Pay';
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
