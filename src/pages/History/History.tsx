import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useResponsive } from '@/hooks/useResponsive';
import { useUser } from '@/hooks/useUser';
import { Order, OrderStatus, Product } from '@/types';
import { bmallOrderApi } from '@/utils/api';
import {
  storage,
  STORAGE_KEYS,
  getGameIdFromAppKey,
  navigateTo,
  buildNoRoleHomeState,
  refreshGameStoreRoles,
  hasGameStoreRolesForAppKey,
  resolveGameStoreTargetFromRouteAndAppKey,
  isGameStoreEntryVisible,
  getDefaultGameStoreAppKey,
  formatServerChannelForDisplay,
  resolveOrderCategoryId,
  resolveAnalyticsEnvironment,
  trackStoreIapFail,
} from '@/utils';
import { parseProductMultiName, resolveOrderProductFallbackName } from '@/utils/productMultiName';
import {
  getGiftPackOrderThumbnail,
  parseGiftPackPurchaseLimitType,
} from '@/utils/giftPackPurchaseLimitType';
import { ChevronDownIcon } from '@/components/Icons/ChevronDownIcon';
import { Loading } from '@/components/Loading';
import { AlertModal } from '@/components/AlertModal';
import { AirwallexCheckout } from '@/components/AirwallexCheckout/AirwallexCheckout';
import { messageStore } from '@/store/messageStore';
import emptyOrderImg from '@/assets/img2/pay_order_null.png';
import logoTextImg from '@/assets/img2/login_modal_logotext.png';
import homeIcon from '@/assets/img2/touka_web_icon_home_white.png';
import paginationArrowImg from '@/assets/img2/arrow.png';
import { HomeBackgroundPattern } from '@/pages/Home/components/HomeBackgroundPattern';
import styles from './History.module.less';

const ALL_GAMES_APP_KEY = '__all__';

type FilterStatus = 'all' | 'inProgress' | 'completed' | 'closed';
type HistoryOrder = Order & {
  appKey?: string;
  platform?: string;
  gameServerChannel?: string;
  gameUserId?: string;
  userEmail?: string;
  paymentType?: string;
  environment?: string;
};
type PaginationItem = number | 'ellipsis-left' | 'ellipsis-right';
const ORDER_AUTO_CANCEL_SECONDS = 30 * 60;
const ORDERS_PAGE_SIZE = 10;

function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 6) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const getRange = (start: number, end: number): number[] =>
    Array.from({ length: end - start + 1 }, (_, index) => start + index);

  if (safeCurrentPage <= 5) {
    return [...getRange(1, 5), 'ellipsis-right', totalPages];
  }

  if (safeCurrentPage >= totalPages - 1) {
    return [1, 2, 'ellipsis-left', ...getRange(totalPages - 3, totalPages)];
  }

  const windowStart = safeCurrentPage - 2;
  const windowEnd = Math.min(safeCurrentPage + 2, totalPages - 1);

  return [
    1,
    'ellipsis-left',
    ...getRange(windowStart, windowEnd),
    ...(windowEnd < totalPages - 1 ? (['ellipsis-right'] as PaginationItem[]) : []),
    totalPages,
  ];
}

function getOrderItemDisplayImage(product: Product): string | null {
  const resolvedCategoryId = resolveOrderCategoryId(product.position, product.purchase_limit_type);

  if (resolvedCategoryId === 'giftPacks' || product.categoryId === 'giftPacks') {
    return getGiftPackOrderThumbnail(product.purchase_limit_type);
  }

  return product.image?.trim() ? product.image : null;
}

/** 将后端 Unix 时间戳转为毫秒：>1e12 视为毫秒，否则视为秒 */
function normalizeCreatedAtUnixToMs(unix: number): number {
  if (!Number.isFinite(unix) || unix <= 0) return NaN;
  return unix > 1e12 ? unix : unix * 1000;
}

