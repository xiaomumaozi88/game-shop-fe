import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { Loading } from '@/components/Loading';
import { stripeApi } from '@/utils/api';
import { trackStoreIapSuccess, trackStoreIapFail, PAYMENT_TYPES, resolveOrdersListPath, getAnalyticsEnvironment } from '@/utils';
import { Product } from '@/types';
import styles from './PaymentReturn.module.less';

const PaymentReturn: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [status, setStatus] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      setStatus('error');
      setLoading(false);
      return;
    }

    // 获取支付会话状态
    stripeApi
      .getSessionStatus(sessionId)
      .then((result) => {
        if (result.success && result.data) {
          const sessionData = result.data;
          const status = sessionData.status;
          setStatus(status);
          setCustomerEmail(sessionData.customer_email || '');
          
          // 获取支付商品信息
          const pendingProductStr = localStorage.getItem('pending_payment_product');
          if (pendingProductStr) {
            try {
              const pendingProduct = JSON.parse(pendingProductStr) as Product & { quantity?: number };
              const environment = getAnalyticsEnvironment();
              
              if (status === 'complete') {
                // 支付成功，上报成功事件
                trackStoreIapSuccess(pendingProduct, PAYMENT_TYPES.STRIPE_STORE, environment);
                // 清除临时存储
                localStorage.removeItem('pending_payment_product');
              } else if (status === 'open') {
                // 支付未完成，需要判断具体原因
                let failReason = 'Payment incomplete';
                
                // 如果有支付错误信息，使用错误信息
                if (sessionData.last_payment_error) {
                  const error = sessionData.last_payment_error;
                  failReason = error.message || error.code || error.type || 'Payment error';
                } else if (sessionData.payment_status === 'unpaid') {
                  // 如果支付状态是未支付，可能是用户取消或支付失败
                  failReason = 'Payment unpaid - user may have cancelled';
                } else {
                  // 默认情况：用户可能取消了支付
                  failReason = 'User cancelled or payment incomplete';
                }
                
                trackStoreIapFail(pendingProduct, PAYMENT_TYPES.STRIPE_STORE, environment, failReason);
                // 清除临时存储
                localStorage.removeItem('pending_payment_product');
              } else if (status === 'expired') {
                // 支付会话已过期
                trackStoreIapFail(pendingProduct, PAYMENT_TYPES.STRIPE_STORE, environment, 'Payment session expired');
                localStorage.removeItem('pending_payment_product');
              }
            } catch (error) {
              // console.error('Error parsing pending product:', error);
            }
          }
        } else {
          setStatus('error');
          // 支付失败，上报失败事件
          const pendingProductStr = localStorage.getItem('pending_payment_product');
          if (pendingProductStr) {
            try {
              const pendingProduct = JSON.parse(pendingProductStr) as Product & { quantity?: number };
              const environment = getAnalyticsEnvironment();
              const errorMessage = result.error || result.message || 'Session status fetch failed';
              trackStoreIapFail(pendingProduct, PAYMENT_TYPES.STRIPE_STORE, environment, `Server error: ${errorMessage}`);
              localStorage.removeItem('pending_payment_product');
            } catch (error) {
              // console.error('Error parsing pending product:', error);
            }
          }
        }
      })
      .catch((error) => {
        // console.error('Error fetching session status:', error);
        setStatus('error');
        // 支付失败，上报失败事件
        const pendingProductStr = localStorage.getItem('pending_payment_product');
        if (pendingProductStr) {
          try {
            const pendingProduct = JSON.parse(pendingProductStr) as Product & { quantity?: number };
            const environment = getAnalyticsEnvironment();
            trackStoreIapFail(pendingProduct, PAYMENT_TYPES.STRIPE_STORE, environment, error instanceof Error ? error.message : 'Unknown error');
            localStorage.removeItem('pending_payment_product');
          } catch (parseError) {
            // console.error('Error parsing pending product:', parseError);
          }
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [searchParams]);

  if (loading) {
    return (
      <div className={styles.container}>
        <Loading />
      </div>
    );
  }

  // 支付失败或取消，重定向到支付页面
  if (status === 'open') {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.icon}>⚠️</div>
          <h2 className={styles.title}>支付未完成</h2>
          <p className={styles.message}>
            支付失败或已取消，请重试。
          </p>
          <button
            className={styles.button}
            onClick={() => navigate('/products')}
          >
            返回商品页面
          </button>
        </div>
      </div>
    );
  }

  // 支付成功
  if (status === 'complete') {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.successIcon}>✓</div>
          <h2 className={styles.title}>支付成功！</h2>
          <p className={styles.message}>
            感谢您的购买！确认邮件已发送至 {customerEmail || '您的邮箱'}。
          </p>
          <p className={styles.subMessage}>
            如有任何问题，请联系客服。
          </p>
          <div className={styles.actions}>
            <button
              className={styles.button}
              onClick={() => navigate(resolveOrdersListPath(location.pathname))}
            >
              查看订单
            </button>
            <button
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={() => navigate('/products')}
            >
              继续购物
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.icon}>❌</div>
        <h2 className={styles.title}>发生错误</h2>
        <p className={styles.message}>
          无法获取支付状态，请稍后重试。
        </p>
        <button
          className={styles.button}
          onClick={() => navigate('/products')}
        >
          返回商品页面
        </button>
      </div>
    </div>
  );
};

export default PaymentReturn;
