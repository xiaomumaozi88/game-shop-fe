import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useUser } from '@/hooks/useUser';
import { useGameRole } from '@/hooks/useGameRole';
import { Order, OrderStatus } from '@/types';
import { bmallOrderApi } from '@/utils/api';
import { storage, STORAGE_KEYS, getGameIdFromAppKey, navigateTo } from '@/utils';
import { ChevronUpIcon } from '@/components/Icons/ChevronUpIcon';
import { ChevronDownIcon } from '@/components/Icons/ChevronDownIcon';
import { Loading } from '@/components/Loading';
import { AlertModal } from '@/components/AlertModal';
import { AirwallexCheckout } from '@/components/AirwallexCheckout/AirwallexCheckout';
import { messageStore } from '@/store/messageStore';
import shadowImg from '@/assets/imgs/touka_buy_Item_ic_shadow.png';
import homeIcon from '@/assets/imgs/touka_web_icon_home_white.png';
import styles from './History.module.less';


type FilterStatus = 'all' | 'inProgress' | 'completed' | 'closed';
type ProductCategory = 'vouchers' | 'diamond' | 'giftPacks';
const ORDER_AUTO_CANCEL_SECONDS = 30 * 60;

/** 将后端 Unix 时间戳转为毫秒：>1e12 视为毫秒，否则视为秒 */
function normalizeCreatedAtUnixToMs(unix: number): number {
  if (!Number.isFinite(unix) || unix <= 0) return NaN;
  return unix > 1e12 ? unix : unix * 1000;
}

const games = [
  { id: 'bam-bam-squad', appKey: 'f6594168ce3a9cc57ab7ed74426e25e1' },
  { id: 'oopsie-croco', appKey: '45a56d38bbdd60353438aa25d1ccff20' },
];

function appKeyFromRouteGameId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  if (id === 'bam-bam-squad') return 'f6594168ce3a9cc57ab7ed74426e25e1';
  if (id === 'oopsie' || id === 'oopsie-croco') return '45a56d38bbdd60353438aa25d1ccff20';
  return undefined;
}

