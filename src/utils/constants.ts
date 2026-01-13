// 常量定义

// 存储键名
export const STORAGE_KEYS = {
  CART: 'game_shop_cart',
  USER: 'game_shop_user',
  ORDERS: 'game_shop_orders',
  CURRENT_GAME_APP_KEY: 'game-shop-current-game-app-key',
  SDK_LOGIN_REPORTED_KEYS: 'game-shop-sdk-login-reported-keys',
  IAP_SHOW_REPORTED_KEYS: 'game-shop-iap-show-reported-keys', // 内购曝光事件上报记录
  GAME_ROLES: 'game-shop-game-roles', // 游戏区服角色列表
  GAME_ROLE_SELECTIONS: 'game-shop-game-role-selections', // 每个游戏的角色选择信息 { [appKey]: { gameServer, characterName, avatar } }
} as const;

// 虚拟货币类型
export const CURRENCIES = {
  GOLD: '金币',
  DIAMOND: '钻石',
  POINT: '积分',
} as const;

// 订单状态文本
export const ORDER_STATUS_TEXT = {
  pending: '待支付',
  paid: '已支付',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
} as const;

// 分页配置
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// 响应式断点
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
} as const;

// 图片占位符
export const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300x225?text=商品图片';

// 支付类型
export const PAYMENT_TYPES = {
  APPLE: 'Apple', // 苹果原生支付
  GOOGLE: 'Google', // 谷歌原生支付
  STRIPE_STORE: 'stripe_store', // 用户直接登录商城支付
  STRIPE_H5: 'stripe_h5store', // 用户从游戏内跳转商城支付
} as const;

