// API工具函数
// 实际项目中应该连接真实的后端API

import { config } from './config';
import { handleTokenExpired } from './auth';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const BMALL_BASE_URL = config.bmall.baseUrl;

const AUTH_TOKEN_STORAGE_KEY = 'game-shop-auth-token';

// 从 localStorage 加载 token
const loadAuthToken = (): string | null => {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to load auth token from localStorage:', error);
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
    console.error('Failed to save auth token to localStorage:', error);
  }
};

// 导出获取 token 的函数，方便其他地方使用
export const getAuthToken = (): string | null => {
  return authToken;
};

/**
 * 检查API响应是否为token过期错误
 * @param code 响应码
 * @param msg 响应消息
 * @returns 是否为token过期
 */
const isTokenExpired = (code: number, msg?: string): boolean => {
  return code === 401  || msg === 'JWT token has expired';
};

/**
 * 处理API响应，检查token过期
 * @param json 响应JSON对象
 */
const handleApiResponse = (json: { code: number; msg?: string }): void => {
  if (isTokenExpired(json.code, json.msg)) {
    handleTokenExpired();
  }
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

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
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
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
  getGameConfig: (gameId: string) =>
    apiClient.get<GameConfigResponse>(`/game/${gameId}/config`),
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
        error: json?.msg || '获取图形验证码失败',
        bizCode: json.biz_code,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取图形验证码失败',
      };
    }
  },

  /**
   * 邮箱验证码登录
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
        error: json?.msg || '登录失败',
        bizCode: json.biz_code,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '登录失败',
      };
    }
  },

  /**
   * 发送邮箱验证码
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
        error: json?.msg || '发送验证码失败',
        bizCode: json.biz_code,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送验证码失败',
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

      // 检查token过期
      handleApiResponse(json);

      if (json?.code === 0 && json.data?.items) {
        return {
          success: true,
          data: json.data.items,
          message: json.msg,
        };
      }

      return {
        success: false,
        error: json?.msg || '获取游戏区服角色列表失败',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取游戏区服角色列表失败',
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
  async getUserDetail(appKey: string, gameUserId: string): Promise<ApiResponse<UserDetailResponse>> {
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

      // 检查token过期
      handleApiResponse(json);

      if (json?.code === 0 && json.data) {
        return {
          success: true,
          data: json.data,
          message: json.msg,
        };
      }

      return {
        success: false,
        error: json?.msg || '获取用户详情失败',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取用户详情失败',
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
        };
      }

      return {
        success: false,
        error: json?.msg || '快速登录失败',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '快速登录失败',
      };
    }
  },
};

// 订单创建相关 API - 对接 /bmall/order-create
// 支持 Stripe 和 Airwallex 两种支付方式
export interface BmallOrderCreateData {
  order_no: string;
  payment_type?: string; // 支付方式，如 "stripe_h5store"、"stripe_store" 等
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
  data?: BmallOrderCreateData | null;
  ts?: number;
}

// 订单查询相关 API - 对接 /bmall/order-query
export interface BmallOrderQueryData {
  order_no: string;
  pay_status: number;
  transaction_id: string;
  pay_success_time: string;
  product_name: string;
  multi_name?: string; // 多语言名称，JSON字符串，如 "{\"fr\": \"sfdf\", \"zh\": \"名称1\"}"
  product_id: string;
  product_image?: string; // 商品图片链接
  product_position?: string; // 商品类型/位置，如 "coupon", "luxury", "gift"
  price: number;
  currency: string;
  quantity: number;
  game_user_id: string;
  game_server_channel: string;
  platform: string;
  unit_price: number;
  user_email: string;
  iap: string;
  iap_id: string;
  order_status: 'pending' | 'completed' | 'closed';
  payment_type?: string; // 支付方式，如 "stripe_h5store"、"stripe_store" 等
}

interface BmallOrderQueryResponse {
  code: number;
  msg?: string;
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

      // 检查 token 是否过期
      handleApiResponse(json);

      if (json?.code === 0 && json.data) {
        return {
          success: true,
          data: json.data,
          message: json.msg,
        };
      }

      return {
        success: false,
        error: json?.msg || '创建订单失败',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建订单失败',
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

      // 检查 token 是否过期
      handleApiResponse(json);

      if (json?.code === 0 && json.data) {
        return {
          success: true,
          data: json.data,
          message: json.msg,
        };
      }

      return {
        success: false,
        error: json?.msg || '查询订单失败',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '查询订单失败',
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
        data?: { items: BmallOrderQueryData[] } | null;
        ts?: number;
      } = await resp.json();

      // 检查 token 是否过期
      handleApiResponse(json);

      if (json?.code === 0 && json.data) {
        return {
          success: true,
          data: json.data,
          message: json.msg,
        };
      }

      return {
        success: false,
        error: json?.msg || '查询订单列表失败',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '查询订单列表失败',
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
}

interface ProductListResponse {
  code: number;
  msg?: string;
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

      // 检查token过期
      handleApiResponse(json);

      if (json?.code === 0 && json.data?.items) {
        return {
          success: true,
          data: json.data.items,
          message: json.msg,
        };
      }

      return {
        success: false,
        error: json?.msg || '获取商品列表失败',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取商品列表失败',
      };
    }
  },
};

