import { useState, useCallback } from 'react';
import { useUser } from './useUser';

/**
 * Hook for checking login status and showing login modal
 * Returns a function that checks if user is logged in, and if not, shows the login modal
 */
export const useLoginGuard = () => {
  const { user } = useUser();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const requireLogin = useCallback(
    (callback: () => void) => {
      if (!user) {
        // 未登录，显示登录弹窗
        setShowLoginModal(true);
        return false;
      }
      // 已登录，执行回调
      callback();
      return true;
    },
    [user]
  );

  return {
    requireLogin,
    showLoginModal,
    setShowLoginModal,
    isLoggedIn: !!user,
  };
};

