import { thinkingData } from './thinkingData';
import { userStore } from '@/store/userStore';
import { Product } from '@/types';
import { PAYMENT_TYPES, STORAGE_KEYS } from './constants';
import { storage } from './index';
import { config } from './config';

// 记录已上报登录的标识（按 token 维度存储，每个 token 下有多个 ss_app_id 组合），支持持久化
const SDK_LOGIN_REPORTED_STORAGE_KEY = STORAGE_KEYS.SDK_LOGIN_REPORTED_KEYS;

interface AnalyticsContext {
  serverChannel?: string | number | null;
  gameUserId?: string | null;
  sdkId?: string | null;
  mailId?: string | null;
  country?: string | null;
  platform?: string | null;
  ip?: string | null;
  isGameRedirect?: boolean;
  environment?: string | null;
}

interface LoginTrackOptions {
  ssAppId?: string | null;
  accountId?: string | null;
  mailId?: string | null;
  country?: string | null;
  platform?: string | null;
  ip?: string | null;
  isGameRedirect?: boolean;
  environment?: string | null;
}

const GAME_ID_TO_APP_KEY: Record<string, string> = {
  'bam-bam-squad': 'f6594168ce3a9cc57ab7ed74426e25e1',
  'oopsie': '45a56d38bbdd60353438aa25d1ccff20',
  'oopsie-croco': '45a56d38bbdd60353438aa25d1ccff20',
};

export const resolveAnalyticsServerChannel = (channel?: string | number | null): number | undefined => {
  if (channel === undefined || channel === null) return undefined;
  if (typeof channel === 'number') {
    return Number.isFinite(channel) ? channel : undefined;
  }

  const value = String(channel).trim();
  if (!value) return undefined;

  const exactNumber = Number(value);
  if (Number.isFinite(exactNumber)) {
    return exactNumber;
  }

  const normalized = value.toUpperCase().replace(/\s+/g, '');
  const prefixedMatch = normalized.match(/^(GL|TK)[-_]?(\d+)$/);
  if (prefixedMatch) {
    const [, prefix, rawNumber] = prefixedMatch;
    const displayNumber = Number(rawNumber);
    if (Number.isFinite(displayNumber)) {
      return prefix === 'TK' ? displayNumber + 123 : displayNumber;
    }
  }

  const matched = value.match(/\d+/);
  if (!matched) return undefined;

  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getCurrentAppKeyForAnalytics = (): string | undefined => {
  const stored = storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined) || undefined;
  if (stored) return stored;

  if (typeof window === 'undefined') return undefined;
  const match = window.location.pathname.match(/^\/game\/([^/]+)/);
  if (!match) return undefined;
  return GAME_ID_TO_APP_KEY[match[1]];
};

const isSandboxLikeHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host.includes('localhost') || host.includes('127.0.0.1') || host.includes('test') || host.includes('dgtverse');
};

export const resolveAnalyticsEnvironment = (...candidates: Array<string | null | undefined>): 'production' | 'sandbox' => {
  const raw = candidates.find((value) => value && String(value).trim());
  const normalized = raw ? String(raw).trim().toLowerCase() : '';

  if (['sandbox', 'test', 'testing', 'demo', 'staging'].includes(normalized)) {
    return 'sandbox';
  }
  if (['production', 'prod', 'live'].includes(normalized)) {
    return 'production';
  }

  if (config.envStage !== 'prod' || config.airwallexEnv === 'demo' || isSandboxLikeHost()) {
    return 'sandbox';
  }

  return 'production';
};

export const getAnalyticsEnvironment = (): 'production' | 'sandbox' => resolveAnalyticsEnvironment();

const ensureThinkingDataReady = (): boolean => {
  const appKey = getCurrentAppKeyForAnalytics();
  if (!appKey) {
    return thinkingData.isInitialized();
  }

  const selection = userStore.getGameRoleSelection(appKey);
  if (!selection?.ss_app_id || !selection?.ss_url) {
    return thinkingData.isGameInitialized(appKey);
  }

  const initSuccess = thinkingData.initForGame(appKey, {
    appId: selection.ss_app_id,
    serverUrl: selection.ss_url,
  });

  if (!initSuccess) return false;

  thinkingData.setCurrentGame(appKey);
  const user = userStore.getUser();
  if (user?.sdkId) {
    thinkingData.login(user.characterName || user.sdkId);
    thinkingData.userSet({
      username: user.username || user.gameAccount || '',
      gameAccount: user.gameAccount || '',
      nickName: user.username || '',
      gameUserId: user.characterName || '',
      gameServerChannel: user.gameServer || '',
      platform: user.platform || '',
    });
  }

  return true;
};

