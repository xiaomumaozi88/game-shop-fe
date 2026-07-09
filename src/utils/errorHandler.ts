/**
 * 错误处理工具函数
 */
import { getTranslation } from '@/i18n';
import { languageStore } from '@/store/languageStore';
import { messageStore } from '@/store/messageStore';
import {
  DefaultBizCodeSysError,
  DefaultBizCodeAuthenticationExpired,
  CAPTCHA_RELATED_ERROR_CODES,
} from './bizCodes';
import type { BizCode } from './bizCodes';
import { handleTokenExpired } from './auth';

/**
 * 根据 biz_code 获取本地化的错误信息
 * @param bizCode 业务错误码
 * @param locale 语言代码，如果不提供则从 languageStore 获取
 * @returns 本地化的错误信息
 */
export const getErrorMessage = (bizCode: number | undefined, locale?: string): string => {
  if (!bizCode) {
    return '';
  }

  const currentLocale = locale || languageStore.getLocale();
  const errorKey = `errors.${bizCode}`;
  const message = getTranslation(currentLocale as any, errorKey);

  // 如果找到了翻译，返回翻译；否则返回默认错误信息
  if (message !== errorKey) {
    return message;
  }

  // 如果没有找到翻译，返回默认错误信息
  return getTranslation(currentLocale as any, 'errors.1000000') || '系统错误，请稍后重试';
};

export const getDefaultApiErrorMessage = (locale?: string): string => {
  const currentLocale = locale || languageStore.getLocale();
  return getTranslation(currentLocale as any, `errors.${DefaultBizCodeSysError}`) || '系统错误，请稍后重试';
};

export const isAuthExpiredError = (
  code?: number,
  bizCode?: BizCode,
  msg?: string
): boolean => {
  return code === 401 || bizCode === DefaultBizCodeAuthenticationExpired || msg === 'JWT token has expired';
};

export const getApiErrorMessage = (
  code?: number,
  bizCode?: BizCode,
  msg?: string
): string | null => {
  if (code === 0) {
    return null;
  }

  const currentLocale = languageStore.getLocale();

  if (isAuthExpiredError(code, bizCode, msg)) {
    return getTranslation(currentLocale as any, 'auth.tokenExpired')
      || getErrorMessage(DefaultBizCodeAuthenticationExpired, currentLocale)
      || getDefaultApiErrorMessage(currentLocale);
  }

  return getErrorMessage(bizCode, currentLocale) || getDefaultApiErrorMessage(currentLocale);
};

/**
 * 检查错误码是否为验证码相关错误
 * @param bizCode 业务错误码
 * @returns 是否为验证码相关错误
 */
export const isCaptchaRelatedError = (bizCode: number | undefined): boolean => {
  if (!bizCode) {
    return false;
  }
  return (CAPTCHA_RELATED_ERROR_CODES as readonly number[]).includes(bizCode);
};

/**
 * 处理 API 错误响应
 * @param code API 响应码（0 表示成功）
 * @param bizCode 业务错误码
 * @param msg 错误消息（备用）
 * @returns 处理后的错误信息，如果成功或需要特殊处理则返回 null
 */
export const handleApiError = (
  code: number,
  bizCode?: BizCode,
  msg?: string
): string | null => {
  // code 为 0 表示成功
  if (code === 0) {
    return null;
  }

  // 处理登录认证过期
  if (isAuthExpiredError(code, bizCode, msg)) {
    handleTokenExpired();
    return getApiErrorMessage(code, bizCode, msg);
  }

  return getApiErrorMessage(code, bizCode, msg);
};

/**
 * 使用 toast 显示错误信息
 * @param errorMessage 错误信息
 */
export const showErrorToast = (errorMessage: string): void => {
  if (errorMessage) {
    messageStore.show(errorMessage);
  }
};