const games = [
  { id: 'bam-bam-squad', appKey: 'f6594168ce3a9cc57ab7ed74426e25e1' },
  { id: 'oopsie-croco', appKey: '45a56d38bbdd60353438aa25d1ccff20' },
].filter(game => isGameStoreEntryVisible(game.id));

function appKeyFromRouteGameId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  if (id === 'bam-bam-squad') return 'f6594168ce3a9cc57ab7ed74426e25e1';
  if (id === 'oopsie' || id === 'oopsie-croco') return '45a56d38bbdd60353438aa25d1ccff20';
  return undefined;
}

export const History: React.FC = () => {
  const navigate = useNavigate();
  const { gameId: routeGameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();  const { t, locale } = useLanguage();
  const { isDesktop, isTouchLandscape } = useResponsive();
  const { user, getGameRoleSelection } = useUser();
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [listRefreshToken, setListRefreshToken] = useState(0);
  const [selectedGameAppKey, setSelectedGameAppKey] = useState<string>(() => {
    const fromRoute = appKeyFromRouteGameId(routeGameId);
    if (fromRoute) return fromRoute;
    const stored = storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
    return stored ?? getDefaultGameStoreAppKey();
  });
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState('');
  const [filterGameDropdownOpen, setFilterGameDropdownOpen] = useState(false);
  const filterGameDropdownMobileRef = useRef<HTMLDivElement>(null);
  const filterGameDropdownDesktopRef = useRef<HTMLDivElement>(null);
  const historyPageRef = useRef<HTMLDivElement>(null);
  const expiredPendingOrderRefreshRef = useRef<Set<string>>(new Set());
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
    if (appKey === ALL_GAMES_APP_KEY) {
      return t('history.allGames');
    }
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

  // 将后端订单数据转换为前端 Order 格式（使用 useCallback 避免重复创建）
  const convertOrderDataToOrder = useCallback(
    (orderData: any, sourceAppKey?: string): HistoryOrder => {
      // 将 order_status 映射到 OrderStatus
      const statusMap: Record<string, OrderStatus> = {
        pending: OrderStatus.PENDING,
        completed: OrderStatus.COMPLETED,
        closed: OrderStatus.CANCELLED,
      };

      // 解析商品名称：multi_name 仅匹配当前语言键，未命中则用 name
      const productName = parseProductMultiName(
        orderData.multi_name,
        locale,
        resolveOrderProductFallbackName(orderData)
      );

      // 根据礼包特征优先确定 categoryId，避免礼包单被默认归为超级钻石
      const categoryId = resolveOrderCategoryId(
        orderData.product_position,
        orderData.purchase_limit_type
      );

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

      let payStatus: number | undefined;
      const rawPayStatus = orderData.pay_status;
      if (typeof rawPayStatus === 'number' && Number.isFinite(rawPayStatus)) {
        payStatus = rawPayStatus;
      } else if (typeof rawPayStatus === 'string' && rawPayStatus.trim()) {
        const parsed = Number(rawPayStatus.trim());
        if (Number.isFinite(parsed)) {
          payStatus = parsed;
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
              category:
                categoryId === 'giftPacks'
                  ? 'giftPacks'
                  : categoryId === 'diamond'
                    ? 'diamond'
                    : 'vouchers',
              categoryId: categoryId,
              stock: 0,
              currency: orderData.currency,
              position: orderData.product_position, // 保存 product_position 字段
              iap: orderData.iap,
              iap_id: orderData.iap_id,
              purchase_limit_type: parseGiftPackPurchaseLimitType(orderData.purchase_limit_type),
            },
            quantity: orderData.quantity,
          },
        ],
        totalAmount: orderData.price,
        currency: orderData.currency,
        status: statusMap[orderData.order_status] || OrderStatus.PENDING,
        payStatus,
        createdAt: displayTime,
        bmallCreatedTime: createdTime || undefined,
        bmallCreatedAtUnix,
        appKey: sourceAppKey,
        platform: orderData.platform,
        gameServerChannel: orderData.game_server_channel,
        gameUserId: orderData.game_user_id,
        userEmail: orderData.account_email || orderData.user_email,
        paymentType: orderData.payment_type,
        environment: resolveAnalyticsEnvironment(
          orderData.environment,
          orderData.payment_environment,
          orderData.env
        ),
      };
    },
    [locale, user?.id]
  );

  // URL 中的游戏与下拉选择、本地存储保持一致（刷新后仍停留在当前游戏订单）
  // 从 URL 参数读取默认筛选状态（如从商品页跳转过来的 pendingOrder 提示）
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam === 'inProgress') {
      setFilterStatus('inProgress');
    }
  }, [searchParams]);
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

        if (selectedGameAppKey === ALL_GAMES_APP_KEY) {
          const responses = await Promise.all(
            games.map(game =>
              bmallOrderApi.queryOrderList({
                appKey: game.appKey,
                language,
              })
            )
          );
          if (cancelled) return;
          const convertedOrders = responses.flatMap((result, index) =>
            result.success && result.data
              ? result.data.items.map(item => convertOrderDataToOrder(item, games[index]?.appKey))
              : []
          );
          setOrders(convertedOrders);
          return;
        }

        const result = await bmallOrderApi.queryOrderList({
          appKey: selectedGameAppKey,
          language,
        });

        if (cancelled) return;

        if (result.success && result.data) {
          const convertedOrders = result.data.items.map(item =>
            convertOrderDataToOrder(item, selectedGameAppKey)
          );
          setOrders(convertedOrders);
        } else {
          // console.error('获取订单列表失败:', result.error);
          setOrders([]);
        }
      } catch (error) {
        if (cancelled) return;
        // console.error('加载订单列表异常:', error);
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
    setListRefreshToken(n => n + 1);
  };

  // 点击外部关闭游戏下拉菜单（移动端 / PC 端各一处）
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inMobile = filterGameDropdownMobileRef.current?.contains(target);
      const inDesktop = filterGameDropdownDesktopRef.current?.contains(target);
      if (!inMobile && !inDesktop) {
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

  const handleBackToProducts = async () => {
    if (selectedGameAppKey === ALL_GAMES_APP_KEY && !routeGameId) {
      navigate('/');
      return;
    }

    const target =
      selectedGameAppKey === ALL_GAMES_APP_KEY
        ? resolveGameStoreTargetFromRouteAndAppKey(routeGameId, '')
        : resolveGameStoreTargetFromRouteAndAppKey(undefined, selectedGameAppKey);

    if (!target) {
      navigate('/');
      return;
    }

    storage.set(STORAGE_KEYS.CURRENT_GAME_APP_KEY, target.appKey);

    await refreshGameStoreRoles();

    if (!hasGameStoreRolesForAppKey(target.appKey)) {
      navigate('/', { state: buildNoRoleHomeState(target.gameId) });
      return;
    }

    navigate(`/game/${target.gameId}`);
  };

  const handleFilterGameSelect = (appKey: string) => {
    setSelectedGameAppKey(appKey);
    setCurrentPage(1);
    setFilterGameDropdownOpen(false);
    if (appKey === ALL_GAMES_APP_KEY) {
      navigate('/history', { replace: true });
      return;
    }
    storage.set(STORAGE_KEYS.CURRENT_GAME_APP_KEY, appKey);
    navigate(`/game/${getGameIdFromAppKey(appKey)}/history`, { replace: true });
  };

  // 根据 categoryId 获取本地化的类别名称
  const getCategoryName = (categoryId: string | undefined): string => {
    if (!categoryId) return t('products.toukaCoin');

    switch (categoryId) {
      case 'vouchers':
        return t('products.toukaCoin');
      case 'diamond':
        return t('products.diamond');
      case 'giftPacks':
        return t('products.giftPacks');
      default:
        return t('products.toukaCoin');
    }
  };

  const getStatusText = (status: OrderStatus, order?: Order): string => {
    if (status === OrderStatus.COMPLETED && order?.payStatus === 2) {
      return t('history.status.refunded');
    }

    const statusMap: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: t('history.status.pending'),
      [OrderStatus.PAID]: t('history.status.paid'),
      [OrderStatus.SHIPPED]: t('history.status.shipped'),
      [OrderStatus.COMPLETED]: t('history.status.completed'),
      [OrderStatus.CANCELLED]: t('history.status.cancelled'),
    };
    return statusMap[status] || status;
  };

  const formatPlatform = (platform: string | undefined): string => {
    if (!platform) return '';
    const platformLower = platform.toLowerCase();
    if (platformLower === 'ios') return 'iOS';
    if (platformLower === 'android') return locale.startsWith('zh') ? '安卓' : 'Android';
    return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    if (locale.startsWith('zh')) {
      return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;
    }

    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  };

  const formatOrderPlatformLine = (order: HistoryOrder): string => {
    const platformText = formatPlatform(order.platform);
    const serverText = formatServerChannelForDisplay(order.gameServerChannel);
    if (platformText && serverText) return `${platformText} / ${serverText}`;
    return platformText || serverText;
  };

  const formatTotalQuantity = (quantity: number): string => {
    if (locale.startsWith('zh')) return `共${quantity}件`;
    return quantity === 1 ? '1 item' : `${quantity} items`;
  };

  const formatOrderAmount = (amount: number, currency: string): string => {
    const hasFraction = Math.abs(amount % 1) > Number.EPSILON;
    const formattedAmount = hasFraction
      ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return formattedAmount;
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
  const getPendingAutoCancelUi = (
    order: Order
  ): { remainingSeconds: number; showCountdownAndCancel: boolean } => {
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

  const getEffectiveOrderStatus = (order: Order): OrderStatus => {
    if (order.status !== OrderStatus.PENDING) return order.status;

    const pendingAutoCancelUi = getPendingAutoCancelUi(order);
    return pendingAutoCancelUi.remainingSeconds <= 0 ? OrderStatus.CANCELLED : OrderStatus.PENDING;
  };

  const detectCurrentPlatform = (): string => {
    if (user?.platform) return user.platform;
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/android/.test(userAgent)) return 'android';
    return 'web';
  };

  const normalizeOrderPaymentPlatform = (
    platform: string | undefined | null
  ): 'ios' | 'android' | undefined => {
    const value = platform?.trim().toLowerCase();
    if (value === 'ios' || value === 'android') return value;
    return undefined;
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
    const orderPendingCancel = orders.find(order => order.id === orderId);
    const appKey = orderPendingCancel?.appKey || selectedGameAppKey;
    if (!orderId || !appKey || appKey === ALL_GAMES_APP_KEY) return;

    setCancelRequesting(true);
    try {
      const res = await bmallOrderApi.cancelOrder({
        appKey,
        orderNo: orderId,
      });
      if (res.success) {
        if (orderPendingCancel?.items?.[0]?.product) {
          const product = orderPendingCancel.items[0].product;
          const savedRoleSelection = getGameRoleSelection(appKey);
          trackStoreIapFail(
            product,
            orderPendingCancel.paymentType,
            orderPendingCancel.environment,
            'User cancelled order from order list',
            {
              sdkId: savedRoleSelection?.sdkId || user?.sdkId || '',
              serverChannel: orderPendingCancel.gameServerChannel,
              gameUserId: orderPendingCancel.gameUserId || orderPendingCancel.userId,
              platform: orderPendingCancel.platform,
              mailId: orderPendingCancel.userEmail,
            }
          );
        }
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
    if (getEffectiveOrderStatus(order) !== OrderStatus.PENDING) {
      requestOrdersRefresh();
      return;
    }

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
      const orderExt = order as Order & { platform?: string };
      const paymentPlatform =
        normalizeOrderPaymentPlatform(latestOrder.platform) ||
        normalizeOrderPaymentPlatform(orderExt.platform) ||
        normalizeOrderPaymentPlatform(user?.platform) ||
        normalizeOrderPaymentPlatform(detectCurrentPlatform());

      if (!paymentPlatform) {
        messageStore.show(t('history.payConfigError'));
        return;
      }

      const createOrderResult = await bmallOrderApi.createOrder({
        appKey,
        platform: paymentPlatform,
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
      // console.error('支付配置错误，未返回可用支付参数:', paymentData);
    } catch (error) {
      // console.error('重新支付失败:', error);
      messageStore.show(t('history.payRetryFailed'));
    } finally {
      setPayingOrderId(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    const effectiveStatus = getEffectiveOrderStatus(order);
    if (filterStatus === 'all') return true;
    if (filterStatus === 'inProgress') {
      return effectiveStatus === OrderStatus.PENDING || effectiveStatus === OrderStatus.PAID;
    }
    if (filterStatus === 'completed') {
      // 已完成：玩家成功支付并成功下发的订单状态
      return effectiveStatus === OrderStatus.COMPLETED;
    }
    if (filterStatus === 'closed') {
      // 已关闭：玩家拉起支付但后续关闭/退出支付的订单状态
      return effectiveStatus === OrderStatus.CANCELLED;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PAGE_SIZE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const shouldPaginateOrders = isDesktop && !isTouchLandscape;
  const paginatedOrders = filteredOrders.slice(
    (currentPageSafe - 1) * ORDERS_PAGE_SIZE,
    currentPageSafe * ORDERS_PAGE_SIZE
  );
  const visibleOrders = shouldPaginateOrders ? paginatedOrders : filteredOrders;
  const showPagination = shouldPaginateOrders && filteredOrders.length > ORDERS_PAGE_SIZE;
  const paginationItems = getPaginationItems(currentPageSafe, totalPages);
  const paginationTotalText = locale.startsWith('zh') ? `共${totalPages}页` : `${totalPages} pages`;
  const paginationJumpPrefix = locale.startsWith('zh') ? '到第' : 'Go to';
  const paginationJumpSuffix = locale.startsWith('zh') ? '页' : 'page';
  const paginationJumpAriaLabel = locale.startsWith('zh') ? '跳转页码' : 'Go to page';

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleFilterStatusSelect = (nextStatus: FilterStatus) => {
    setFilterStatus(nextStatus);
    setCurrentPage(1);
    setJumpPageInput('');
    requestOrdersRefresh();
  };

  const handlePageChange = (nextPage: number) => {
    const boundedPage = Math.min(Math.max(nextPage, 1), totalPages);
    if (boundedPage === currentPageSafe) return;

    setCurrentPage(boundedPage);
    setJumpPageInput('');
    window.setTimeout(() => {
      historyPageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
  };

  const handleJumpPageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setJumpPageInput(event.target.value.replace(/\D/g, ''));
  };

  const handleJumpPageSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!jumpPageInput) return;

    const nextPage = Number(jumpPageInput);
    if (!Number.isFinite(nextPage)) return;
    handlePageChange(nextPage);
  };

  const handleJumpPageInputBlur = () => {
    if (!jumpPageInput) return;

    const nextPage = Number(jumpPageInput);
    if (!Number.isFinite(nextPage)) return;
    handlePageChange(nextPage);
  };

  useEffect(() => {
    const hasPendingOrders = filteredOrders.some(
      order => getEffectiveOrderStatus(order) === OrderStatus.PENDING
    );
    if (!hasPendingOrders) return;

    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [filteredOrders]);

  useEffect(() => {
    const newlyExpiredPendingOrders = orders.filter(order => {
      if (order.status !== OrderStatus.PENDING) return false;
      if (expiredPendingOrderRefreshRef.current.has(order.id)) return false;
      return getPendingAutoCancelUi(order).remainingSeconds <= 0;
    });

    if (newlyExpiredPendingOrders.length === 0) return;

    newlyExpiredPendingOrders.forEach(order => {
      expiredPendingOrderRefreshRef.current.add(order.id);
    });
    requestOrdersRefresh();
  }, [orders, nowTs]);

  return (
    <div className={styles.history} ref={historyPageRef}>
      {/* <div className={styles.historyPagePattern} aria-hidden>
        <HomeBackgroundPattern />
      </div> */}

      <div className={styles.filterSection}>
        {/* 移动端：顶部居中游戏筛选 */}
        <div className={styles.gameFilterBar}>
          <div
            className={`${styles.filterSectionInner} ${filterGameDropdownOpen ? styles.filterSectionInnerOpen : ''}`}
            ref={filterGameDropdownMobileRef}
          >
            <div className={styles.filterGameSelector}>
              <button
                type="button"
                className={styles.filterGameSelectorContent}
                onClick={() => setFilterGameDropdownOpen(!filterGameDropdownOpen)}
                aria-expanded={filterGameDropdownOpen}
              >
                <span className={styles.filterGameName}>
                  {getLocalizedGameName(selectedGameAppKey)}
                </span>
                <ChevronDownIcon
                  className={`${styles.filterDropdownIcon} ${filterGameDropdownOpen ? styles.filterDropdownIconOpen : ''}`}
                  color="#b5b5b5"
                />
              </button>
            </div>
            {filterGameDropdownOpen && (
              <div className={styles.filterDropdownList}>
                <button
                  type="button"
                  className={`${styles.filterDropdownItem} ${
                    selectedGameAppKey === ALL_GAMES_APP_KEY ? styles.filterDropdownItemActive : ''
                  }`}
                  onClick={() => handleFilterGameSelect(ALL_GAMES_APP_KEY)}
                >
                  {t('history.allGames')}
                </button>
                {games.map(game => (
                  <button
                    key={game.id}
                    type="button"
                    className={`${styles.filterDropdownItem} ${
                      selectedGameAppKey === game.appKey ? styles.filterDropdownItemActive : ''
                    }`}
                    onClick={() => handleFilterGameSelect(game.appKey)}
                  >
                    {getLocalizedGameName(game.appKey)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tab 条：PC 左侧橙条 + Tab，右侧返回专区 + 游戏下拉 */}
        <div className={styles.filterTabsBar}>
          <div className={styles.filterSectionInner}>
            <div className={styles.filterTabsRow}>
              <div className={styles.filterTabsLeft}>
                <div className={styles.filterTabs}>
                  <button
                    type="button"
                    className={`${styles.filterTab} ${filterStatus === 'all' ? styles.filterTabActive : ''}`}
                    onClick={() => handleFilterStatusSelect('all')}
                  >
                    {t('history.filter.all')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterTab} ${filterStatus === 'inProgress' ? styles.filterTabActive : ''}`}
                    onClick={() => handleFilterStatusSelect('inProgress')}
                  >
                    {t('history.filter.inProgress')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterTab} ${filterStatus === 'completed' ? styles.filterTabActive : ''}`}
                    onClick={() => handleFilterStatusSelect('completed')}
                  >
                    {t('history.filter.completed')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterTab} ${filterStatus === 'closed' ? styles.filterTabActive : ''}`}
                    onClick={() => handleFilterStatusSelect('closed')}
                  >
                    {t('history.filter.closed')}
                  </button>
                </div>
              </div>

              <div className={styles.filterTabsRight}>
                <button
                  type="button"
                  className={styles.backToProductsButton}
                  onClick={handleBackToProducts}
                >
                  <img src={homeIcon} alt="" className={styles.backToProductsIcon} />
                  <span>{t('history.backToGameZone')}</span>
                </button>
                <div
                  className={`${styles.filterGameSelectorDesktop} ${filterGameDropdownOpen ? styles.filterSectionInnerOpen : ''}`}
                  ref={filterGameDropdownDesktopRef}
                >
                  <button
                    type="button"
                    className={styles.filterGameSelectorContent}
                    onClick={() => setFilterGameDropdownOpen(!filterGameDropdownOpen)}
                    aria-expanded={filterGameDropdownOpen}
                  >
                    <span className={styles.filterGameName}>
                      {getLocalizedGameName(selectedGameAppKey)}
                    </span>
                    <ChevronDownIcon
                      className={`${styles.filterDropdownIcon} ${filterGameDropdownOpen ? styles.filterDropdownIconOpen : ''}`}
                      color="#585858"
                    />
                  </button>
                  {filterGameDropdownOpen && (
                    <div className={styles.filterDropdownList}>
                      <button
                        type="button"
                        className={`${styles.filterDropdownItem} ${
                          selectedGameAppKey === ALL_GAMES_APP_KEY
                            ? styles.filterDropdownItemActive
                            : ''
                        }`}
                        onClick={() => handleFilterGameSelect(ALL_GAMES_APP_KEY)}
                      >
                        {t('history.allGames')}
                      </button>
                      {games.map(game => (
                        <button
                          key={game.id}
                          type="button"
                          className={`${styles.filterDropdownItem} ${
                            selectedGameAppKey === game.appKey
                              ? styles.filterDropdownItemActive
                              : ''
                          }`}
                          onClick={() => handleFilterGameSelect(game.appKey)}
                        >
                          {getLocalizedGameName(game.appKey)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.historyContent}>
        <div className={styles.ordersList}>
          {loading ? (
            <div className={`${styles.empty} ${styles.emptyLoading}`}>
              <Loading />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyCard}>
                <img src={emptyOrderImg} alt="" className={styles.emptyImage} aria-hidden />
                <p className={styles.emptyText}>{t('history.empty')}</p>
              </div>
            </div>
          ) : (
            <>
              {visibleOrders.map(order => {
                const firstItem = order.items[0];
                const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
                const pendingAutoCancelUi =
                  order.status === OrderStatus.PENDING ? getPendingAutoCancelUi(order) : null;
                const effectiveStatus = getEffectiveOrderStatus(order);
                const orderExt = order as Order & { platform?: string; gameServerChannel?: string };
                const platformLine = formatOrderPlatformLine(orderExt);
                const orderItemDisplayImage = getOrderItemDisplayImage(firstItem.product);

                return (
                  <div key={order.id} className={styles.orderCard}>
                    {/* 订单头部 */}
                    <div className={styles.orderHeader}>
                      <span className={styles.orderId}>
                        {t('paymentSuccess.orderId')} {order.id}
                      </span>
                      <span className={styles.orderStatus}>
                        {getStatusText(effectiveStatus, order)}
                      </span>
                    </div>

                    {/* 订单内容 */}
                    <div className={styles.orderContent}>
                      {/* <img
                    src={logoTextImg}
                    alt=""
                    className={styles.orderWatermark}
                    aria-hidden
                  /> */}
                      {/* 左侧：商品图标 */}
                      <div className={styles.orderItemIcon}>
                        <div className={styles.iconWrapper}>
                          {orderItemDisplayImage ? (
                            <div className={styles.orderImageContainer}>
                              <div className={styles.voucherImageBg} aria-hidden />
                              <img
                                src={orderItemDisplayImage}
                                alt={firstItem.product.name}
                                className={styles.voucherImageMain}
                              />
                            </div>
                          ) : (
                            // 没有图片时的占位符
                            <div className={styles.productPlaceholder}>{/* 商品图片占位符 */}</div>
                          )}
                        </div>
                      </div>

                      {/* 右侧：商品详情 */}
                      <div className={styles.orderItemDetails}>
                        <div className={styles.itemName}>{firstItem.product.name}</div>
                        <div className={styles.orderTime}>
                          {t('history.orderTime')} {formatDate(order.createdAt)}
                        </div>
                        <div className={styles.itemInfo}>
                          <span className={styles.voucherTag}>
                            {getCategoryName(firstItem.product.categoryId)}
                          </span>
                        </div>
                        {platformLine && <div className={styles.platformInfo}>{platformLine}</div>}
                      </div>
                      <div className={styles.orderAmountSummary}>
                        {platformLine && (
                          <div className={styles.orderAmountPlatform}>{platformLine}</div>
                        )}
                        <div className={styles.orderAmountValue}>
                          <span className={styles.orderAmountAmount}>
                            {formatOrderAmount(order.totalAmount, order.currency)}
                          </span>
                          {order.currency ? (
                            <span className={styles.orderAmountCurrency}>{order.currency}</span>
                          ) : null}
                        </div>
                        <div className={styles.orderAmountQuantity}>
                          {formatTotalQuantity(totalQuantity)}
                        </div>
                      </div>
                    </div>
                    {effectiveStatus === OrderStatus.PENDING && (
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
                            !pendingAutoCancelUi?.showCountdownAndCancel
                              ? styles.pendingActionsPayOnly
                              : ''
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
                            {payingOrderId === order.id
                              ? t('common.loading')
                              : t('history.payOrder')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {showPagination && (
                <div className={styles.pagination}>
                  <button
                    type="button"
                    className={`${styles.paginationControl} ${styles.paginationArrowButton}`}
                    onClick={() => handlePageChange(currentPageSafe - 1)}
                    disabled={currentPageSafe <= 1}
                    aria-label={t('history.previousPage')}
                  >
                    <img
                      src={paginationArrowImg}
                      alt=""
                      className={`${styles.paginationArrowIcon} ${styles.paginationArrowIconPrev}`}
                      aria-hidden="true"
                    />
                    <span>{t('history.previousPage')}</span>
                  </button>
                  {paginationItems.map(item => {
                    if (typeof item !== 'number') {
                      return (
                        <span key={item} className={styles.paginationEllipsis}>
                          ...
                        </span>
                      );
                    }

                    const isActive = item === currentPageSafe;
                    return (
                      <button
                        key={item}
                        type="button"
                        className={`${styles.paginationControl} ${styles.paginationPageButton} ${
                          isActive ? styles.paginationPageButtonActive : ''
                        }`}
                        onClick={() => handlePageChange(item)}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={`Page ${item}`}
                      >
                        {item}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`${styles.paginationControl} ${styles.paginationArrowButton}`}
                    onClick={() => handlePageChange(currentPageSafe + 1)}
                    disabled={currentPageSafe >= totalPages}
                    aria-label={t('history.nextPage')}
                  >
                    <span>{t('history.nextPage')}</span>
                    <img
                      src={paginationArrowImg}
                      alt=""
                      className={styles.paginationArrowIcon}
                      aria-hidden="true"
                    />
                  </button>
                  <span className={styles.paginationTotal}>{paginationTotalText}</span>
                  <form className={styles.paginationJump} onSubmit={handleJumpPageSubmit}>
                    <span className={styles.paginationJumpText}>{paginationJumpPrefix}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className={styles.paginationJumpInput}
                      value={jumpPageInput}
                      onChange={handleJumpPageInputChange}
                      onBlur={handleJumpPageInputBlur}
                      aria-label={paginationJumpAriaLabel}
                    />
                    <span className={styles.paginationJumpText}>{paginationJumpSuffix}</span>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <AlertModal
        isOpen={cancelDialogOpen}
        onClose={closeCancelOrderDialog}
        title={t('history.cancelOrderConfirmTitle')}
        confirmText={
          cancelRequesting ? t('common.loading') : t('history.cancelOrderConfirmPrimary')
        }
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
