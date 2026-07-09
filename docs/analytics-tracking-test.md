# 游戏商城埋点测试文档

> 上报平台：**ThinkingData（数数）**
> 代码入口：`src/utils/analytics.ts`
> 测试时打开浏览器控制台，搜索 `✅ 触发` 可快速确认事件是否发出。

---

## 一、上报前置条件

| 条件 | 说明 |
|------|------|
| 数数 SDK 已初始化 | 用户详情接口返回 `ss_app_id`、`ss_url` 后，选择区服/角色时初始化 |
| 用户已登录 | 多数事件需要有效 `token` |
| 已选择角色 | `store_iap_show` 要求 `characterName` 或 `gameServer` 已有值 |
| 游戏内跳转标识 | URL 含 `from_app` 或 `game_redirect` 时，`is_game_redirect = true` |

**注意：** SDK 未初始化时事件会被跳过，控制台会有 `数数SDK未初始化，跳过 xxx 事件上报` 警告。

---

## 二、事件总览

| 序号 | 事件名 | 业务含义 | 去重规则 |
|------|--------|----------|----------|
| 1 | `store_sdk_login` | 商城登录成功 | 同一 `appKey + token` 仅上报一次（本地持久化） |
| 2 | `store_role_select` | 选择区服/角色完成 | 每次选角成功上报（无去重） |
| 3 | `store_iap_show` | 商品卡片曝光 | 同一 `token + product_id` 仅上报一次 |
| 4 | `store_iap_click` | 点击支付（创建订单成功） | 每次支付点击上报 |
| 5 | `store_iap_success` | 支付成功 | 每笔成功订单上报一次（弹窗内防重复） |
| 6 | `store_iap_fail` | 支付失败/取消 | 同一次回跳流程防重复上报 |

---

## 三、事件详情与触发时机

### 1. `store_sdk_login` — 商城登录成功

**触发时机：**

- 用户在顶栏选择区服/角色，且用户详情接口成功后（`Header.tsx`）
- 商品页选择区服/角色，且用户详情接口成功后（`Products.tsx`）
- 包含：邮箱登录后选手、游戏内跳转自动登录后选手

**触发页面：** 任意页（选角发生在 Header 区服弹窗 / 商品页选服流程）

**不上报情况：**

- 同一 `appKey|token` 已上报过
- 无 `token`
- 数数 SDK 未初始化

**属性：**

| 字段 | 说明 |
|------|------|
| `account_id` | SDK 账号 ID（`sdk_id`） |
| `is_game_redirect` | 是否游戏内跳转 |
| `#country_code` | 国家（有则带） |
| `#os` | 平台（有则带） |
| `#ip` | IP（有则带） |

---

### 2. `store_role_select` — 选择角色

**触发时机：**

- 与 `store_sdk_login` 同一流程，用户详情拉取成功且数数初始化成功后**紧接着**上报
- 手动选区服、游戏内跳转自动选角均会触发

**属性：**

| 字段 | 说明 |
|------|------|
| `account_id` | SDK 账号 ID |
| `is_game_redirect` | 是否游戏内跳转 |
| `server_channel` | 区服 ID（数字） |
| `#account_id` | 角色 ID（`game_user_id`） |
| `#country_code` / `#os` / `#ip` | 同登录事件 |

---

### 3. `store_iap_show` — 商品曝光

**触发时机：**

- 商品列表页，商品卡片 **≥50% 进入可视区域**时（`IntersectionObserver`）
- 无需点击商品，仅曝光即可

**触发页面：** `/products/:gameId` 商品列表

**不上报情况：**

- 未登录 / 无 `token`
- 未选角色（无 `characterName` 且无 `gameServer`）
- 当前登录下该 `product_id` 已曝光过
- 数数 SDK 未初始化

**属性：**

| 字段 | 说明 |
|------|------|
| 公共字段 | `account_id`、`is_game_redirect`、`server_channel`、`#account_id` 等 |
| `product_id` | 商品 ID |
| `iap` | IAP 标识 |
| `price` | 价格 |
| `currency` | 货币 |

**测试建议：** 滚动商品列表，使卡片过半可见；刷新后同一商品不应重复上报。