export const History: React.FC = () => {
  const navigate = useNavigate();
  const { gameId: routeGameId } = useParams<{ gameId: string }>();
  const { t, locale } = useLanguage();
  const { user } = useUser();
  const { hasRolesForAppKey } = useGameRole();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [listRefreshToken, setListRefreshToken] = useState(0);
  const [selectedGameAppKey, setSelectedGameAppKey] = useState<string>(() => {
    const fromRoute = appKeyFromRouteGameId(routeGameId);
    if (fromRoute) return fromRoute;
    const stored = storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
    return stored ?? 'f6594168ce3a9cc57ab7ed74426e25e1';
  });
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [filterGameDropdownOpen, setFilterGameDropdownOpen] = useState(false);
  const filterGameDropdownRef = useRef<HTMLDivElement>(null);
  const [noRoleAlertOpen, setNoRoleAlertOpen] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [showAirwallexCheckout, setShowAirwallexCheckout] = useState(false);
  const [airwallexCheckoutParams, setAirwallexCheckoutParams] = useState<{
    intentId: string;
    clientSecret: string;
    currency: string;
    countryCode?: string;
    orderNo?: string;
  } | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [orderIdPendingCancel, setOrderIdPendingCancel] = useState<string | null>(null);
  const [cancelRequesting, setCancelRequesting] = useState(false);

  // 根据 appKey 获取本地化的游戏名称
  const getLocalizedGameName = (appKey: string): string => {
    if (appKey === 'f6594168ce3a9cc57ab7ed74426e25e1') {
      return t('games.bamBamSquad');
    }
    if (appKey === '45a56d38bbdd60353438aa25d1ccff20') {
      return t('games.oopsieCroco');
    }
    return '';
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

  // 根据position映射到categoryId
  const mapPositionToCategoryId = (position: string | undefined): ProductCategory => {
    if (!position) return 'vouchers';
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

  // 将后端订单数据转换为前端 Order 格式（使用 useCallback 避免重复创建）
  const convertOrderDataToOrder = useCallback((orderData: any): Order & { 
    platform?: string; 
    gameServerChannel?: string; 
  } => {
    // 将 order_status 映射到 OrderStatus
    const statusMap: Record<string, OrderStatus> = {
      'pending': OrderStatus.PENDING,
      'completed': OrderStatus.COMPLETED,
      'closed': OrderStatus.CANCELLED,
    };

    // 解析商品名称（优先使用 multi_name，没有则使用 product_name）
    const productName = parseMultiName(
      orderData.multi_name,
      locale,
      orderData.product_name
    );

    // 根据 product_position 或默认值确定 categoryId
    const categoryId = orderData.product_position 
      ? mapPositionToCategoryId(orderData.product_position)
      : 'vouchers'; // 默认代金券

    const paySuccess = orderData.pay_success_time?.trim() || '';
    const createdTime = orderData.created_time?.trim() || '';
    const displayTime = paySuccess || createdTime || new Date().toISOString();

    let bmallCreatedAtUnix: number | undefined;
    const rawUnix = orderData.created_at_unix;
    if (typeof rawUnix === 'number' && Number.isFinite(rawUnix) && rawUnix > 0) {
      bmallCreatedAtUnix = rawUnix;
    } else if (typeof rawUnix === 'string' && rawUnix.trim()) {
      const parsed = Number(rawUnix.trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        bmallCreatedAtUnix = parsed;
      }
    }

    return {
      id: orderData.order_no,
      userId: orderData.game_user_id || user?.id || '',
      items: [
        {
          product: {
            id: orderData.product_id,
            name: productName,
            description: productName,
            price: orderData.unit_price,
            image: orderData.product_image || '', // 后端返回的图片链接
            category: categoryId === 'giftPacks' ? 'giftPacks' : categoryId === 'diamond' ? 'diamond' : 'vouchers',
            categoryId: categoryId,
            stock: 0,
            currency: orderData.currency,
            position: orderData.product_position, // 保存 product_position 字段
          },
          quantity: orderData.quantity,
        },
      ],
      totalAmount: orderData.price,
      currency: orderData.currency,
      status: statusMap[orderData.order_status] || OrderStatus.PENDING,
      createdAt: displayTime,
      bmallCreatedTime: createdTime || undefined,
      bmallCreatedAtUnix,
      platform: orderData.platform,
      gameServerChannel: orderData.game_server_channel,
    } as Order & { platform?: string; gameServerChannel?: string };
  }, [locale, user?.id]);

  // URL 中的游戏与下拉选择、本地存储保持一致（刷新后仍停留在当前游戏订单）
  useEffect(() => {
    const key = appKeyFromRouteGameId(routeGameId);
    if (key) {
      setSelectedGameAppKey(key);
      storage.set(STORAGE_KEYS.CURRENT_GAME_APP_KEY, key);
    }
  }, [routeGameId]);

  // 加载订单列表（切换筛选 tab 时通过 listRefreshToken 重新请求，避免接口偶发失败后无法恢复）
  useEffect(() => {
    let cancelled = false;

    const loadOrders = async () => {
      setLoading(true);

      try {
        const appKey = selectedGameAppKey;
        if (!appKey) {
          if (!cancelled) {
            setOrders([]);
            setLoading(false);
          }
          return;
        }

        const language = getLanguageCode(locale);
        const result = await bmallOrderApi.queryOrderList({
          appKey,
          language,
        });

        if (cancelled) return;

        if (result.success && result.data) {
          const convertedOrders = result.data.items.map(convertOrderDataToOrder);
          setOrders(convertedOrders);
        } else {
          console.error('获取订单列表失败:', result.error);
          setOrders([]);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('加载订单列表异常:', error);
        setOrders([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadOrders();

    return () => {
      cancelled = true;
    };
  }, [selectedGameAppKey, locale, convertOrderDataToOrder, listRefreshToken]);

  const requestOrdersRefresh = () => {
    setListRefreshToken((n) => n + 1);
  };

  // 处理点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // 点击外部关闭 filterTabs 的游戏下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterGameDropdownRef.current && !filterGameDropdownRef.current.contains(event.target as Node)) {
        setFilterGameDropdownOpen(false);
      }
    };

    if (filterGameDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filterGameDropdownOpen]);

  const handleGameSelect = (appKey: string) => {
    setSelectedGameAppKey(appKey);
    storage.set(STORAGE_KEYS.CURRENT_GAME_APP_KEY, appKey);
    setDropdownOpen(false);
    navigate(`/game/${getGameIdFromAppKey(appKey)}/history`, { replace: true });
  };

  const handleFilterGameSelect = (appKey: string) => {
    setSelectedGameAppKey(appKey);
    storage.set(STORAGE_KEYS.CURRENT_GAME_APP_KEY, appKey);
    setFilterGameDropdownOpen(false);
    navigate(`/game/${getGameIdFromAppKey(appKey)}/history`, { replace: true });
  };

  const handleBackToProducts = () => {
    const currentGame = games.find((g) => g.appKey === selectedGameAppKey);
    if (!currentGame) return;
    if (!hasRolesForAppKey(selectedGameAppKey)) {
      setNoRoleAlertOpen(true);
      return;
    }
    navigate(`/game/${currentGame.id}`);
  };

  // 格式化平台显示名称
  const formatPlatform = (platform: string | undefined): string => {
    if (!platform) return '';
    const platformLower = platform.toLowerCase();
    if (platformLower === 'ios') {
      return 'iOS';
    }
    if (platformLower === 'android') {
      return 'Android';
    }
    // 其他情况首字母大写
    return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
  };

  // 根据 categoryId 获取本地化的类别名称
  const getCategoryName = (categoryId: string | undefined): string => {
    if (!categoryId) return t('products.vouchers');
    
    switch (categoryId) {
      case 'vouchers':
        return t('products.vouchers');
      case 'diamond':
        return t('products.diamond');
      case 'giftPacks':
        return t('products.giftPacks');
      default:
        return t('products.vouchers');
    }
  };

  const getStatusText = (status: OrderStatus): string => {
    const statusMap: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: t('history.status.pending'),
      [OrderStatus.PAID]: t('history.status.paid'),
      [OrderStatus.SHIPPED]: t('history.status.shipped'),
      [OrderStatus.COMPLETED]: t('history.status.completed'),
      [OrderStatus.CANCELLED]: t('history.status.cancelled'),
    };
    return statusMap[status] || status;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  };

  const formatDuration = (totalSeconds: number): string => {
    const safeSeconds = Math.max(0, totalSeconds);
    const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(safeSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  /**
   * 待支付订单自动取消 UI：
   * - 有 created_at_unix：倒计时与「是否已过 30 分钟」均以时间戳为准（无时区问题）
   * - 无时间戳：回退 created_time / 展示时间字符串（兼容旧数据）
   */
  const getPendingAutoCancelUi = (order: Order): { remainingSeconds: number; showCountdownAndCancel: boolean } => {
    const unixRaw = order.bmallCreatedAtUnix;
    if (unixRaw != null && Number.isFinite(unixRaw) && unixRaw > 0) {
      const createdMs = normalizeCreatedAtUnixToMs(unixRaw);
      if (Number.isFinite(createdMs)) {
        const deadlineMs = createdMs + ORDER_AUTO_CANCEL_SECONDS * 1000;
        const remaining = Math.floor((deadlineMs - nowTs) / 1000);
        return {
          remainingSeconds: remaining,
          showCountdownAndCancel: remaining > 0,
        };
      }
    }
    const anchor = order.bmallCreatedTime || order.createdAt;
    if (!anchor) {
      return { remainingSeconds: ORDER_AUTO_CANCEL_SECONDS, showCountdownAndCancel: true };
    }
    const anchorTs = new Date(anchor).getTime();
    if (!Number.isFinite(anchorTs)) {
      return { remainingSeconds: ORDER_AUTO_CANCEL_SECONDS, showCountdownAndCancel: true };
    }
    const elapsedSeconds = Math.floor((nowTs - anchorTs) / 1000);
    const remaining = ORDER_AUTO_CANCEL_SECONDS - elapsedSeconds;
    return {
      remainingSeconds: remaining,
      showCountdownAndCancel: remaining > 0,
    };
  };

  const detectCurrentPlatform = (): string => {
    if (user?.platform) return user.platform;
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/android/.test(userAgent)) return 'android';
    return 'web';
  };

  const closeCancelOrderDialog = () => {
    if (cancelRequesting) return;
    setCancelDialogOpen(false);
    setOrderIdPendingCancel(null);
  };

  const openCancelOrderDialog = (orderId: string) => {
    setOrderIdPendingCancel(orderId);
    setCancelDialogOpen(true);
  };

  const confirmCancelOrder = async () => {
    const orderId = orderIdPendingCancel;
    const appKey = selectedGameAppKey;
    if (!orderId || !appKey) return;

    setCancelRequesting(true);
    try {
      const res = await bmallOrderApi.cancelOrder({
        appKey,
        orderNo: orderId,
      });
      if (res.success) {
        messageStore.show(t('history.cancelOrderSuccess'));
        setCancelDialogOpen(false);
        setOrderIdPendingCancel(null);
        requestOrdersRefresh();
      } else {
        messageStore.show(res.error || t('history.cancelOrderFailed'));
      }
    } catch {
      messageStore.show(t('history.cancelOrderFailed'));
    } finally {
      setCancelRequesting(false);
    }
  };

  const handlePayOrder = async (order: Order) => {
    const appKey = selectedGameAppKey;
    if (!appKey) {
      messageStore.show(t('history.payConfigError'));
      return;
    }

    setPayingOrderId(order.id);
    try {
      const language = getLanguageCode(locale);
      const latestOrderResult = await bmallOrderApi.queryOrder({
        appKey,
        language,
        orderNo: order.id,
      });

      if (!latestOrderResult.success || !latestOrderResult.data) {
        messageStore.show(latestOrderResult.error || t('history.fetchOrderFailed'));
        return;
      }

      const latestOrder = latestOrderResult.data;
      const createOrderResult = await bmallOrderApi.createOrder({
        appKey,
        platform: detectCurrentPlatform(),
        language,
        productId: latestOrder.product_id,
        quantity: latestOrder.quantity,
      });

      if (!createOrderResult.success || !createOrderResult.data) {
        messageStore.show(createOrderResult.error || t('history.createOrderFailed'));
        return;
      }

      const paymentData = createOrderResult.data;
      if (paymentData.h5_url) {
        navigateTo(paymentData.h5_url);
        return;
      }
      if (paymentData.billing_checkout_url) {
        navigateTo(paymentData.billing_checkout_url);
        return;
      }
      if (paymentData.intent_id && paymentData.client_secret) {
        setAirwallexCheckoutParams({
          intentId: paymentData.intent_id,
          clientSecret: paymentData.client_secret,
          currency: order.currency || latestOrder.currency || 'USD',
          countryCode: user?.country,
          orderNo: paymentData.order_no,
        });
        setShowAirwallexCheckout(true);
        return;
      }

      messageStore.show(t('history.payConfigError'));
      console.error('支付配置错误，未返回可用支付参数:', paymentData);
    } catch (error) {
      console.error('重新支付失败:', error);
      messageStore.show(t('history.payRetryFailed'));
    } finally {
      setPayingOrderId(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'inProgress') {
      // 进行中：包括待支付、已支付、已发货但未完成的订单（如果出现问题没有马上下发）
      return order.status === OrderStatus.PENDING || 
             order.status === OrderStatus.PAID || 
             order.status === OrderStatus.SHIPPED;
    }
    if (filterStatus === 'completed') {
      // 已完成：玩家成功支付并成功下发的订单状态
      return order.status === OrderStatus.COMPLETED;
    }
    if (filterStatus === 'closed') {
      // 已关闭：玩家拉起支付但后续关闭/退出支付的订单状态
      return order.status === OrderStatus.CANCELLED;
    }
    return true;
  });

  useEffect(() => {
    const hasPendingOrders = filteredOrders.some((order) => order.status === OrderStatus.PENDING);
    if (!hasPendingOrders) return;

    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [filteredOrders]);

  return (
    <div className={styles.history}>
      {/* 游戏选择 */}
      <div className={styles.gameSelector} ref={dropdownRef}>
        <div
          className={styles.gameSelectorContent}
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <span className={styles.gameName}>{getLocalizedGameName(selectedGameAppKey)}</span>
          <ChevronUpIcon
            className={`${styles.dropdownIcon} ${dropdownOpen ? styles.dropdownIconOpen : styles.dropdownIconClosed}`}
            color="#333"
          />
        </div>
        {dropdownOpen && (
          <div className={styles.dropdownList}>
            {games.map((game) => (
              <div
                key={game.id}
                className={`${styles.dropdownItem} ${
                  selectedGameAppKey === game.appKey ? styles.dropdownItemActive : ''
                }`}
                onClick={() => handleGameSelect(game.appKey)}
              >
                {getLocalizedGameName(game.appKey)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 订单筛选标签 */}
      <div className={styles.filterTabs}>
        <div className={styles.filterTabsLeft}>
        <button
          className={`${styles.filterTab} ${filterStatus === 'all' ? styles.filterTabActive : ''}`}
          onClick={() => {
            setFilterStatus('all');
            requestOrdersRefresh();
          }}
        >
          {t('history.filter.all')}
        </button>
        <button
          className={`${styles.filterTab} ${filterStatus === 'inProgress' ? styles.filterTabActive : ''}`}
          onClick={() => {
            setFilterStatus('inProgress');
            requestOrdersRefresh();
          }}
        >
          {t('history.filter.inProgress')}
        </button>
        <button
          className={`${styles.filterTab} ${filterStatus === 'completed' ? styles.filterTabActive : ''}`}
          onClick={() => {
            setFilterStatus('completed');
            requestOrdersRefresh();
          }}
        >
          {t('history.filter.completed')}
        </button>
        <button
          className={`${styles.filterTab} ${filterStatus === 'closed' ? styles.filterTabActive : ''}`}
          onClick={() => {
            setFilterStatus('closed');
            requestOrdersRefresh();
          }}
        >
          {t('history.filter.closed')}
        </button>
        </div>
        
        <div className={styles.filterTabsRight}>
           {/* 返回专区按钮 */}
           <button className={styles.backToProductsButton} onClick={handleBackToProducts}>
            <img src={homeIcon} alt="home" className={styles.backToProductsIcon} />
            <span>{t('history.backToGameZone')}</span>
          </button>
          {/* 游戏选择下拉框 */}
          <div className={styles.filterGameSelector} ref={filterGameDropdownRef}>
            <div
              className={styles.filterGameSelectorContent}
              onClick={() => setFilterGameDropdownOpen(!filterGameDropdownOpen)}
            >
              <span className={styles.filterGameName}>{getLocalizedGameName(selectedGameAppKey)}</span>
              <ChevronDownIcon
                className={`${styles.filterDropdownIcon} ${filterGameDropdownOpen ? styles.filterDropdownIconOpen : ''}`}
                color="#585858"
              />
            </div>
            {filterGameDropdownOpen && (
              <div className={styles.filterDropdownList}>
                {games.map((game) => (
                  <div
                    key={game.id}
                    className={`${styles.filterDropdownItem} ${
                      selectedGameAppKey === game.appKey ? styles.filterDropdownItemActive : ''
                    }`}
                    onClick={() => handleFilterGameSelect(game.appKey)}
                  >
                    {getLocalizedGameName(game.appKey)}
                  </div>
                ))}
              </div>
            )}
          </div>
         
        </div>
      </div>

      {/* 订单列表 */}
      <div className={styles.ordersList}>
        {loading ? (
          <div className={styles.empty}>
            <Loading />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className={styles.empty}>
            <p>{t('history.empty')}</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const firstItem = order.items[0];
            const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
            const pendingAutoCancelUi =
              order.status === OrderStatus.PENDING ? getPendingAutoCancelUi(order) : null;

            return (
              <div key={order.id} className={styles.orderCard}>
                {/* 订单头部 */}
                <div className={styles.orderHeader}>
                  <span className={styles.orderId}>{t('paymentSuccess.orderId')} {order.id}</span>
                  <span className={styles.orderStatus}>{getStatusText(order.status)}</span>
                </div>

                {/* 订单内容 */}
                <div className={styles.orderContent}>
                  {/* 左侧：商品图标 */}
                  <div className={styles.orderItemIcon}>
                    <div className={styles.iconWrapper}>
                      {firstItem.product.image ? (
                        // 所有类型（代金券、钻石、礼包）：背景图 + 主图 + 阴影
                        <div className={styles.orderImageContainer}>
                          <div 
                            className={`${styles.voucherImageBg} ${
                              firstItem.product.categoryId === 'diamond' ? styles.voucherImageBgDiamond : ''
                            }`}
                          ></div>
                          <img
                            src={firstItem.product.image}
                            alt={firstItem.product.name}
                            className={styles.voucherImageMain}
                          />
                          <img src={shadowImg} alt="shadow" className={styles.voucherImageShadow} />
                        </div>
                      ) : (
                        // 没有图片时的占位符
                        <div className={styles.productPlaceholder}>
                          {/* 商品图片占位符 */}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 右侧：商品详情 */}
                  <div className={styles.orderItemDetails}>
                    <div className={styles.itemName}>{firstItem.product.name}*{totalQuantity}</div>
                    <div className={styles.orderTime}>{t('history.orderTime')} {formatDate(order.createdAt)}</div>
                    <div className={styles.itemInfo}>
                      <button className={styles.voucherButton}>{getCategoryName(firstItem.product.categoryId)}</button>
                      <span className={styles.itemQuantity}>{firstItem.product.name}*{totalQuantity}</span>
                    </div>
                      <div className={styles.platformInfo}>
                        {formatPlatform((order as any).platform)}
                        {(order as any).gameServerChannel &&
                          ` / ${t('common.server')} ${(order as any).gameServerChannel}`}
                      </div>
                  </div>
                </div>
                {order.status === OrderStatus.PENDING && (
                  <div className={styles.pendingActionsSection}>
                    {pendingAutoCancelUi?.showCountdownAndCancel && (
                      <div className={styles.pendingAutoCancelText}>
                        <span>{t('history.pendingAutoCancelPrefix')}</span>
                        <span className={styles.pendingAutoCancelTime}>
                          {formatDuration(Math.max(0, pendingAutoCancelUi.remainingSeconds))}
                        </span>
                        <span>{t('history.pendingAutoCancelSuffix')}</span>
                      </div>
                    )}
                    <div
                      className={`${styles.pendingActions} ${
                        !pendingAutoCancelUi?.showCountdownAndCancel ? styles.pendingActionsPayOnly : ''
                      }`}
                    >
                      {pendingAutoCancelUi?.showCountdownAndCancel && (
                        <button
                          type="button"
                          className={styles.cancelOrderButton}
                          onClick={() => openCancelOrderDialog(order.id)}
                          disabled={payingOrderId === order.id || cancelRequesting}
                        >
                          {t('history.cancelOrder')}
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.payOrderButton}
                        onClick={() => handlePayOrder(order)}
                        disabled={payingOrderId === order.id || cancelRequesting}
                      >
                        {payingOrderId === order.id ? t('common.loading') : t('history.payOrder')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <AlertModal
        isOpen={noRoleAlertOpen}
        onClose={() => setNoRoleAlertOpen(false)}
        message={noRoleAlertOpen ? t('home.noRoleAccount') : ''}
      />
      <AlertModal
        isOpen={cancelDialogOpen}
        onClose={closeCancelOrderDialog}
        title={t('history.cancelOrderConfirmTitle')}
        confirmText={cancelRequesting ? t('common.loading') : t('history.cancelOrderConfirmPrimary')}
        dismissText={t('history.cancelOrderDismiss')}
        onDismiss={closeCancelOrderDialog}
        onPrimary={confirmCancelOrder}
        actionsLocked={cancelRequesting}
        swapDualButtonStyles
      />
      {showAirwallexCheckout && airwallexCheckoutParams && (
        <AirwallexCheckout
          intentId={airwallexCheckoutParams.intentId}
          clientSecret={airwallexCheckoutParams.clientSecret}
          currency={airwallexCheckoutParams.currency}
          countryCode={airwallexCheckoutParams.countryCode}
          orderNo={airwallexCheckoutParams.orderNo}
        />
      )}
    </div>
  );
};