const resolveMailId = (mailId?: string | null): string => {
  const explicit = mailId?.trim();
  if (explicit) return explicit;

  const user = userStore.getUser();
  return (
    user?.email ||
    user?.gameAccount ||
    user?.username ||
    ''
  );
};

/**
 * 加载指定 token 的已上报记录
 * @param token 用户 token
 * @returns 已上报的 key 数组
 */
const loadReportedKeys = (token: string): string[] => {
  if (!token) return [];
  try {
    // 存储结构：{ [token]: string[] }
    const tokenKeys = storage.get<Record<string, string[]>>(SDK_LOGIN_REPORTED_STORAGE_KEY, {}) || {};
    return tokenKeys[token] || [];
  } catch {
    return [];
  }
};

/**
 * 保存指定 token 的已上报记录
 * @param token 用户 token
 * @param keys 已上报的 key 数组
 */
const saveReportedKeys = (token: string, keys: Set<string>) => {
  if (!token) return;
  try {
    // 存储结构：{ [token]: string[] }
    const tokenKeys = storage.get<Record<string, string[]>>(SDK_LOGIN_REPORTED_STORAGE_KEY, {}) || {};
    tokenKeys[token] = Array.from(keys);
    storage.set(SDK_LOGIN_REPORTED_STORAGE_KEY, tokenKeys);
  } catch (error) {
    console.error('Persist sdk login keys failed:', error);
  }
};

/**
 * 工具：按 token + ss_app_id 维度，避免一次登录里同一个数数应用重复上报登录事件
 * @param token 用户 token（必需，用于区分不同登录）
 * @param options 登录事件补充字段
 */
export const trackStoreSdkLoginOnce = (
  token?: string,
  options: LoginTrackOptions = {}
): boolean => {
  if (!token) {
    console.warn('trackStoreSdkLoginOnce: token 未提供，无法记录上报状态');
    return false;
  }

  const ssAppId = options.ssAppId?.trim();
  if (!ssAppId) {
    console.warn('trackStoreSdkLoginOnce: ss_app_id 未提供，跳过 store_sdk_login 事件上报');
    return false;
  }
  
  // 从存储中加载当前 token 的已上报记录
  const reportedKeysArray = loadReportedKeys(token);
  const sdkLoginReportedKeys = new Set<string>(reportedKeysArray);
  
  const key = `login|${ssAppId}`;
  if (sdkLoginReportedKeys.has(key)) return true;
  
  const tracked = trackStoreSdkLogin(options);
  if (!tracked) return false;

  sdkLoginReportedKeys.add(key);
  saveReportedKeys(token, sdkLoginReportedKeys);
  return true;
};

/**
 * 获取公共事件属性
 * 包含所有事件共通的参数：
 * - account_id: SDK账号
 * - mail_id: 登录邮箱
 * - #country_code: 国家地区代码
 * - #os: 操作系统
 * - #ip: IP地址
 * - is_game_redirect: 是否游戏内跳转
 * - environment: sandbox / production
 * - server_channel: 区服id
 * - #account_id: 账户id/角色id
 */
const getCommonProperties = (context: AnalyticsContext = {}) => {
  const user = userStore.getUser();
  const params = new URLSearchParams(window.location.search);
  
  // 判断是否游戏内跳转（通过URL参数判断，如果有特定参数则认为是游戏内跳转）
  const isGameRedirect = context.isGameRedirect ?? (
    user?.quickLogin === true || params.has('from_app') || params.has('game_redirect') || false
  );
  const serverChannel = resolveAnalyticsServerChannel(context.serverChannel ?? user?.gameServer);
  const sdkAccountId = context.sdkId !== undefined ? (context.sdkId || '') : (user?.sdkId || '');
  
  const properties: Record<string, any> = {
    account_id: sdkAccountId, // SDK账号，未获取到时留空
    mail_id: resolveMailId(context.mailId),
    is_game_redirect: isGameRedirect,
    environment: resolveAnalyticsEnvironment(context.environment),
  };

  if (serverChannel !== undefined) {
    properties.server_channel = serverChannel;
  }
  
  // 设置 # 开头的系统属性
  const country = context.country ?? user?.country;
  if (country) {
    properties['#country_code'] = country;
  }
  const platform = context.platform ?? user?.platform;
  if (platform) {
    properties['#os'] = platform;
  }
  const ip = context.ip ?? user?.ip;
  if (ip) {
    properties['#ip'] = ip;
  }
  
  return properties;
};

