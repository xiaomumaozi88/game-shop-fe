import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { init } from '@airwallex/components-sdk';
import { config } from '@/utils/config';
import { useLanguage } from '@/hooks/useLanguage';

interface AirwallexCheckoutProps {
  intentId: string;
  clientSecret: string;
  currency: string;
  countryCode?: string;
  orderNo?: string; // 订单号，用于构建 successUrl
}

/**
 * Airwallex 托管支付页面组件
 * 使用 Hosted Payment Page (HPP) 集成方式，重定向到 Airwallex 托管页面
 */
export const AirwallexCheckout: React.FC<AirwallexCheckoutProps> = ({
  intentId,
  clientSecret,
  currency,
  countryCode,
  orderNo,
}) => {
  const { locale } = useLanguage();
  const { gameId } = useParams<{ gameId?: string }>();
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAndRedirect = async () => {
      try {
        setIsInitializing(true);
        setError(null);

        // 构建 successUrl（支付成功后的跳转地址）
        // 跳转到当前游戏的商品页面，并带上订单号参数
        const currentUrl = window.location.origin;
        const gamePath = gameId ? `/game/${gameId}` : '';
        const successUrl = `${currentUrl}${gamePath}?session_id=${intentId}&order_no=${orderNo || ''}`;
        
        // 构建 backUrl（取消/返回按钮的跳转地址）
        const backUrl = `${currentUrl}${gamePath}`;

        // 将 locale 转换为 Airwallex 支持的格式
        // Airwallex 支持: 'en' | 'zh' | 'ja' | 'ko' | 'ar' | 'fr' | 'es' | 'nl' | 'de' | 'it' | 'zh-HK' | 'pl' | 'fi' | 'ru' | 'da' | 'id' | 'ms' | 'sv' | 'ro' | 'pt'
        let airwallexLocale: 'en' | 'zh' | 'ja' | 'ko' | 'ar' | 'fr' | 'es' | 'nl' | 'de' | 'it' | 'zh-HK' | 'pl' | 'fi' | 'ru' | 'da' | 'id' | 'ms' | 'sv' | 'ro' | 'pt' = 'en';
        
        if (locale.startsWith('zh-CN')) {
          airwallexLocale = 'zh';
        } else if (locale.startsWith('zh-TW') || locale.startsWith('zh-HK')) {
          airwallexLocale = 'zh-HK';
        } else if (locale.startsWith('ja')) {
          airwallexLocale = 'ja';
        } else if (locale.startsWith('ko')) {
          airwallexLocale = 'ko';
        } else if (locale.startsWith('ru')) {
          airwallexLocale = 'ru';
        } else if (locale.startsWith('fr')) {
          airwallexLocale = 'fr';
        } else if (locale.startsWith('de')) {
          airwallexLocale = 'de';
        } else if (locale.startsWith('es')) {
          airwallexLocale = 'es';
        } else if (locale.startsWith('pt')) {
          airwallexLocale = 'pt';
        }

        // 初始化 Airwallex SDK
        const { payments } = await init({
          env: config.airwallexEnv,
          enabledElements: ['payments'],
          locale: airwallexLocale,
        });

        // 重定向到 Airwallex 托管支付页面
        payments.redirectToCheckout({
          intent_id: intentId,
          client_secret: clientSecret,
          currency: currency,
          country_code: countryCode,
          successUrl: successUrl,
          back_url: backUrl,
          locale: airwallexLocale,
        });
      } catch (err) {
        // console.error('Airwallex checkout initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize payment');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAndRedirect();
  }, [intentId, clientSecret, currency, countryCode, orderNo, gameId, locale, navigate]);

  // 这个组件实际上不会渲染任何内容，因为它会立即重定向
  // 但在重定向之前，我们显示一个加载状态
  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'red' }}>支付初始化失败: {error}</p>
        <button onClick={() => window.location.reload()}>重试</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>正在跳转到支付页面...</p>
    </div>
  );
};

