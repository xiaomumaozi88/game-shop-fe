import { thinkingData } from './thinkingData';
import { userStore } from '@/store/userStore';
import { Product } from '@/types';
import { PAYMENT_TYPES, STORAGE_KEYS } from './constants';
import { storage } from './index';

// 记录已上报登录的标识（按 token 维度存储，每个 token 下有多个 appKey+token 的组合），支持持久化
const SDK_LOGIN_REPORTED_STORAGE_KEY = STORAGE_KEYS.SDK_LOGIN_REPORTED_KEYS;

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
 * 工具：按 appKey+token 维度，避免重复上报登录事件
 * @param appKey 游戏 appKey
 * @param accountId 账号ID（可选）
 * @param token 用户 token（必需，用于区分不同登录）
 */
export const trackStoreSdkLoginOnce = (appKey: string | undefined, accountId?: string, token?: string) => {
  if (!token) {
    console.warn('trackStoreSdkLoginOnce: token 未提供，无法记录上报状态');
    return;
  }
  
  // 从存储中加载当前 token 的已上报记录
  const reportedKeysArray = loadReportedKeys(token);
  const sdkLoginReportedKeys = new Set<string>(reportedKeysArray);
  
  const key = `${appKey || 'unknown'}|${token}`;
  if (sdkLoginReportedKeys.has(key)) return;
  
  trackStoreSdkLogin(accountId);
  sdkLoginReportedKeys.add(key);
  saveReportedKeys(token, sdkLoginReportedKeys);
};

/**
 * 获取公共事件属性
 * 包含所有事件共通的参数：
 * - account_id: SDK账号
 * - #country_code: 国家地区代码
 * - #os: 操作系统
 * - #ip: IP地址
 * - is_game_redirect: 是否游戏内跳转
 * - server_channel: 区服id
 * - #account_id: 账户id/角色id
 */