---

### 4. `store_iap_click` — 内购点击（发起支付）

**触发时机：**

- 商品详情弹窗 → 购买确认 → **创建订单接口成功**后立即上报
- 发生在跳转支付页（`h5_url` / Airwallex）**之前**

**触发页面：** 商品列表页（`ProductModal`）

**属性：**

| 字段 | 说明 |
|------|------|
| 公共字段 + 商品字段 | 同 `store_iap_show` |
| `payment_type` | 支付方式（有值才带，见第五节） |

**`payment_type` 规则（点击时）：**

- 一般使用创建订单接口返回的 `payment_type`
- **Airwallex 流程**（返回 `billing_checkout_url` 或 `intent_id + client_secret`）：若后端未返回，前端按 `is_game_redirect` 补全为 `airwallex_store` / `airwallex_h5store`

---

### 5. `store_iap_success` — 支付成功

**触发时机：**

- **主流程：** 支付完成回跳商品页 → 弹出支付成功弹窗 → 查单确认 `pay_status=1` 或存在 `pay_success_time` 后上报（`PaymentSuccessModal.tsx`）
- **遗留流程：** Stripe Session 回调页 `/payment-return?session_id=xxx` 且状态 `complete`（`PaymentReturn.tsx`，`payment_type` 固定 `stripe_store`）

**属性：**

| 字段 | 说明 |
|------|------|
| 公共字段 + 商品字段 | 同上 |
| `payment_type` | 查单接口 `payment_type`，Airwallex 订单会归一化 |
| `environment` | `production` 或 `sandbox`（由 `NODE_ENV` 决定） |

**防重复：** 同一弹窗实例内 `successEventTracked` 仅上报一次。

---

### 6. `store_iap_fail` — 支付失败

**触发时机：**

| 场景 | 页面/组件 | 说明 |
|------|-----------|------|
| 支付回跳失败 | `Products.tsx` | URL 带 `order_no` 且 `type=FAIL_URL` / `payment_failed=true` 等，查单后未支付成功 |
| Stripe 弹窗取消/失败 | `StripeCheckout.tsx` | 用户取消、创建 Session 失败等（**当前主流程已注释 Stripe 弹窗**） |
| Stripe 回调失败 | `PaymentReturn.tsx` | Session 状态非 complete（`payment_type` 固定 `stripe_store`） |

**属性：**

| 字段 | 说明 |
|------|------|
| 公共字段 + 商品字段 | 同上 |
| `payment_type` | 查单或订单创建时的值 |
| `environment` | `production` / `sandbox` |
| `fail_reason` | 失败原因英文描述 |

**常见 `fail_reason`：**

- `Payment not completed or cancelled`
- `Order closed`
- `User cancelled`
- `Payment session expired`

---

## 四、公共属性说明

以下字段在 `store_iap_click` / `store_iap_success` / `store_iap_fail` 中通过 `getCommonProperties()` 注入；`store_iap_show` 单独组装，字段基本一致。

| 字段 | 类型 | 说明 |
|------|------|------|
| `account_id` | string | SDK 账号（`sdk_id` 优先） |
| `is_game_redirect` | boolean | URL 含 `from_app` 或 `game_redirect` 时为 `true` |
| `server_channel` | number | 区服 ID |
| `#account_id` | string | 角色 ID（`game_user_id`） |
| `#country_code` | string | 国家代码 |
| `#os` | string | 操作系统/平台 |
| `#ip` | string | 用户 IP |

---

## 五、`payment_type` 取值说明

`payment_type` 是**属性字段**，不是独立事件名。仅 `store_iap_click` / `store_iap_success` / `store_iap_fail` 携带（有值才上报）。

| 值 | 含义 | 典型来源 |
|----|------|----------|
| `stripe_store` | Stripe，直接登录商城 | 后端返回；`PaymentReturn` 写死 |
| `stripe_h5store` | Stripe，游戏内跳转商城 | 后端返回 |
| `airwallex_store` | Airwallex，直接登录商城 | 后端返回；或 Airwallex 流程前端补全 |
| `airwallex_h5store` | Airwallex，游戏内跳转商城 | 后端返回；或 Airwallex 流程前端补全 |
| `Apple` / `Google` | 原生支付（预留） | 常量已定义，当前代码未使用 |

