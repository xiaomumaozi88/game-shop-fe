// 认证相关工具函数
import { userStore } from '@/store/userStore';
import { gameRoleStore } from '@/store/gameRoleStore';
import { setAuthToken } from './api';
import { messageStore } from '@/store/messageStore';
import { languageStore } from '@/store/languageStore';
import { getTranslation } from '@/i18n';

/**
 * 处理token过期
 * 清空本地存储的登录相关数据，清空区服显示，并显示提示信息
 */
export const handleTokenExpired = (): void => {
  // 清空用户数据
  userStore.clear();
  
  // 清空区服数据
  gameRoleStore.clear();
  
  // 清空token
  setAuthToken(null);
  
  // 显示提示信息
  const locale = languageStore.getLocale();
  const message = getTranslation(locale, 'auth.tokenExpired') || '登录已过期，请重新登录';
  messageStore.show(message);
};