/**
 * 解析支付方式
 * 若调用方显式传入 paymentType，则直接使用传入值
 * 否则返回 undefined（不再根据用户状态推断）
 */
const resolvePaymentType = (paymentType?: string) => {
  return paymentType;
};

/**
 * 从商品信息中提取 product_id 和 iap
 * product_id 格式：com.oopscroco.60diamonds
 * iap 格式：60diamonds
 */
const extractProductInfo = (product: Product) => {
  // product_id 优先使用后端商品字段 iap_id（如 com.oopscroco.60diamonds）
  let productId = product.iap_id || product.id;
  let iap = product.iap || product.id;
  
  // 尝试从商品ID中提取 iap（去掉前缀）
  const parts = productId.split('.');
  if (!product.iap && parts.length > 1) {
    iap = parts[parts.length - 1];
  } else if (!product.iap && parts.length <= 1) {
    // 如果不符合格式，使用商品ID作为 iap
    iap = productId;
    // 构造标准的 product_id 格式
    productId = `com.oopscroco.${iap}`;
  }
  
  return { product_id: productId, iap };
};

/**
 * 商城登录成功事件
 * 商城打开登录账号、或从app跳转到商城自动登录后上报
 * 必需参数：
 * - account_id: SDK账号ID（用户详情接口返回的sdk_id）
 * - mail_id: 登录邮箱
 * - #country_code: 国家代码（用户详情接口返回的country）
 * - #os: 操作系统（用户详情接口返回的platform）
 * - #ip: IP地址（用户详情接口返回的ip）
 * - is_game_redirect: 是否游戏内跳转
 * - environment: sandbox / production
 * @param options 登录事件补充字段
 */
export const trackStoreSdkLogin = (options: LoginTrackOptions = {}): boolean => {
  // 检查数数SDK是否已初始化
  if (!ensureThinkingDataReady()) {
    console.warn('数数SDK未初始化，跳过 store_sdk_login 事件上报');
    return false;
  }

  const user = userStore.getUser();
  const params = new URLSearchParams(window.location.search);
  const isGameRedirect = options.isGameRedirect ?? (
    user?.quickLogin === true || params.has('from_app') || params.has('game_redirect') || false
  );
  
  const properties: Record<string, any> = {
    account_id: options.accountId ?? '',
    mail_id: resolveMailId(options.mailId),
    is_game_redirect: isGameRedirect,
    environment: resolveAnalyticsEnvironment(options.environment),
  };
  
  // 登录事件只使用本次显式传入的角色详情字段；未拿到时留空，避免误用历史角色平台。
  if (options.country) {
    properties['#country_code'] = options.country;
  }
  if (options.platform) {
    properties['#os'] = options.platform;
  }
  if (options.ip) {
    properties['#ip'] = options.ip;
  }
  
  thinkingData.track('store_sdk_login', properties);
  return true;
};

/**
 * 商城选择角色事件
 * 用户登录商城后选择完角色、或从app跳转到商城自动选择完角色后上报
 * 必需参数：
 * - account_id: SDK账号（用户详情接口返回的sdk_id）
 * - mail_id: 登录邮箱
 * - #country_code: 国家地区代码（用户详情接口返回的country）
 * - #os: 操作系统（用户详情接口返回的platform）
 * - #ip: IP地址（用户详情接口返回的ip）
 * - is_game_redirect: 是否游戏内跳转
 * - environment: sandbox / production
 * - server_channel: 区服id
 * - #account_id: 账户id/角色id（用户详情接口返回的game_user_id）
 * @param serverChannel 区服ID
 * @param gameUserId 游戏用户ID/角色ID（用于#account_id）
 */