**区分 store / h5store：**

- 后端显式返回 → 直接用
- Airwallex 且后端未返回 → 看 URL 是否游戏内跳转：
  - 有 `from_app` / `game_redirect` → `airwallex_h5store`
  - 否则 → `airwallex_store`

**`store_iap_show` 不含 `payment_type`。**

---

## 六、推荐测试用例

### 用例 A：完整购买成功（商城直登 + H5/Stripe）

1. 直接打开商城，邮箱登录
2. 进入某游戏商品页，选择区服
3. 验证：`store_sdk_login`、`store_role_select`
4. 滚动列表，验证：`store_iap_show`（每个商品仅一次）
5. 点击商品 → 确认购买 → 创建订单
6. 验证：`store_iap_click`（检查 `payment_type`）
7. 完成支付并回跳
8. 验证：`store_iap_success`（检查 `payment_type`、`environment`）

### 用例 B：游戏内跳转

1. 带 `?from_app=1` 或 `?game_redirect=1` 打开商城
2. 重复用例 A 步骤 3–8
3. 验证：`is_game_redirect = true`
4. Airwallex 支付时验证 `payment_type` 为 `airwallex_h5store`（或后端返回值）

### 用例 C：支付失败/取消

1. 发起支付后在支付页取消或失败回跳
2. URL 带 `order_no` + 失败标识
3. 验证：`store_iap_fail`，检查 `fail_reason`、`payment_type`

### 用例 D：曝光去重

1. 登录并选角后进入商品页
2. 滚动使某商品曝光 → 应触发 `store_iap_show`
3. 刷新页面，再次滚动到同一商品 → **不应**再次触发

### 用例 E：登录去重

1. 登录并选角 → 触发 `store_sdk_login`
2. 切换页面再次选同一游戏同一账号 → **不应**再次触发 `store_sdk_login`
3. 退出换号重新登录 → 应再次触发

---

## 七、测试验证方法

### 控制台日志

成功上报时控制台输出示例：

```
✅ 触发"store_iap_click"事件，商品：钻石 ×6480，时间：2026/05/26 17:30:00
trackStoreIapClick properties { account_id: "...", payment_type: "stripe_store", ... }
```

### 数数后台

按事件名筛选：`store_sdk_login`、`store_role_select`、`store_iap_show`、`store_iap_click`、`store_iap_success`、`store_iap_fail`。

建议交叉验证字段：

- `is_game_redirect`
- `payment_type`
- `product_id` / `iap`
- `fail_reason`（失败事件）

---

## 八、当前实现注意点（测试需知）

1. **主支付路径**为创建订单后跳转 `h5_url` 或 Airwallex，Stripe 嵌入式弹窗代码已注释，一般不走 `StripeCheckout`。
2. **`PaymentReturn` 页面**为遗留 Stripe Session 回调，`payment_type` 固定 `stripe_store`。
3. **`store_iap_success` 主路径**在支付成功弹窗查单成功后上报，不是点击「确定」时上报。
4. **订单页重新支付**（`History.tsx`）当前**不**触发 `store_iap_click`，仅跳转支付。
5. 所有事件依赖数数 SDK 在用户详情接口返回配置后初始化；未选角色前商品曝光不会上报。

---

## 九、事件触发流程图

```
登录 → 选择区服/角色
         ├─ store_sdk_login（去重）
         └─ store_role_select

进入商品列表 → 卡片 50% 可见
         └─ store_iap_show（每商品去重）

点击商品 → 确认购买 → 创建订单成功
         └─ store_iap_click（含 payment_type）
                ↓
           跳转支付页 / Airwallex
                ↓
         ┌──────┴──────┐
    支付成功        支付失败/取消
         │                │
 store_iap_success   store_iap_fail
（成功弹窗查单）    （回跳查单 / Stripe回调）
```

---

*文档版本：与当前 `game-shop-fe` 代码同步，如有接口或支付流程变更请同步更新本文档。*
