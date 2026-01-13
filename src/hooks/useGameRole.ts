import { useEffect, useState } from 'react';
import { gameRoleStore } from '@/store/gameRoleStore';
import { GameServerRoleItem } from '@/utils/api';

/**
 * Hook for accessing game role list from global store
 * 用于访问全局游戏角色列表的 Hook
 */
export const useGameRole = () => {
  const [state, setState] = useState(gameRoleStore.getState());

  useEffect(() => {
    const unsubscribe = gameRoleStore.subscribe(() => {
      setState({ ...gameRoleStore.getState() }); // 创建新对象确保 React 检测到变化
    });

    return unsubscribe;
  }, []);

  return {
    roles: state.roles,
    loading: state.loading,
    error: state.error,
    /**
     * 根据 app_key 获取该游戏的所有角色
     */
    getRolesByAppKey: (appKey: string): GameServerRoleItem[] => {
      return gameRoleStore.getRolesByAppKey(appKey);
    },
    /**
     * 检查指定 app_key 是否有角色账号
     */
    hasRolesForAppKey: (appKey: string): boolean => {
      return gameRoleStore.hasRolesForAppKey(appKey);
    },
    /**
     * 获取所有角色
     */
    getAllRoles: (): GameServerRoleItem[] => {
      return gameRoleStore.getRoles();
    },
  };
};