export const trackStoreRoleSelect = (serverChannel?: string | number, gameUserId?: string) => {
  // 检查数数SDK是否已初始化
  if (!ensureThinkingDataReady()) {
    console.warn('数数SDK未初始化，跳过 store_role_select 事件上报');
    return;
  }

  const user = userStore.getUser();
  const params = new URLSearchParams(window.location.search);
  const isGameRedirect = user?.quickLogin === true || params.has('from_app') || params.has('game_redirect') || false;
  const resolvedServerChannel = resolveAnalyticsServerChannel(serverChannel ?? user?.gameServer);
  
  const properties: Record<string, any> = {
    account_id: user?.sdkId || '', // SDK账号
    mail_id: resolveMailId(),
    is_game_redirect: isGameRedirect,
    environment: getAnalyticsEnvironment(),
  };

  if (resolvedServerChannel !== undefined) {
    properties.server_channel = resolvedServerChannel;
  }
  
  // 设置 # 开头的系统属性
  if (user?.country) {
    properties['#country_code'] = user.country;
  }
  if (user?.platform) {
    properties['#os'] = user.platform;
  }
  if (user?.ip) {
    properties['#ip'] = user.ip;
  }
  
  thinkingData.track('store_role_select', properties);
};

// 记录已上报内购曝光事件的标识（按 token 维度存储，每个 token 下有多个 product_id），支持持久化
const IAP_SHOW_REPORTED_STORAGE_KEY = STORAGE_KEYS.IAP_SHOW_REPORTED_KEYS;

/**
 * 加载指定 token 的已上报内购曝光记录
 * @param token 用户 token
 * @returns 已上报的 key 数组
 */
const loadIapShowReportedKeys = (token: string): string[] => {
  if (!token) return [];
  try {
    // 存储结构：{ [token]: string[] }
    const tokenKeys = storage.get<Record<string, string[]>>(IAP_SHOW_REPORTED_STORAGE_KEY, {}) || {};
    return tokenKeys[token] || [];
  } catch (error) {
    console.error('Load iap show reported keys failed:', error);
    return [];
  }
};

/**
 * 保存指定 token 的已上报内购曝光记录
 * @param token 用户 token
 * @param keys 已上报的 key 数组
 */
const saveIapShowReportedKeys = (token: string, keys: Set<string>): void => {
  if (!token) return;
  try {
    // 存储结构：{ [token]: string[] }
    const tokenKeys = storage.get<Record<string, string[]>>(IAP_SHOW_REPORTED_STORAGE_KEY, {}) || {};
    tokenKeys[token] = Array.from(keys);
    storage.set(IAP_SHOW_REPORTED_STORAGE_KEY, tokenKeys);
  } catch (error) {
    console.error('Persist iap show reported keys failed:', error);
  }
};

/**
 * 商城的内购按钮曝光事件
 * 用户在看到商品按钮（不用点进去，仅曝光）时上报
 * 一次登录中，一个商品只触发一次
 * 必需参数：
 * - account_id: SDK账号（用户详情接口返回的sdk_id）
 * - mail_id: 登录邮箱
 * - #country_code: 国家地区代码（用户详情接口返回的country）
 * - #os: 操作系统（用户详情接口返回的platform）
 * - #ip: IP地址（用户详情接口返回的ip）
 * - is_game_redirect: 是否游戏内跳转
 * - server_channel: 区服id
 * - #account_id: 账户id/角色id（用户详情接口返回的game_user_id）
 * - product_id: 商品id
 * - iap: iap（商品列表详情返回的iap字段）
 * - price: 分成前价格
 * - currency: 货币单位
 * - environment: sandbox / production
 */
