// 认证相关工具函数
import { userStore } from '@/store/userStore';
import { gameRoleStore } from '@/store/gameRoleStore';
import { authApi, setAuthToken } from './api';
import { messageStore } from '@/store/messageStore';
import { languageStore } from '@/store/languageStore';
import { getTranslation } from '@/i18n';
import { thinkingData } from './thinkingData';

/**
 * 清除本地登录态（用户、区服、token、数数会话）
 */
export const clearLocalAuthState = (): void => {
  userStore.clear();
  gameRoleStore.clear();

  if (thinkingData.isInitialized()) {
    thinkingData.logout();
  }
};

/**
 * 调用商城退出登录接口，仅当 code 为 0 时清除本地登录态
 */
export const logoutUser = async (): Promise<{ success: boolean; error?: string }> => {
  const token = userStore.getUser()?.token;
  if (!token) {
    clearLocalAuthState();
    return { success: true };
  }

  const result = await authApi.logout();
  if (result.success) {
    clearLocalAuthState();
    return { success: true };
  }

  return {
    success: false,
    error: result.error,
  };
};

/**
 * 处理token过期
 * 清空本地存储的登录相关数据，清空区服显示，并显示提示信息
 */
export const handleTokenExpired = (): void => {
  clearLocalAuthState();

  // userStore.clear 已清 token；此处保持与历史逻辑一致
  setAuthToken(null);

  const locale = languageStore.getLocale();
  const message = getTranslation(locale, 'auth.tokenExpired') || '登录已过期，请重新登录';
  messageStore.show(message);
};
