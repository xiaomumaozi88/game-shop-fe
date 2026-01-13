import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useUser } from '@/hooks/useUser';
import { bmallOrderApi } from '@/utils/api';
import { formatPrice, storage, STORAGE_KEYS, trackStoreIapSuccess, PAYMENT_TYPES } from '@/utils';
import { Product } from '@/types';
import { ModalCloseIcon } from '../Icons/ModalCloseIcon';
import { Loading } from '../Loading';
import styles from './PaymentSuccessModal.module.less';

export interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  orderNo?: string | null;
  productName?: string | null;
  quantity?: string | null;
  price?: string | null;
  totalAmount?: string | null;
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

export const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  orderNo,
  productName: productNameProp,
  quantity: quantityProp,
  price: priceProp,
  totalAmount: totalAmountProp,
}) => {
  const { gameId } = useParams<{ gameId: string }>();
  const { t, locale } = useLanguage();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 使用 ref 确保支付成功事件只上报一次
  const successEventTracked = useRef(false);

  // 根据游戏ID获取对应的 app_key
  const getAppKeyByGameId = (id: string | undefined): string | undefined => {
    if (!id) return undefined;
    // 游戏ID到app_key的映射
    if (id === 'bam-bam-squad' || id === 'bam-bam-squad') {
      return 'f6594168ce3a9cc57ab7ed74426e25e1';
    } else if (id === 'oopsie' || id === 'oopsie-croco') {
      return '45a56d38bbdd60353438aa25d1ccff20';
    }
    return undefined;
  };

  // 将 locale 转换为语言代码（如 zh-CN -> zh, en-US -> en）
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

  // 解析多语言名称
  const parseMultiName = (multiNameStr: string | undefined, locale: string, fallbackName: string): string => {
    if (!multiNameStr) return fallbackName;
    
    try {
      const multiNameRaw = JSON.parse(multiNameStr || '{}') || {};
      const multiName: Record<string, string> = {};
      
      // 统一转换为小写键名
      Object.keys(multiNameRaw || {}).forEach((k) => {
        multiName[k.toLowerCase()] = multiNameRaw[k];
      });

      // 英文使用 name 字段，不取 multi_name
      if (locale.toLowerCase().startsWith('en')) {
        return fallbackName;
      }

      // 获取当前语言的代码（如 zh-CN -> zh）
      const langCode = getLanguageCode(locale).toLowerCase();
      const localeLower = locale.toLowerCase();
      
      // 尝试匹配的语言代码列表（从最具体到最通用）
      // 对于简体中文（zh-CN），优先使用 cn
      const candidates = localeLower === 'zh-cn' 
        ? ['cn', 'zh', localeLower, 'zh-cn']
        : [
        langCode, // 当前语言代码
            localeLower.split('-')[0], // 语言部分（如 zh-CN -> zh）
            localeLower, // 完整 locale
      ];

      // 按优先级查找
      const found = candidates.find((code) => multiName[code]);
      if (found) return multiName[found];

      // 降级策略：尝试常见变体
      // 对于简体中文，优先使用 cn
      if (localeLower === 'zh-cn' && multiName['cn']) return multiName['cn'];
      if (multiName['zh']) return multiName['zh'];
      if (multiName['cn']) return multiName['cn'];
      if (multiName['en']) return multiName['en'];

      // 如果都没有，返回第一个可用的
      const firstKey = Object.keys(multiName)[0];
      return firstKey ? multiName[firstKey] : fallbackName;
    } catch (error) {
      console.warn('解析 multi_name 失败:', error);
      return fallbackName;
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (sessionId || orderNo) {
        fetchPaymentInfo();
      } else {
        // 如果没有 sessionId 或 orderNo，直接从 props 或 URL 参数获取信息
        loadPaymentInfoFromURL();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sessionId, orderNo, productNameProp, quantityProp, priceProp, totalAmountProp]);

  const loadPaymentInfoFromURL = () => {
    setLoading(true);
    setError(null);

    try {
      // 优先使用 props 中的参数，如果没有则从 URL 读取
      const productName = productNameProp || new URLSearchParams(window.location.search).get('productName') || '商品';
      const quantity = parseInt(quantityProp || new URLSearchParams(window.location.search).get('quantity') || '1');
      const price = parseFloat(priceProp || new URLSearchParams(window.location.search).get('price') || '0');
      const totalAmount = parseFloat(totalAmountProp || new URLSearchParams(window.location.search).get('totalAmount') || '0');

      // 生成订单号
      const orderId = Date.now().toString().substring(0, 9);

      // 获取订单日期
      const orderDate = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      setPaymentInfo({
        totalAmount,
        currency: 'CNY',
        productName,
        quantity,
        price,
        paymentMethod: 'cup', // 默认银联
        orderId,
        orderDate,
        customerEmail: user?.gameAccount || user?.username || '',
        gameServer: user?.gameServer,
        characterName: user?.characterName,
      });
    } catch (err) {
      console.error('加载支付信息失败:', err);
      setError('加载支付信息失败');
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
      // 获取 app_key 和 language
      const appKey = getAppKeyByGameId(gameId) || storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
      if (!appKey) {
        throw new Error('无法获取游戏配置，请刷新页面重试');
      }

      const language = getLanguageCode(locale);

      // 通过 order_no 或 session_id 查询订单详情（优先使用 order_no）
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

      // 格式化支付成功时间
      let orderDate = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      if (orderData.pay_success_time) {
        try {
          const payTime = new Date(orderData.pay_success_time);
          if (!isNaN(payTime.getTime())) {
            orderDate = payTime.toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
          }
        } catch (e) {
          console.warn('解析支付时间失败:', e);
        }
      }

      // 获取支付方式（根据订单信息判断）
      let paymentMethod = 'cup'; // 默认银联
      // 可以根据 orderData 中的其他字段判断支付方式，如果有的话

      // 解析商品名称（优先使用 multi_name，没有则使用 product_name）
      const productName = parseMultiName(
        orderData.multi_name,
        locale,
        orderData.product_name
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
        gameServer: orderData.game_server_channel ? `服务器 ${orderData.game_server_channel}` : user?.gameServer,
        characterName: user?.characterName,
      });

      // 上报支付成功事件（仅上报一次，且仅在支付成功时）
      // 检查支付状态：pay_status 为 1 表示支付成功，或者有 pay_success_time 也表示支付成功
      const isPaymentSuccess = orderData.pay_status === 1 || !!orderData.pay_success_time;
      
      if (!successEventTracked.current && isPaymentSuccess) {
        try {
          // 从订单详情接口返回的数据构建 Product 对象
          // product_position 映射到 categoryId
          const mapPositionToCategoryId = (position?: string): string => {
            if (!position) return 'vouchers';
            const positionLower = position.toLowerCase();
            if (positionLower === 'coupon') return 'vouchers';
            if (positionLower === 'luxury' || positionLower === 'diamond') return 'diamond';
            if (positionLower === 'gift') return 'giftPacks';
            return 'vouchers'; // 默认代金券
          };

          const categoryId = mapPositionToCategoryId(orderData.product_position);
          
          // 构建 Product 对象
          const product: Product = {
            id: orderData.product_id,
            name: productName, // 使用已解析的多语言名称
            description: productName, // 如果没有单独的描述，使用名称
            price: orderData.unit_price,
            image: orderData.product_image || '',
            category: categoryId === 'vouchers' ? '代金券' : categoryId === 'diamond' ? '钻石' : '礼包',
            categoryId,
            stock: 0, // 订单数据中没有库存信息，设为0
            currency: orderData.currency || 'USD',
            iap: orderData.iap,
            iap_id: orderData.iap_id,
            position: orderData.product_position,
          };

          const environment = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
          
          // 获取支付方式：从订单详情接口返回中获取
          const paymentType = orderData.payment_type;
          
          trackStoreIapSuccess(product, paymentType, environment);
          successEventTracked.current = true;
          
          console.log('✅ PaymentSuccessModal: 已上报支付成功事件', { orderNo: orderData.order_no, payStatus: orderData.pay_status, productId: product.id });
        } catch (error) {
          console.error('❌ PaymentSuccessModal: 上报支付成功事件失败:', error);
        }
      } else if (!isPaymentSuccess) {
        console.warn('⚠️ PaymentSuccessModal: 订单支付状态未成功，跳过上报', { orderNo: orderData.order_no, payStatus: orderData.pay_status });
      }
    } catch (err) {
      console.error('获取订单信息失败:', err);
      setError(err instanceof Error ? err.message : '获取订单信息失败');
      // 如果查询失败，降级到从 URL 参数加载
      loadPaymentInfoFromURL();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="关闭"
        >
          <ModalCloseIcon size={24} />
        </button>

        {loading ? (
          <div className={styles.loading}>
            <Loading />
          </div>
        ) : error ? (
          <div className={styles.error}>
            <p>{error}</p>
          </div>
        ) : paymentInfo ? (
          <>
            <h2 className={styles.title}>感谢您的购买</h2>
            <div className={styles.content}>
              <div className={styles.details}>
                <div className={styles.detailRow}>
                  <span className={styles.label}>购买内容:</span>
                  <span className={styles.value}>{paymentInfo.productName}*{paymentInfo.quantity}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.label}>付款方式:</span>
                  <span className={styles.value}>
                    {paymentInfo.paymentMethod === 'cup' ? 'cup' : 
                     paymentInfo.paymentMethod === 'paypal' ? 'PayPal' : 
                     paymentInfo.paymentMethod}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.label}>价格:</span>
                  <span className={styles.value}>
                    {paymentInfo.currency === 'CNY' || paymentInfo.currency === 'USD'
                      ? `${paymentInfo.currency === 'CNY' ? '¥' : '$'}${paymentInfo.price.toFixed(2)}`
                      : paymentInfo.price}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.label}>购买数量:</span>
                  <span className={styles.value}>{paymentInfo.quantity}</span>
                </div>
                {paymentInfo.gameServer && (
                  <div className={styles.detailRow}>
                    <span className={styles.label}>区组/角色:</span>
                    <span className={styles.value}>
                      {paymentInfo.gameServer}
                      {paymentInfo.characterName && `-${paymentInfo.characterName}`}
                    </span>
                  </div>
                )}
                <div className={styles.detailRow}>
                  <span className={styles.label}>订单号:</span>
                  <span className={styles.value}>{paymentInfo.orderId}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.label}>订单日期:</span>
                  <span className={styles.value}>{paymentInfo.orderDate}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.label}>账号:</span>
                  <span className={styles.value}>{paymentInfo.customerEmail}</span>
                </div>
              </div>
              <div className={styles.totalPrice}>
                <span className={styles.totalLabel}>实付金额:</span>
                <span className={styles.totalValue}>
                  {paymentInfo.currency === 'CNY' || paymentInfo.currency === 'USD' 
                    ? `${paymentInfo.currency === 'CNY' ? '¥' : '$'}${paymentInfo.totalAmount.toFixed(2)}`
                    : formatPrice(paymentInfo.totalAmount, paymentInfo.currency)}
                </span>
              </div>
            </div>
            <div className={styles.confirmButtonContainer}>
              <button className={styles.confirmButton} onClick={onClose}>
                确定
              </button>
            </div>
            
          </>
        ) : null}
      </div>
    </div>
  );
};