export const trackStoreIapShow = (product: Product): boolean => {
  // 检查数数SDK是否已初始化
  if (!ensureThinkingDataReady()) {
    console.warn('数数SDK未初始化，跳过 store_iap_show 事件上报', {
      productName: product.name,
      hasUser: !!userStore.getUser(),
    });
    return false;
  }

  const user = userStore.getUser();
  const token = user?.token;
  
  // 必须有 token 才能记录上报状态
  if (!token) {
    console.warn('trackStoreIapShow: token 未提供，无法记录上报状态，商品：', product.name);
    return false;
  }
  
  // 检查是否已获取用户详情（必须要有角色信息，说明已经调用过用户详情接口）
  // 用户详情接口会设置 characterName（game_user_id）、sdkId、country、platform、ip 等字段
  const commonProperties = getCommonProperties();
  if (!user?.characterName || commonProperties.server_channel === undefined) {
    console.warn('用户详情未获取完成（未选择角色），跳过 store_iap_show 事件上报，商品：', product.name);
    return false;
  }
  
  // 提取 product_id 和 iap
  // 优先使用 product.iap（商品列表详情返回的iap字段），如果没有则使用 extractProductInfo 的结果
  const { product_id, iap: extractedIap } = extractProductInfo(product);
  const iap = product.iap || extractedIap;
  
  // 构建去重key：token + product_id（使用提取后的 product_id）
  const reportedKey = `${token}|${user?.characterName || ''}|${commonProperties.server_channel}|${product_id}`;
  
  // 从存储中加载当前 token 的已上报记录
  const reportedKeysArray = loadIapShowReportedKeys(token);
  const iapShowReportedKeys = new Set<string>(reportedKeysArray);
  
  // 如果已经上报过，直接返回
  if (iapShowReportedKeys.has(reportedKey)) {
    return true;
  }
  
  const properties: Record<string, any> = {
    ...commonProperties,
    product_id, // 商品id
    iap, // iap（商品列表详情返回的iap字段）
    price: product.price, // 分成前价格
    currency: product.currency, // 货币单位
  };
  
  thinkingData.track('store_iap_show', properties);
  
  // 记录已上报
  iapShowReportedKeys.add(reportedKey);
  saveIapShowReportedKeys(token, iapShowReportedKeys);
  return true;
};

/**
 * 商城内购点击事件
 * 在点击内购项，弹出的弹窗界面，点支付时上报
 * 必需参数：
 * - account_id: SDK账号（用户详情接口返回的sdk_id）
 * - mail_id: 登录邮箱
 * - #country_code: 国家地区代码（用户详情接口返回的country）
 * - #os: 操作系统（用户详情接口返回的platform）
 * - #ip: IP地址（用户详情接口返回的ip）
 * - is_game_redirect: 是否游戏内跳转
 * - server_channel: 区服id
 * - #account_id: 账户id/角色id（用户详情接口返回的game_user_id）
 * - product_id: 商品id
 * - iap: iap（商品列表详情返回的iap字段）
 * - price: 分成前价格
 * - currency: 货币单位
 * - payment_type: 支付方式（stripe_store | stripe_h5store | airwallex_store | airwallex_h5store 等）
 * - environment: sandbox / production
 */
export const trackStoreIapClick = (
  product: Product,
  paymentType?: string,
  environment: string = getAnalyticsEnvironment()
): Promise<boolean> => {
  // 检查数数SDK是否已初始化
  if (!ensureThinkingDataReady()) {
    console.warn('数数SDK未初始化，跳过 store_iap_click 事件上报');
    return Promise.resolve(false);
  }

  // 提取 product_id 和 iap
  // 优先使用 product.iap（商品列表详情返回的iap字段），如果没有则使用 extractProductInfo 的结果
  const { product_id, iap: extractedIap } = extractProductInfo(product);
  const iap = product.iap || extractedIap;
  
  // 使用传入的 payment_type（如果未传入则为 undefined）
  const resolvedPaymentType = resolvePaymentType(paymentType);
  
  const commonProperties = getCommonProperties();
  const user = userStore.getUser();
  if (!user?.characterName || commonProperties.server_channel === undefined) {
    console.warn('用户详情未获取完成（缺少角色或区服），跳过 store_iap_click 事件上报，商品：', product.name);
    return Promise.resolve(false);
  }

  const properties = {
    ...commonProperties,
    product_id, // 商品id
    iap, // iap（商品列表详情返回的iap字段）
    price: product.price, // 分成前价格
    currency: product.currency, // 货币单位
    ...(resolvedPaymentType && { payment_type: resolvedPaymentType }), // 支付方式（仅在有值时添加）
    environment: resolveAnalyticsEnvironment(environment),
  };
  
  thinkingData.track('store_iap_click', properties);
  
  // 返回 Promise，确保事件上报完成后再继续
  // ThinkingData SDK 内部使用 sendBeacon 或其他异步方式发送数据
  // 使用 setTimeout 给 SDK 一些时间来完成数据发送
  return new Promise<void>((resolve) => {
    // 延迟一小段时间，确保事件能够被发送
    // 通常 100-200ms 足够 SDK 完成 sendBeacon 的调用
    setTimeout(() => {
      resolve();
    }, 150);
  }).then(() => true);
};

