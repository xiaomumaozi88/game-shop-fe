// API工具函数
// 实际项目中应该连接真实的后端API

import { config } from './config';
import { getDefaultApiErrorMessage, handleApiError } from './errorHandler';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const BMALL_BASE_URL = config.bmall.baseUrl;
const REDEEM_BASE_URL = config.redeem.baseUrl;

const AUTH_TOKEN_STORAGE_KEY = 'game-shop-auth-token';

// 从 localStorage 加载 token
const loadAuthToken = (): string | null => {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch (error) {
    // console.error('Failed to load auth token from localStorage:', error);
    return null;
  }
};

let authToken: string | null = loadAuthToken();

export const setAuthToken = (token: string | null) => {
  authToken = token;
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch (error) {
    // console.error('Failed to save auth token to localStorage:', error);
  }
};

// 导出获取 token 的函数，方便其他地方使用
export const getAuthToken = (): string | null => {
  return authToken;
};

interface ApiErrorPayload {
  code?: number;
  msg?: string;
  biz_code?: number;
}

const getLocalizedApiError = (json?: ApiErrorPayload | null): string => {
  if (!json) {
    return getDefaultApiErrorMessage();
  }

  return handleApiError(json.code ?? -1, json.biz_code, json.msg) || getDefaultApiErrorMessage();
};

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  bizCode?: number; // 业务错误码
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `${authToken}` } : {}),
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (
        data &&
        typeof data === 'object' &&
        'code' in data &&
        typeof (data as ApiErrorPayload).code === 'number' &&
        (data as ApiErrorPayload).code !== 0
      ) {
        const errorPayload = data as ApiErrorPayload;
        return {
          success: false,
          error: getLocalizedApiError(errorPayload),
          bizCode: errorPayload.biz_code,
        };
      }

      return {
        success: true,
        data,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

// API端点示例
export const productApi = {
  getList: () => apiClient.get('/products'),
  getById: (id: string) => apiClient.get(`/products/${id}`),
  search: (keyword: string) => apiClient.get(`/products/search?q=${keyword}`),
};

export const orderApi = {
  create: (orderData: unknown) => apiClient.post('/orders', orderData),
  getList: () => apiClient.get('/orders'),
  getById: (id: string) => apiClient.get(`/orders/${id}`),
};

export const userApi = {
  getInfo: () => apiClient.get('/user'),
  updateBalance: (currency: string, amount: number) =>
    apiClient.put('/user/balance', { currency, amount }),
};

// Stripe 支付相关 API
export interface CreateCheckoutSessionRequest {
  productId: string;
  quantity: number;
  amount: number; // 金额（以分为单位）
  currency: string; // 货币代码，如 'usd'
  productName: string;
}

export interface CreateCheckoutSessionResponse {
  clientSecret: string;
}

export interface SessionStatusResponse {
  status: 'open' | 'complete' | 'expired';
  customer_email?: string;
  metadata?: {
    productId?: string;
    quantity?: string;
    productName?: string;
    price?: string;
    totalAmount?: string;
  };
  payment_method_types?: string[];
  amount_total?: number;
  currency?: string;
  // 支付失败相关信息
  payment_status?: 'paid' | 'unpaid' | 'no_payment_required';
  last_payment_error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

export const stripeApi = {
  createCheckoutSession: (data: CreateCheckoutSessionRequest) =>
    apiClient.post<CreateCheckoutSessionResponse>('/create-checkout-session', data),
  getSessionStatus: (sessionId: string) =>
    apiClient.get<SessionStatusResponse>(`/session-status?session_id=${sessionId}`),
};

// 游戏配置相关 API
export interface GameConfigResponse {
  // 用户基本信息
  user_info?: {
    account_id: string; // 当前邮箱在当前游戏中对应的账号ID（用于数数上报）
    username?: string; // 用户名
    game_account?: string; // 游戏账号
    character_name?: string; // 角色名称
    balance?: {
      [currency: string]: number; // 账户余额
    };
  };

  // 用户区服信息
  server_info?: {
    server_channel?: number; // 区服ID
    server_name?: string; // 区服名称
    character_name?: string; // 角色名称
    character_id?: string; // 角色ID
  };

  // 数数上报配置
  thinking_data?: {
    app_id: string; // 数数上报账号 App ID
    server_url: string; // 数数上报服务器地址
  };

  // 其他游戏配置信息...
}

export const gameApi = {
  /**
   * 获取游戏配置信息（请求A）
   * 根据登录的邮箱，获取当前游戏中对应的：
   * - 用户区服信息
   * - 用户基本信息
   * - 对应游戏的数数配置
   * @param gameId 游戏ID
   */
  getGameConfig: (gameId: string) => apiClient.get<GameConfigResponse>(`/game/${gameId}/config`),
};

// 登录相关 API
export interface CaptchaData {
  captcha_id: string;
  captcha_img: string;
}

interface CaptchaResponse {
  code: number;
  msg?: string;
  biz_code?: number; // 业务错误码
  data?: CaptchaData;
}

interface LoginResponse {
  code: number;
  msg?: string;
  biz_code?: number; // 业务错误码
  data?: {
    token?: string;
    email?: string; // 与此次登录 token 对应的邮箱
    items?: GameServerRoleItem[]; // 游戏角色列表
  };
}

interface SendCodeResponse {
  code: number;
  msg?: string;
  biz_code?: number; // 业务错误码
  data?: unknown;
}

export const authApi = {
  /**
   * 获取图形验证码（依环境切换域名）
   */
  async getCaptcha(): Promise<ApiResponse<CaptchaData>> {
    try {
      const resp = await fetch(`${BMALL_BASE_URL}/captcha`, { method: 'GET' });
      const json: CaptchaResponse = await resp.json();

      if (json?.code === 0 && json.data) {
        return {
          success: true,
          data: json.data,
          message: json.msg,
          bizCode: json.biz_code,
        };
      }

      return {
        success: false,
        error: getLocalizedApiError(json),
        bizCode: json.biz_code,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  },

  /**
   * 邮箱验证码登录（/bmall/login）
   * 固定携带 game=toukagame，供后端区分来源（与 send-code 一致）
   * @param email 邮箱地址
   * @param code 邮箱验证码
   * @param appKeys 游戏的app商城地址key数组
   * @param keepLogin 是否保持15天登录（可选）
   */
  async login(
    email: string,
    code: string,
    appKeys: string[],
    keepLogin?: boolean
  ): Promise<ApiResponse<{ token: string; email: string; items?: GameServerRoleItem[] }>> {
    try {
      const resp = await fetch(`${BMALL_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code,
          app_keys: appKeys,
          game: 'toukagame',
          ...(keepLogin !== undefined ? { keep_login: keepLogin } : {}),
        }),
      });
      const json: LoginResponse = await resp.json();

      if (json?.code === 0 && json.data?.token) {
        return {
          success: true,
          data: {
            token: json.data.token,
            email: json.data.email || email, // 优先使用接口返回的 email，否则使用传入的 email
            items: json.data.items || [],
          },
          message: json.msg,
          bizCode: json.biz_code,
        };
      }

      return {
        success: false,
        error: getLocalizedApiError(json),
        bizCode: json.biz_code,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  },

  /**
   * 发送邮箱验证码（/bmall/send-code）
   * 固定携带 game=toukagame，供后端区分来源
   */
  async sendCode(params: {
    email: string;
    type?: string;
    captcha_id: string;
    captcha_code: string;
  }): Promise<ApiResponse<null>> {
    try {
      const resp = await fetch(`${BMALL_BASE_URL}/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: params.email,
          type: params.type || 'login',
          captcha_id: params.captcha_id,
          captcha_code: params.captcha_code,
          game: 'toukagame',
        }),
      });
      const json: SendCodeResponse = await resp.json();

      if (json?.code === 0) {
        return {
          success: true,
          message: json.msg,
          data: null,
          bizCode: json.biz_code,
        };
      }

      return {
        success: false,
        error: getLocalizedApiError(json),
        bizCode: json.biz_code,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  },

  /**
   * 商城退出登录（/bmall/logout）
   * 携带 Authorization 请求头，无业务参数
   */
  async logout(): Promise<ApiResponse<Record<string, never>>> {
    try {
      const resp = await fetch(`${BMALL_BASE_URL}/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `${authToken}` } : {}),
        },
        body: JSON.stringify({}),
      });
      const json: {
        code: number;
        msg?: string;
        data?: Record<string, never> | null;
        ts?: number;
        biz_code?: number;
      } = await resp.json();

      if (json?.code === 0) {
        return {
          success: true,
          data: json.data ?? {},
          message: json.msg,
          bizCode: json.biz_code,
        };
      }

      return {
        success: false,
        error: getLocalizedApiError(json),
        bizCode: json.biz_code,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  },
};

// 兑换码相关 API - 与 game-redeem-code-fe 的 /gmCodeCaptcha 与 /gmRedeemCode 逻辑保持一致
const REDEEM_CAPTCHA_PATH = '/gmCodeCaptcha';
const REDEEM_CODE_PATH = '/gmRedeemCode';

export interface RedeemCodeCaptchaData {
  captcha_id: string;
  captcha_image: string;
}

interface RedeemCodeCaptchaResponse {
  code: number;
  msg?: string;
  biz_code?: number;
  data?: RedeemCodeCaptchaData;
  ts?: number;
}

interface RedeemCodeApiResponse {
  code?: number;
  msg?: string;
  biz_code?: number | string;
  error_code?: number | string;
  err_code?: number | string;
  data?: {
    biz_code?: number | string;
    error_code?: number | string;
    reward_code_type?: string;
    rewardCodeType?: string;
    type?: number | string;
  } | null;
  reward_code_type?: string;
  rewardCodeType?: string;
  type?: number | string;
  ts?: number;
}

export interface RedeemCodeResultData {
  resultCode: number | null;
  rewardCodeType?: string;
}

const getRedeemCodeResultCode = (
  payload: RedeemCodeApiResponse | null | undefined
): number | null => {
  if (payload?.code === 0) return 0;

  const candidates = [
    payload?.biz_code,
    payload?.error_code,
    payload?.err_code,
    payload?.data?.biz_code,
    payload?.data?.error_code,
  ];

  for (const candidate of candidates) {
    const resultCode = Number(candidate);
    if (Number.isInteger(resultCode) && resultCode >= 0) {
      return resultCode;
    }
  }

  return null;
};

const getRedeemCodeRewardType = (
  payload: RedeemCodeApiResponse | null | undefined
): string | undefined => {
  const rawType =
    payload?.reward_code_type ??
    payload?.rewardCodeType ??
    payload?.type ??
    payload?.data?.reward_code_type ??
    payload?.data?.rewardCodeType ??
    payload?.data?.type;

  if (rawType === undefined || rawType === null) return undefined;

  const normalized = String(rawType).trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === '0' || normalized === 'global') return 'global';
  if (normalized === '1' || normalized === 'personal') return 'personal';
  return normalized;
};

const requestRedeemJson = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${REDEEM_BASE_URL}${path}`, {
    cache: 'no-store',
    ...options,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
};

export const redeemCodeApi = {
  async getCaptcha(): Promise<ApiResponse<RedeemCodeCaptchaData>> {
    try {
      const json = await requestRedeemJson<RedeemCodeCaptchaResponse>(REDEEM_CAPTCHA_PATH);

      if (json?.code === 0 && json.data?.captcha_id && json.data?.captcha_image) {
        return {
          success: true,
          data: json.data,
          message: json.msg,
          bizCode: json.biz_code,
        };
      }

      return {
        success: false,
        error: json?.msg || getDefaultApiErrorMessage(),
        bizCode: json?.biz_code,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  },

  async redeem(params: {
    gameUserId: string;
    redeemCode: string;
    captchaId: string;
    captchaCode: string;
    language: string;
  }): Promise<ApiResponse<RedeemCodeResultData>> {
    try {
      const json = await requestRedeemJson<RedeemCodeApiResponse>(REDEEM_CODE_PATH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          game_user_id: params.gameUserId,
          redeem_code: params.redeemCode,
          captcha_id: params.captchaId,
          captcha_code: params.captchaCode,
          language: params.language,
        }),
      });
      const resultCode = getRedeemCodeResultCode(json);
      const rewardCodeType = getRedeemCodeRewardType(json);

      if (resultCode === 0) {
        return {
          success: true,
          data: { resultCode, rewardCodeType },
          message: json.msg,
        };
      }

      return {
        success: false,
        data: { resultCode, rewardCodeType },
        error: json?.msg || getDefaultApiErrorMessage(),
        bizCode: resultCode ?? undefined,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  },
};

// 游戏区服角色列表相关 API
export interface GameServerRoleItem {
  game_user_id: string; // 游戏用户ID
  game_server_channel: string; // 区服ID
  platform: string; // 平台（ios/android）
  nick_name: string; // 角色昵称
  user_avatar: string; // 用户头像
  sdk_id: string; // SDK ID
  pkg: string; // 包名
  app_key: string; // 游戏app_key
}

interface GameServerRoleListResponse {
  code: number;
  msg?: string;
  biz_code?: number;
  data?: {
    items: GameServerRoleItem[];
  };
  ts?: number;
}

export const gameRoleApi = {
  /**
   * 获取游戏区服角色列表
   * 根据登录的邮箱，获取该邮箱在所有游戏下的角色信息
   * @param appKeys 游戏app_key数组
   */
  async getGameServerRoleList(appKeys: string[]): Promise<ApiResponse<GameServerRoleItem[]>> {
    try {
      const resp = await fetch(`${BMALL_BASE_URL}/game-svr-role-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `${authToken}` } : {}),
        },
        body: JSON.stringify({ app_keys: appKeys }),
      });
      const json: GameServerRoleListResponse = await resp.json();

      if (json?.code === 0 && json.data?.items) {
        return {
          success: true,
          data: json.data.items,
          message: json.msg,
          bizCode: json.biz_code,
        };
      }

      return {
        success: false,
        error: getLocalizedApiError(json),
        bizCode: json.biz_code,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  },
};

// 商城用户详情相关 API
export interface UserDetailResponse {
  sdk_id: string; // SDK ID
  user_email: string; // 用户邮箱
  nick_name: string; // 角色昵称
  user_avatar: string; // 用户头像
  game_user_id: string; // 游戏用户ID
  game_server_channel: string; // 区服ID
  ss_url: string; // 数数上报服务器地址
  ss_app_id: string; // 数数上报 App ID
  pkg: string; // 包名
  platform: string; // 平台（ios/android）
  app_id: number; // App ID
  ip?: string; // IP地址
  country?: string; // 国家代码
  game_account_country?: string; // 游戏账号国家
  quick_login?: boolean; // 是否游戏内直链快速登录（用于区分支付方式）
}

// 快速登录
interface QuickLoginResponse {
  code: number;
  msg?: string;
  biz_code?: number;
  data?: {
    token: string;
    email?: string; // 与此次登录 token 对应的邮箱
    items?: GameServerRoleItem[]; // 游戏角色列表
  };
  ts?: number;
}

interface UserDetailApiResponse {
  code: number;
  msg?: string;
  biz_code?: number;
  data?: UserDetailResponse;
  ts?: number;
}

export const userDetailApi = {
  /**
   * 获取商城用户详情
   * 根据选择的区服角色，获取该角色的详细信息及数数配置
   * @param appKey 游戏app_key
   * @param gameUserId 游戏用户ID（角色ID）
   */
  async getUserDetail(
    appKey: string,
    gameUserId: string
  ): Promise<ApiResponse<UserDetailResponse>> {
    try {
      const resp = await fetch(`${BMALL_BASE_URL}/user-detail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `${authToken}` } : {}),
        },
        body: JSON.stringify({ app_key: appKey, game_user_id: gameUserId }),
      });
      const json: UserDetailApiResponse = await resp.json();

      if (json?.code === 0 && json.data) {
        return {
          success: true,
          data: json.data,
          message: json.msg,
          bizCode: json.biz_code,
        };
      }

      return {
        success: false,
        error: getLocalizedApiError(json),
        bizCode: json.biz_code,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  },
};

// 快速登录接口
export const quickLoginApi = {
  /**
   * 快速登录
   * @param sign SDK返回的加密参数值
   * @param appKeys 游戏的app商城地址key数组
   */
  async quickLogin(
    sign: string,
    appKeys: string[]
  ): Promise<ApiResponse<{ token: string; email: string; items?: GameServerRoleItem[] }>> {
    try {
      const resp = await fetch(`${BMALL_BASE_URL}/quick-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sign,
          app_keys: appKeys,
        }),
      });
      const json: QuickLoginResponse = await resp.json();

      if (json?.code === 0 && json.data?.token) {
        return {
          success: true,
          data: {
            token: json.data.token,
            email: json.data.email || '', // 接口返回的 email
            items: json.data.items || [],
          },
          message: json.msg,
          bizCode: json.biz_code,
        };
      }

      return {
        success: false,
        error: getLocalizedApiError(json),
        bizCode: json.biz_code,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  },
};

// 订单创建相关 API - 对接 /bmall/order-create
// 支持 Stripe 和 Airwallex 两种支付方式
export interface BmallOrderCreateData {
  order_no: string;
  payment_type?: string; // 支付方式：stripe_store | stripe_h5store | airwallex_store | airwallex_h5store 等
  environment?: string; // 支付环境：production / sandbox（如后端返回）
  payment_environment?: string; // 支付环境备用字段
  env?: string; // 支付环境备用字段
  session_id?: string; // 支付会话ID
  // Stripe 相关字段
  h5_url?: string;
  payment_intent_id?: string;
  payment_intent_client_secret?: string; // PaymentIntent 的 client_secret（用于 Payment Element）
  checkout_session_client_secret?: string; // Checkout Session 的 client_secret（用于 Embedded Checkout）
  // Airwallex 相关字段
  billing_checkout_url?: string; // Airwallex Billing Checkout URL（用于托管页面重定向）
  billing_checkout_id?: string; // Airwallex Billing Checkout ID
  intent_id?: string; // Airwallex Payment Intent ID
  client_secret?: string; // Airwallex client_secret（用于 Hosted Payment Page）
}

interface BmallOrderCreateResponse {
  code: number;
  msg?: string;
  biz_code?: number;
  data?: BmallOrderCreateData | null;
  ts?: number;
}

// 订单查询相关 API - 对接 /bmall/order-query
export interface BmallOrderQueryData {
  order_no: string;
  pay_status: number;
  transaction_id: string;
  /** 支付成功时间；待支付、已取消等状态可能为空，此时用 created_time 展示下单时间 */
  pay_success_time: string;
  /** 订单创建时间；待支付/已取消时 pay_success_time 为空，列表时间与倒计时均依赖此字段 */
  created_time?: string;
  /** 订单创建时间 Unix 时间戳（秒或毫秒，见前端归一化逻辑），用于待支付倒计时，避免时区问题 */
  created_at_unix?: number | string;
  /** 英文默认商品名（订单列表等接口主字段） */
  product_name?: string;
  /** 部分接口仍使用 name，与 product_name 二选一 */
  name?: string;
  multi_name?: string; // 多语言名称，JSON字符串，如 "{\"fr\": \"sfdf\", \"zh\": \"名称1\"}"
  product_id: string;
  product_image?: string; // 商品图片链接
  product_position?: string; // 商品类型/位置，如 "coupon", "luxury", "gift"
  purchase_limit_type?: number; // 1 终身特惠 2 周特惠 3 月特惠
  price: number;
  currency: string;
  quantity: number;
  game_user_id: string;
  game_server_channel: string;
  platform: string;
  unit_price: number;
  user_email?: string;
  account_email?: string;
  iap: string;
  iap_id: string;
  order_status: 'pending' | 'completed' | 'closed';
  payment_type?: string; // 支付方式：stripe_store | stripe_h5store | airwallex_store | airwallex_h5store 等
  environment?: string; // 支付环境：production / sandbox（如后端返回）
  payment_environment?: string; // 支付环境备用字段
  env?: string; // 支付环境备用字段
}

interface BmallOrderQueryResponse {
  code: number;
  msg?: string;
  biz_code?: number;
  data?: BmallOrderQueryData | null;
  ts?: number;
}

export const bmallOrderApi = {
  /**
   * 创建订单（Stripe 支付入口）
   * 对接文档 4.9 商品购买 /bmall/order-create
   *
   * @param params.appKey 游戏的 app 商城地址 key
   * @param params.platform 游戏平台，如 ios / android / web
   * @param params.language 浏览器语言，需与后台配置保持一致，如 zh、en
   * @param params.productId 产品 id
   * @param params.quantity 购买数量
   */
  async createOrder(params: {
    appKey: string;
    platform: string;
    language: string;
    productId: string;
    quantity: number;
  }): Promise<ApiResponse<BmallOrderCreateData>> {
    try {
      const resp = await fetch(`${BMALL_BASE_URL}/order-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `${authToken}` } : {}),
        },
        body: JSON.stringify({
          app_key: params.appKey,
          platform: params.platform,
          language: params.language,
          product_id: params.productId,
          quantity: String(params.quantity),
        }),
      });

      const json: BmallOrderCreateResponse = await resp.json();

      if (json?.code === 0 && json.data) {
        return {
          success: true,
          data: json.data,
          message: json.msg,
          bizCode: json.biz_code,
        };
      }

      return {
        success: false,
        error: getLocalizedApiError(json),
        bizCode: json.biz_code,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  },

  /**
   * 查询订单详情
   * 对接文档 4.10 商城订单详情 /bmall/order-query
   *
   * @param params.appKey 游戏的 app 商城地址 key
   * @param params.language 浏览器语言，需与后台配置保持一致，如 zh、en
   * @param params.orderNo 订单号（与 sessionId 必传其一）
   * @param params.sessionId Stripe session_id（与 orderNo 必传其一）
   */
  async queryOrder(params: {
    appKey: string;
    language: string;
    orderNo?: string;
    sessionId?: string;
  }): Promise<ApiResponse<BmallOrderQueryData>> {
    try {
      const body: Record<string, string> = {
        app_key: params.appKey,
        language: params.language,
      };

      if (params.orderNo) {
        body.order_no = params.orderNo;
      }
      if (params.sessionId) {
        body.session_id = params.sessionId;
      }

      const resp = await fetch(`${BMALL_BASE_URL}/order-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `${authToken}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const json: BmallOrderQueryResponse = await resp.json();

      if (json?.code === 0 && json.data) {
        return {
          success: true,
          data: json.data,
          message: json.msg,
          bizCode: json.biz_code,
        };
      }

      return {
        success: false,
        error: getLocalizedApiError(json),
        bizCode: json.biz_code,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  },

  /**
   * 查询订单列表
   * 对接文档 4.11 商城订单列表 /bmall/order-list
   *
   * @param params.appKey 游戏的 app 商城地址 key
   * @param params.language 浏览器语言，需与后台配置保持一致，如 zh、en
   */
  async queryOrderList(params: {
    appKey: string;
    language: string;
  }): Promise<ApiResponse<{ items: BmallOrderQueryData[] }>> {
    try {
      const resp = await fetch(`${BMALL_BASE_URL}/order-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `${authToken}` } : {}),
        },
        body: JSON.stringify({
          app_key: params.appKey,
          language: params.language,
        }),
      });

      const json: {
        code: number;
        msg?: string;
        biz_code?: number;
        data?: { items: BmallOrderQueryData[] } | null;
        ts?: number;
      } = await resp.json();

      if (json?.code === 0 && json.data) {
        return {
          success: true,
          data: json.data,
          message: json.msg,
          bizCode: json.biz_code,
        };
      }

      return {
        success: false,
        error: getLocalizedApiError(json),
        bizCode: json.biz_code,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  },

  /**
   * 取消商城订单
   * 对接文档 4.14 商城订单取消 /bmall/order-cancel
   * 订单号与 session_id 必传其一
   */
  async cancelOrder(params: {
    appKey: string;
    orderNo?: string;
    sessionId?: string;
  }): Promise<ApiResponse<Record<string, never> | null>> {
    if (!params.orderNo && !params.sessionId) {
      return {
        success: false,
        error: 'order_no 与 session_id 需至少传一个',
      };
    }

    try {
      const body: Record<string, string> = {
        app_key: params.appKey,
      };
      if (params.orderNo) {
        body.order_no = params.orderNo;
      }
      if (params.sessionId) {
        body.session_id = params.sessionId;
      }

      const resp = await fetch(`${BMALL_BASE_URL}/order-cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `${authToken}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const json: {
        code: number;
        msg?: string;
        data?: Record<string, never> | null;
        ts?: number;
        biz_code?: number;
      } = await resp.json();

      if (json?.code === 0) {
        return {
          success: true,
          data: json.data ?? null,
          message: json.msg,
          bizCode: json.biz_code,
        };
      }

      return {
        success: false,
        error: getLocalizedApiError(json),
        bizCode: json.biz_code,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  },
};

// 商品列表相关 API
export interface ProductListItem {
  id: string;
  name: string;
  image: string;
  price: string;
  currency: string;
  purchase_limit: number; // 限购次数
  purchase_used: number; // 已购买次数
  expire_time_left: number; // 剩余过期时间戳，单位秒, -1代表无过期时间
  position: string; // 商品位置/分类，如 "coupon"
  multi_name: string; // 多语言名称，JSON字符串，如 "{\"fr\": \"sfdf\", \"zh\": \"名称1\"}"
  iap?: string; // IAP标识
  iap_id?: string; // IAP ID
  value_ratio?: number;
  gem_count?: number;
  small_images?: string; // JSON 字符串
  purchase_limit_type?: number; // 1 终身 2 自然周 3 自然月
  is_gray?: number;
}

interface ProductListResponse {
  code: number;
  msg?: string;
  biz_code?: number;
  data?: {
    items: ProductListItem[];
  };
  ts?: number;
}

export const productListApi = {
  /**
   * 获取商品列表
   * @param appKey 游戏的app商城地址key
   * @param platform 游戏平台
   * @param language 浏览器语言，和后台设置的需要保持一致
   */
  async getProductList(
    appKey: string,
    platform: string,
    language: string
  ): Promise<ApiResponse<ProductListItem[]>> {
    try {
      const resp = await fetch(`${BMALL_BASE_URL}/product-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `${authToken}` } : {}),
        },
        body: JSON.stringify({
          app_key: appKey,
          platform: platform,
          language: language,
        }),
      });
      const json: ProductListResponse = await resp.json();

      if (json?.code === 0 && json.data?.items) {
        return {
          success: true,
          data: json.data.items,
          message: json.msg,
          bizCode: json.biz_code,
        };
      }

      return {
        success: false,
        error: getLocalizedApiError(json),
        bizCode: json.biz_code,
      };
    } catch {
      return {
        success: false,
        error: getDefaultApiErrorMessage(),
      };
    }
  },
};