const getCommonProperties = () => {
  const user = userStore.getUser();
  const params = new URLSearchParams(window.location.search);
  
  // 判断是否游戏内跳转（通过URL参数判断，如果有特定参数则认为是游戏内跳转）
  const isGameRedirect = params.has('from_app') || params.has('game_redirect') || false;
  
  const properties: Record<string, any> = {
    account_id: user?.sdkId || user?.id || user?.gameAccount || '', // 优先使用 sdkId（用户详情接口返回的sdk_id）
    is_game_redirect: isGameRedirect,
    server_channel: user?.gameServer ? parseInt(user.gameServer) || 0 : 0,
  };
  
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
  // #account_id 是角色ID（game_user_id）
  // characterName 存储的就是 game_user_id
  if (user?.characterName) {
    properties['#account_id'] = user.characterName;
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
  // 如果商品ID已经符合格式，直接使用
  let productId = product.id;
  let iap = product.id;
  
  // 尝试从商品ID中提取 iap（去掉前缀）
  const parts = product.id.split('.');
  if (parts.length > 1) {
    iap = parts[parts.length - 1];
  } else {
    // 如果不符合格式，使用商品ID作为 iap
    iap = product.id;
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
 * - #country_code: 国家代码（用户详情接口返回的country）
 * - #os: 操作系统（用户详情接口返回的platform）
 * - #ip: IP地址（用户详情接口返回的ip）
 * - is_game_redirect: 是否游戏内跳转
 * @param accountId 当前邮箱在当前游戏中对应的账号ID（用户详情接口返回的sdk_id）
 */
export const trackStoreSdkLogin = (accountId?: string) => {
  // 检查数数SDK是否已初始化
  if (!thinkingData.isInitialized()) {
    console.warn('数数SDK未初始化，跳过 store_sdk_login 事件上报');
    return;
  }

  const user = userStore.getUser();
  const params = new URLSearchParams(window.location.search);
  const isGameRedirect = params.has('from_app') || params.has('game_redirect') || false;
  
  const properties: Record<string, any> = {
    account_id: accountId || user?.sdkId || user?.id || user?.gameAccount || '',
    is_game_redirect: isGameRedirect,
  };
  
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
  
  const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
  console.log(`✅ 触发"store_sdk_login"事件，时间：${timestamp}`);
  console.log('trackStoreSdkLogin properties', properties);
  
  thinkingData.track('store_sdk_login', properties);
};

/**
 * 商城选择角色事件
 * 用户登录商城后选择完角色、或从app跳转到商城自动选择完角色后上报
 * 必需参数：
 * - account_id: SDK账号（用户详情接口返回的sdk_id）
 * - #country_code: 国家地区代码（用户详情接口返回的country）
 * - #os: 操作系统（用户详情接口返回的platform）
 * - #ip: IP地址（用户详情接口返回的ip）
 * - is_game_redirect: 是否游戏内跳转
 * - server_channel: 区服id
 * - #account_id: 账户id/角色id（用户详情接口返回的game_user_id）
 * @param serverChannel 区服ID
 * @param gameUserId 游戏用户ID/角色ID（用于#account_id）
 */
export const trackStoreRoleSelect = (serverChannel?: number, gameUserId?: string) => {
  // 检查数数SDK是否已初始化
  if (!thinkingData.isInitialized()) {
    console.warn('数数SDK未初始化，跳过 store_role_select 事件上报');
    return;
  }

  const user = userStore.getUser();
  const params = new URLSearchParams(window.location.search);
  const isGameRedirect = params.has('from_app') || params.has('game_redirect') || false;
  
  const properties: Record<string, any> = {
    account_id: user?.sdkId || user?.id || user?.gameAccount || '', // SDK账号
    is_game_redirect: isGameRedirect,
    server_channel: serverChannel || (user?.gameServer ? parseInt(user.gameServer) || 0 : 0),
  };
  
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
  // #account_id 是角色ID（game_user_id）
  const roleId = gameUserId || user?.characterName;
  if (roleId) {
    properties['#account_id'] = roleId;
  }
  
  const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
  console.log(`✅ 触发"store_role_select"事件，时间：${timestamp}`);
  console.log('trackStoreRoleSelect properties', properties);
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
 */
export const trackStoreIapShow = (product: Product) => {
  // 检查数数SDK是否已初始化
  if (!thinkingData.isInitialized()) {
    console.warn('数数SDK未初始化，跳过 store_iap_show 事件上报', {
      productName: product.name,
      hasUser: !!userStore.getUser(),
    });
    return;
  }

  const user = userStore.getUser();
  const token = user?.token;
  
  // 必须有 token 才能记录上报状态
  if (!token) {
    console.warn('trackStoreIapShow: token 未提供，无法记录上报状态，商品：', product.name);
    return;
  }
  
  // 检查是否已获取用户详情（必须要有角色信息，说明已经调用过用户详情接口）
  // 用户详情接口会设置 characterName（game_user_id）、sdkId、country、platform、ip 等字段
  if (!user?.characterName && !user?.gameServer) {
    console.warn('用户详情未获取完成（未选择角色），跳过 store_iap_show 事件上报，商品：', product.name);
    return;
  }
  
  // 提取 product_id 和 iap
  // 优先使用 product.iap（商品列表详情返回的iap字段），如果没有则使用 extractProductInfo 的结果
  const { product_id, iap: extractedIap } = extractProductInfo(product);
  const iap = product.iap || extractedIap;
  
  // 构建去重key：token + product_id（使用提取后的 product_id）
  const reportedKey = `${token}|${product_id}`;
  
  // 从存储中加载当前 token 的已上报记录
  const reportedKeysArray = loadIapShowReportedKeys(token);
  const iapShowReportedKeys = new Set<string>(reportedKeysArray);
  
  // 如果已经上报过，直接返回
  if (iapShowReportedKeys.has(reportedKey)) {
    return;
  }
  
  const params = new URLSearchParams(window.location.search);
  const isGameRedirect = params.has('from_app') || params.has('game_redirect') || false;
  
  const properties: Record<string, any> = {
    account_id: user?.sdkId || user?.id || user?.gameAccount || '', // SDK账号
    is_game_redirect: isGameRedirect,
    server_channel: user?.gameServer ? parseInt(user.gameServer) || 0 : 0,
    product_id, // 商品id
    iap, // iap（商品列表详情返回的iap字段）
    price: product.price, // 分成前价格
    currency: product.currency, // 货币单位
  };
  
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
  // #account_id 是角色ID（game_user_id）
  if (user?.characterName) {
    properties['#account_id'] = user.characterName;
  }
  
  const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
  const productName = product.name || '未知商品';
  console.log(`✅ 触发"store_iap_show"事件，商品：${productName}，时间：${timestamp}`);
  console.log('trackStoreIapShow properties', properties);
  thinkingData.track('store_iap_show', properties);
  
  // 记录已上报
  iapShowReportedKeys.add(reportedKey);
  saveIapShowReportedKeys(token, iapShowReportedKeys);
};

/**
 * 商城内购点击事件
 * 在点击内购项，弹出的弹窗界面，点支付时上报
 * 必需参数：
 * - account_id: SDK账号（用户详情接口返回的sdk_id）
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
 */
export const trackStoreIapClick = (
  product: Product,
  paymentType?: string,
  environment: string = 'production'
) => {
  // 检查数数SDK是否已初始化
  if (!thinkingData.isInitialized()) {
    console.warn('数数SDK未初始化，跳过 store_iap_click 事件上报');
    return;
  }

  // 提取 product_id 和 iap
  // 优先使用 product.iap（商品列表详情返回的iap字段），如果没有则使用 extractProductInfo 的结果
  const { product_id, iap: extractedIap } = extractProductInfo(product);
  const iap = product.iap || extractedIap;
  
  // 使用传入的 payment_type（如果未传入则为 undefined）
  const resolvedPaymentType = resolvePaymentType(paymentType);
  
  const properties = {
    ...getCommonProperties(),
    product_id, // 商品id
    iap, // iap（商品列表详情返回的iap字段）
    price: product.price, // 分成前价格
    currency: product.currency, // 货币单位
    ...(resolvedPaymentType && { payment_type: resolvedPaymentType }), // 支付方式（仅在有值时添加）
  };
  
  const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
  const productName = product.name || '未知商品';
  console.log(`✅ 触发"store_iap_click"事件，商品：${productName}，时间：${timestamp}`);
  console.log('trackStoreIapClick properties', properties);
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
  });
};

/**
 * 商城支付成功事件
 * 用户在商城点击内购，在拉起支付并支付成功时上报
 */
export const trackStoreIapSuccess = (
  product: Product,
  paymentType?: string,
  environment: string = 'production'
) => {
  // 检查数数SDK是否已初始化
  if (!thinkingData.isInitialized()) {
    console.warn('数数SDK未初始化，跳过 store_iap_success 事件上报');
    return;
  }

  const { product_id, iap } = extractProductInfo(product);
  const resolvedPaymentType = resolvePaymentType(paymentType);
  
  const properties = {
    ...getCommonProperties(),
    product_id, // 商品id
    iap, 
    price: product.price,
    currency: product.currency,
    ...(resolvedPaymentType && { payment_type: resolvedPaymentType }), // 支付方式（仅在有值时添加）
    environment, // 环境
  };
  
  const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
  const productName = product.name || '未知商品';
  console.log(`✅ 触发"store_iap_success"事件，商品：${productName}，时间：${timestamp}`);
  console.log('trackStoreIapSuccess properties', properties);
  thinkingData.track('store_iap_success', properties);
};

/**
 * 商城支付失败事件
 * 用户在商城点击内购，在拉起支付并支付失败时上报
 */
export const trackStoreIapFail = (
  product: Product,
  paymentType: string | undefined,
  environment: string = 'production',
  failReason: string
) => {
  // 检查数数SDK是否已初始化
  if (!thinkingData.isInitialized()) {
    console.warn('数数SDK未初始化，跳过 store_iap_fail 事件上报');
    return;
  }

  const { product_id, iap } = extractProductInfo(product);
  const resolvedPaymentType = resolvePaymentType(paymentType);
  
  const properties = {
    ...getCommonProperties(),
    product_id,
    iap,
    price: product.price,
    currency: product.currency,
    ...(resolvedPaymentType && { payment_type: resolvedPaymentType }), // 支付方式（仅在有值时添加）
    environment,
    fail_reason: failReason,
  };
  
  const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
  const productName = product.name || '未知商品';
  console.log(`✅ 触发"store_iap_fail"事件，商品：${productName}，时间：${timestamp}`);
  console.log('trackStoreIapFail properties', properties);
  thinkingData.track('store_iap_fail', properties);
};

