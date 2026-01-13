# 游戏商店前端项目

游戏内商品购买网站，支持PC和移动端响应式设计。

## 技术栈

- **框架**: React 18+
- **构建工具**: Webpack 5
- **语言**: TypeScript
- **样式**: LESS + CSS Modules
- **路由**: React Router v6
- **UI组件**: 自主开发响应式组件

## 项目结构

```
src/
├── components/     # 通用组件
│   ├── Layout/    # 布局组件
│   ├── Button/    # 按钮组件
│   ├── ProductCard/  # 商品卡片
│   ├── ProductModal/ # 商品详情模态框
│   ├── SearchBar/    # 搜索栏
│   └── Icons/        # 图标组件
├── pages/         # 页面组件
│   ├── Home/      # 首页/商品列表
│   ├── Cart/      # 购物车
│   ├── Checkout/  # 结算页面
│   ├── OrderDetail/ # 订单详情
│   └── History/   # 购买历史
├── store/         # 状态管理
│   ├── cartStore.ts  # 购物车状态
│   └── userStore.ts  # 用户状态
├── hooks/         # 自定义hooks
│   ├── useCart.ts    # 购物车hook
│   ├── useUser.ts    # 用户hook
│   └── useResponsive.ts # 响应式hook
├── utils/         # 工具函数
├── types/         # TypeScript类型定义
├── styles/        # 全局样式
│   ├── variables.less  # 变量
│   ├── mixins.less     # Mixins
│   ├── reset.less      # 重置样式
│   └── index.less      # 入口样式
└── assets/        # 静态资源
```

## 功能特性

### 商品展示系统
- ✅ 商品列表网格布局
- ✅ 商品详情模态框
- ✅ 分类筛选和搜索功能
- ✅ 价格排序和过滤
- ✅ 库存数量显示

### 购物流程
- ✅ 购物车功能（添加/删除/修改数量）
- ✅ 结算页面
- ✅ 订单确认
- ✅ Stripe 支付集成（嵌入式支付表单）

### 用户相关
- ✅ 游戏账号绑定（通过URL参数）
- ✅ 购买历史记录
- ✅ 虚拟货币显示

### 数据分析
- ✅ ThinkingData SDK 集成
- ✅ 自动页面浏览追踪
- ✅ 用户登录/登出追踪
- ✅ 用户属性设置

### 响应式设计
- ✅ 移动端优先
- ✅ 断点：mobile(<768px), tablet(768px-1024px), desktop(>1024px)
- ✅ 触摸友好的交互设计

### 性能优化
- ✅ 代码分割和懒加载
- ✅ 图片懒加载
- ✅ Bundle分析优化

## 开发

### 安装依赖

```bash
npm install
```

### 启动开发服务器

#### 方式一：同时启动前端和后端（推荐）

```bash
npm run dev:all
```

这会同时启动：
- 前端开发服务器：http://localhost:3000
- 后端 API 服务器：http://localhost:4242

#### 方式二：分别启动

**终端 1 - 启动后端服务器：**
```bash
npm run server
```

**终端 2 - 启动前端开发服务器：**
```bash
npm start
# 或
npm run dev
```

开发服务器将在 http://localhost:3000 启动

### 构建生产版本

```bash
npm run build
```

构建完成后，会在 `dist` 目录生成所有静态文件。


## URL参数

支持通过URL参数传递用户信息：

- `userId`: 用户ID
- `gameAccount`: 游戏账号
- `token`: 认证令牌

示例：
```
http://localhost:3000/?userId=123&gameAccount=player001&token=xxx
```

## 浏览器支持

- Chrome (最新版本)
- Firefox (最新版本)
- Safari (最新版本)
- Edge (最新版本)
- iOS Safari (iOS 8+)
- Android Browser (Android 4+)

## 注意事项

1. 当前使用本地存储模拟数据，实际项目中需要连接后端API
2. 商品图片使用占位符，需要替换为实际图片URL
3. 订单数据存储在localStorage，生产环境应使用服务器存储

## License

MIT

