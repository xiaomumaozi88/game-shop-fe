// 商品相关类型
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  category: string;
  categoryId: string;
  stock: number;
  currency: string; // 虚拟货币类型
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  expire_time_left?: number; // 剩余购买时间（单位：秒），-1代表无过期时间
  purchase_limit?: number; // 限购数量，>0 时展示
  purchase_used?: number; // 已购买次数
  position?: string; // 商品位置/分类，如 "coupon"
  iap?: string; // IAP标识
  iap_id?: string; // IAP ID
}

// 商品分类
export interface Category {
  id: string;
  name: string;
  icon?: string;
  parentId?: string;
  children?: Category[];
}

// 购物车项
export interface CartItem {
  product: Product;
  quantity: number;
}

// 订单
export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  /** 列表展示用时间：优先 pay_success_time，否则 created_time（见后端订单接口） */
  createdAt: string;
  /** 后端 created_time，展示/字符串兜底用 */
  bmallCreatedTime?: string;
  /** 后端 created_at_unix，待支付「30 分钟内自动取消」倒计时以此为准（秒或毫秒由 History 归一化） */
  bmallCreatedAtUnix?: number;
  updatedAt?: string;
}

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  SHIPPED = 'shipped',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// 用户信息
export interface User {
  id: string;
  username: string;
  email?: string; // 登录邮箱，与当前 token 对应
  gameAccount?: string;
  characterName?: string;
  gameServer?: string;
  avatar?: string; // 用户头像URL
  sdkId?: string; // SDK账号ID（用于数数上报的account_id）
  country?: string; // 国家代码（用于数数上报的#country_code）
  ip?: string; // IP地址（用于数数上报的#ip）
  platform?: string; // 平台（ios/android，用于数数上报的#os）
  quickLogin?: boolean; // 是否通过游戏内直链快速登录
  balance?: {
    [currency: string]: number;
  };
  token?: string;
}

// 筛选和排序
export interface FilterOptions {
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  inStock?: boolean;
}

export enum SortOption {
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NAME_ASC = 'name_asc',
  NAME_DESC = 'name_desc',
  NEWEST = 'newest',
  POPULAR = 'popular',
}

// URL参数
export interface URLParams {
  userId?: string;
  gameAccount?: string;
  token?: string;
}

