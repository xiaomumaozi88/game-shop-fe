import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScrollLock } from '@/hooks/useScrollLock';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';
import { ModalCloseIcon } from '../Icons/ModalCloseIcon';
import { stripeApi } from '@/utils/api';
import { config } from '@/utils/config';
import { Loading } from '../Loading';
import { trackStoreIapFail, PAYMENT_TYPES, getAnalyticsEnvironment } from '@/utils';
import { Product } from '@/types';
import styles from './StripeCheckout.module.less';

// 从配置获取 Stripe 公钥
const STRIPE_PUBLISHABLE_KEY = config.stripePublishableKey;

// 在组件外部初始化 Stripe，避免每次渲染都重新创建
const stripePromise = STRIPE_PUBLISHABLE_KEY
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : null;

interface StripeCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  quantity: number;
  amount: number; // 金额（以分为单位，例如 1000 表示 10.00）
  currency: string; // 货币代码，如 'usd', 'eur' 等
  productName: string;
  product?: Product; // 完整的商品信息（用于上报支付失败事件）
  clientSecret?: string; // 可选的 clientSecret，如果提供则直接使用，否则通过 fetchClientSecret 获取
  paymentType?: string; // 支付方式，从订单创建接口返回
}

export const StripeCheckout: React.FC<StripeCheckoutProps> = ({
  isOpen,
  onClose,
  productId,
  quantity,
  amount,
  currency,
  productName,
  product,
  clientSecret: providedClientSecret,
  paymentType,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasTrackedClose = useRef(false);
  const paymentStarted = useRef(false);

  // 处理用户关闭支付弹窗（用户取消）
  const handleClose = () => {
    // 如果支付已经开始（已经创建了 session），则认为是用户取消
    if (paymentStarted.current && !hasTrackedClose.current) {
      hasTrackedClose.current = true;
      
      // 使用传入的 product 信息上报用户取消事件
      if (product) {
          const environment = getAnalyticsEnvironment();
        trackStoreIapFail(product, paymentType, environment, 'User cancelled');
      }
    }
    
    onClose();
  };

  const fetchClientSecret = useCallback(async () => {
    // 如果提供了 clientSecret，直接返回
    if (providedClientSecret) {
      paymentStarted.current = true;
      return providedClientSecret;
    }

    setLoading(true);
    setError(null);
    paymentStarted.current = false;
    hasTrackedClose.current = false;
    
    try {

      // 调用后端 API 创建 Checkout Session
      const result = await stripeApi.createCheckoutSession({
        productId,
        quantity,
        amount,
        currency: currency.toLowerCase(), // Stripe 需要小写货币代码
        productName,
      });

      // console.log('Checkout session result:', result);

      if (!result.success || !result.data) {
        const errorMessage = result.error || 'Failed to create checkout session';
        // console.error('Checkout session creation failed:', errorMessage);
        setError(errorMessage);
        
        // 上报支付初始化失败
        if (product) {
            const environment = getAnalyticsEnvironment();
          trackStoreIapFail(product, paymentType, environment, `Checkout session creation failed: ${errorMessage}`);
        }
        
        throw new Error(errorMessage);
      }

      if (!result.data.clientSecret) {
        const errorMessage = 'No client secret returned from server';
        // console.error(errorMessage);
        setError(errorMessage);
        
        // 上报支付初始化失败
        if (product) {
            const environment = getAnalyticsEnvironment();
          trackStoreIapFail(product, paymentType, environment, errorMessage);
        }
        
        throw new Error(errorMessage);
      }

      // 标记支付已开始
      paymentStarted.current = true;
      setLoading(false);
      return result.data.clientSecret;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error creating checkout session:', error);
      setError(errorMessage);
      setLoading(false);
      throw error;
    }
  }, [productId, quantity, amount, currency, productName, providedClientSecret]);

  // 当弹窗关闭时重置状态
  useEffect(() => {
    if (!isOpen) {
      paymentStarted.current = false;
      hasTrackedClose.current = false;
    }
  }, [isOpen]);

  useScrollLock(isOpen);

  if (!isOpen) return null;

  if (!stripePromise) {
    return (
      <div className={styles.overlay} data-scroll-lock-overlay onClick={handleClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.dragIndicator} />
          <button
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="关闭"
          >
            <ModalCloseIcon size={24} />
          </button>
          <div className={styles.error}>
            <p>Stripe 配置错误：请设置 REACT_APP_STRIPE_PUBLISHABLE_KEY 环境变量</p>
          </div>
        </div>
      </div>
    );
  }

  // 如果出现错误，显示错误信息
  if (error) {
    return (
      <div className={styles.overlay} data-scroll-lock-overlay onClick={handleClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.dragIndicator} />
          <button
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="关闭"
          >
            <ModalCloseIcon size={24} />
          </button>
          <div className={styles.error}>
            <h3>支付初始化失败</h3>
            <p>{error}</p>
            <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '1rem' }}>
              请检查：
              <br />1. 后端 API 是否已实现 /api/create-checkout-session
              <br />2. 后端服务是否正在运行
              <br />3. 网络连接是否正常
            </p>
            <button
              className={styles.retryButton}
              onClick={() => {
                setError(null);
                setLoading(false);
              }}
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  const options = { fetchClientSecret };

  return (
    <div className={styles.overlay} data-scroll-lock-overlay onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* 拖拽指示器 */}
        <div className={styles.dragIndicator} />
        <button
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="关闭"
        >
          <ModalCloseIcon size={24} />
        </button>
        <div className={styles.checkoutContainer}>
          {loading && (
            <div className={styles.loadingOverlay}>
              <Loading />
              <p>正在初始化支付...</p>
            </div>
          )}
          <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  );
};
