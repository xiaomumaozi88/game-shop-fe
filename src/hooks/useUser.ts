import { useEffect, useState } from 'react';
import { userStore } from '@/store/userStore';
import { User } from '@/types';

export const useUser = () => {
  const [user, setUser] = useState<User | null>(userStore.getUser());

  useEffect(() => {
    const unsubscribe = userStore.subscribe(() => {
      setUser(userStore.getUser());
    });

    return unsubscribe;
  }, []);

  return {
    user,
    setUser: userStore.setUser.bind(userStore),
    updateBalance: userStore.updateBalance.bind(userStore),
    clear: userStore.clear.bind(userStore),
    clearGameSpecificFields: userStore.clearGameSpecificFields.bind(userStore),
    saveGameRoleSelection: userStore.saveGameRoleSelection.bind(userStore),
    getGameRoleSelection: userStore.getGameRoleSelection.bind(userStore),
  };
};

