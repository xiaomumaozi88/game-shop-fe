import { GameServerRoleItem } from '@/utils/api';
import { STORAGE_KEYS } from '@/utils/constants';

// 直接定义storage，避免循环依赖
const storage = {
  get: <T>(key: string, defaultValue?: T): T | null => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue ?? null;
    } catch {
      return defaultValue ?? null;
    }
  },
  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  },
};

const GAME_ROLES_STORAGE_KEY = STORAGE_KEYS.GAME_ROLES;

interface GameRoleState {
  roles: GameServerRoleItem[];
  loading: boolean;
  error: string | null;
}

class GameRoleStore {
  private listeners: Set<() => void> = new Set();
  private state: GameRoleState = {
    roles: this.loadRoles(),
    loading: false,
    error: null,
  };

  private loadRoles(): GameServerRoleItem[] {
    // 从本地存储加载游戏角色列表
    const roles = storage.get<GameServerRoleItem[]>(GAME_ROLES_STORAGE_KEY, []);
    return roles || [];
  }

  private saveRoles(): void {
    // 保存游戏角色列表到本地存储
    storage.set(GAME_ROLES_STORAGE_KEY, this.state.roles);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): GameRoleState {
    return this.state;
  }

  getRoles(): GameServerRoleItem[] {
    return this.state.roles;
  }

  /**
   * 根据 app_key 获取该游戏的所有角色
   */
  getRolesByAppKey(appKey: string): GameServerRoleItem[] {
    return this.state.roles.filter((role) => role.app_key === appKey);
  }

  /**
   * 检查指定 app_key 是否有角色账号
   */
  hasRolesForAppKey(appKey: string): boolean {
    return this.state.roles.some((role) => role.app_key === appKey);
  }

  setRoles(roles: GameServerRoleItem[]): void {
    this.state.roles = roles;
    this.state.error = null;
    this.saveRoles(); // 保存到本地存储
    this.notify();
  }

  setLoading(loading: boolean): void {
    this.state.loading = loading;
    this.notify();
  }

  setError(error: string | null): void {
    this.state.error = error;
    this.state.loading = false;
    this.notify();
  }

  clear(): void {
    this.state.roles = [];
    this.state.loading = false;
    this.state.error = null;
    storage.remove(GAME_ROLES_STORAGE_KEY); // 清除本地存储
    this.notify();
  }
}

export const gameRoleStore = new GameRoleStore();