/**
 * 商城支付成功事件
 * 用户在商城点击内购，在拉起支付并支付成功时上报
 */
export const trackStoreIapSuccess = (
  product: Product,
  paymentType?: string,
  environment: string = getAnalyticsEnvironment(),
  context?: AnalyticsContext
): boolean => {
  // 检查数数SDK是否已初始化
  if (!ensureThinkingDataReady()) {
    console.warn('数数SDK未初始化，跳过 store_iap_success 事件上报');
    return false;
  }

  const { product_id, iap: extractedIap } = extractProductInfo(product);
  const iap = product.iap || extractedIap;
  const resolvedPaymentType = resolvePaymentType(paymentType);
  
  const commonProperties = getCommonProperties(context);
  const user = userStore.getUser();
  if (!user?.characterName || commonProperties.server_channel === undefined) {
    console.warn('用户详情未获取完成（缺少角色或区服），跳过 store_iap_success 事件上报，商品：', product.name);
    return false;
  }

  const properties = {
    ...commonProperties,
    product_id, // 商品id
    iap, 
    price: product.price,
    currency: product.currency,
    ...(resolvedPaymentType && { payment_type: resolvedPaymentType }), // 支付方式（仅在有值时添加）
    environment: resolveAnalyticsEnvironment(environment), // 环境
  };
  
  thinkingData.track('store_iap_success', properties);
  return true;
};

/**
 * 商城支付失败事件
 * 用户在商城点击内购，在拉起支付并支付失败时上报
 */
export const trackStoreIapFail = (
  product: Product,
  paymentType: string | undefined,
  environment: string = getAnalyticsEnvironment(),
  failReason: string,
  context?: AnalyticsContext
): boolean => {
  // 检查数数SDK是否已初始化
  if (!ensureThinkingDataReady()) {
    console.warn('数数SDK未初始化，跳过 store_iap_fail 事件上报');
    return false;
  }

  const { product_id, iap: extractedIap } = extractProductInfo(product);
  const iap = product.iap || extractedIap;
  const resolvedPaymentType = resolvePaymentType(paymentType);
  
  const user = userStore.getUser();
  const commonProperties = getCommonProperties(context);
  if (!user?.characterName || commonProperties.server_channel === undefined) {
    console.warn('用户详情未获取完成（缺少角色或区服），跳过 store_iap_fail 事件上报，商品：', product.name);
    return false;
  }

  const properties = {
    ...commonProperties,
    product_id,
    iap,
    price: product.price,
    currency: product.currency,
    ...(resolvedPaymentType && { payment_type: resolvedPaymentType }), // 支付方式（仅在有值时添加）
    environment: resolveAnalyticsEnvironment(environment),
    fail_reason: failReason,
  };
  
  thinkingData.track('store_iap_fail', properties);
  return true;
};

export const trackStoreRewardCode = (
  redeemCode: string,
  options: { gameUserId?: string; rewardCodeType?: number },
  context?: AnalyticsContext
): boolean => {
  if (!ensureThinkingDataReady()) {
    console.warn('数数SDK未初始化，跳过 store_reward_code 事件上报');
    return false;
  }

  const user = userStore.getUser();
  const commonProperties = getCommonProperties(context);
  if (!user?.characterName || commonProperties.server_channel === undefined) {
    console.warn('用户详情未获取完成（缺少角色或区服），跳过 store_reward_code 事件上报');
    return false;
  }

  const properties = {
    ...commonProperties,
    reward_code: redeemCode,
    ...(options.gameUserId && { game_user_id: options.gameUserId }),
    ...(options.rewardCodeType !== undefined && { reward_code_type: options.rewardCodeType }),
  };

  thinkingData.track('store_reward_code', properties);
  return true;
};
