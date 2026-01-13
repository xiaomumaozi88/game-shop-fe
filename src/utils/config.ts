// 应用配置
// webpack DefinePlugin 会在编译时进行文本替换
// 它会查找代码中的 process.env.XXX 并替换为对应的字符串值
// 例如：process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY 会被替换为 "pk_test_..." 或 ""

// 类型声明，避免 TypeScript 错误
// 注意：DefinePlugin 会在编译时替换这些值，所以运行时不会访问 process 对象
declare const process: {
  env: {
    REACT_APP_API_URL?: string;
    REACT_APP_STRIPE_PUBLISHABLE_KEY?: string;
    REACT_APP_AIRWALLEX_ENV?: 'demo' | 'prod';
    REACT_APP_THINKINGDATA_APP_ID?: string;
    REACT_APP_THINKINGDATA_SERVER_URL?: string;
    REACT_APP_ENV_STAGE?: 'test' | 'prod';
  };
};

// 环境标识（用于区分测试/正式域名）
const envStage = process.env.REACT_APP_ENV_STAGE || 'test';

// 依环境切换的域名配置
const BMALL_DOMAINS: Record<'test' | 'prod', string> = {
  test: 'https://tk.dgtverse.cn',
  prod: 'https://sandc.gameztsvc.com',
};

export const config = {
  // DefinePlugin 会在编译时替换 process.env.REACT_APP_API_URL 为实际的字符串值
  apiUrl: process.env.REACT_APP_API_URL || '/api',
  // DefinePlugin 会在编译时替换 process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY 为实际的字符串值
  stripePublishableKey: process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || '',
  // Airwallex 环境配置（demo 或 prod）
  airwallexEnv: (process.env.REACT_APP_AIRWALLEX_ENV || 'prod') as 'demo' | 'prod',
  // ThinkingData 配置
  thinkingData: {
    appId: process.env.REACT_APP_THINKINGDATA_APP_ID || '',
    serverUrl: process.env.REACT_APP_THINKINGDATA_SERVER_URL || '',
  },
  // 环境切换
  envStage,
  bmall: {
    baseDomain: BMALL_DOMAINS[envStage] || BMALL_DOMAINS.test,
    baseUrl: `${BMALL_DOMAINS[envStage] || BMALL_DOMAINS.test}/bmall`,
  },
} as const;

