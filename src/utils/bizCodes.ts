/**
 * 业务错误码定义
 * 根据后端约定，code 为 0 时代表成功
 * 当请求出错时，接口会返回 biz_code 字段
 */

// 默认业务错误码
export type BizCode = number;

export const DefaultBizCode = 900400; // 默认业务错误码，内部参数错误
export const DefaultBizCodeAuthenticationFailed = 900401; // 登录认证失败
export const DefaultBizCodeAuthenticationExpired = 900402; // 登录认证过期

// 商城业务错误码 1000001-1001000
export const DefaultBizCodeSysError = 1000000; // 系统内部错误, 不会暴露具体信息给前端
export const DefaultBizCodeInternalParamError = 1000001; // 内部参数错误，一般用于内部参数校验错误

// 验证码相关错误码
export const CaptchaIdOrCodeIsEmpty = 1000002; // Captcha id or code is empty.
export const EmailInvalid = 1000003; // Email invalid.
export const CaptchaCodeInvalid = 1000004; // Captcha code invalid.
export const EmailCodeAlreadySent = 1000005; // Email code already sent, please wait 5 minutes and try again.
export const EmailCodeSendLimit = 1000006; // Email code send limit, please try again tomorrow.
export const EmailCouldNotBeEmpty = 1000007; // Email could not be empty.
export const CodeCouldNotBeEmpty = 1000008; // Code could not be empty.
export const CodeInvalid = 1000009; // Code invalid.
export const GetUserLoginTokenError = 1000010; // Get user login token error.
export const CodeExpired = 1000019; // Code expired.

// 商品相关错误码
export const ProductIsInactive = 1000011; // Product is inactive, please try another product.
export const ProductPurchaseLimitExceeded = 1000012; // The product has exceeded the purchase limit, please select another product.
export const ProductTakenOffline = 1000013; // The product has been taken offline.
export const SinglePurchaseQuantityLimitReached = 1000018; // The single purchase quantity limit has been reached.

// 支付相关错误码
export const PaymentMethodNotEnabled = 1000014; // Payment method not enabled.
export const AccountNotSupportPurchase = 1000015; // Your account does not support purchasing products, please contact customer service.
export const CreateOrderFailed = 1000016; // Failed to create an order, please try again.
export const BmallOrderCannotCancel = 1000017; // 订单不可取消（非待支付或无权操作）

/**
 * 验证码相关的错误码列表
 * 这些错误需要在输入框下显示红色错误信息
 */
export const CAPTCHA_RELATED_ERROR_CODES = [
  CaptchaIdOrCodeIsEmpty,
  EmailInvalid,
  CaptchaCodeInvalid,
  EmailCodeAlreadySent,
  EmailCodeSendLimit,
  EmailCouldNotBeEmpty,
  CodeCouldNotBeEmpty,
  CodeInvalid,
  CodeExpired,
] as const;
