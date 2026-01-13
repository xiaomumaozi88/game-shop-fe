import { User } from '@/types';
import { parseURLParams, storage, STORAGE_KEYS } from '@/utils';
import { setAuthToken } from '@/utils/api';

const USER_STORAGE_KEY = STORAGE_KEYS.USER;
const GAME_ROLE_SELECTIONS_STORAGE_KEY = STORAGE_KEYS.GAME_ROLE_SELECTIONS;

// 游戏角色选择信息的类型定义
interface GameRoleSelection {
  gameServer?: string;
  characterName?: string;
  avatar?: string;
  ss_app_id?: string; // 数数上报 App ID
  ss_url?: string; // 数数上报服务器地址
}

interface UserState {
  user: User | null;
}

class UserStore {
  private listeners: Set<() => void> = new Set();
  private state: UserState = {
    user: this.loadUser(),
  };

  private loadUser(): User | null {
    // 首先尝试从URL参数获取
    const params = parseURLParams();
    if (params.userId || params.gameAccount) {
      const user: User = {
        id: params.userId || '',
        username: params.gameAccount || '玩家',
        gameAccount: params.gameAccount,
      };
      this.state.user = user;
      storage.set(USER_STORAGE_KEY, user);
      
      return user;
    }

    // 从本地存储加载
    const user = storage.get<User>(USER_STORAGE_KEY, undefined);
    
    // 如果用户有 token，同步到 api.ts
    if (user && user.token) {
      setAuthToken(user.token);
    }
    
    return user;
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

  getState(): UserState {
    return this.state;
  }

  getUser(): User | null {
    return this.state.user;
  }

  setUser(user: User): void {
    this.state.user = user;
    storage.set(USER_STORAGE_KEY, user);
    
    // 同步 token 到 api.ts
    if (user.token) {
      setAuthToken(user.token);
    } else {
      setAuthToken(null);
    }
    
    this.notify();
  }

  updateBalance(currency: string, amount: number): void {
    if (this.state.user) {
      if (!this.state.user.balance) {
        this.state.user.balance = {};
      }
      this.state.user.balance[currency] = amount;
      storage.set(USER_STORAGE_KEY, this.state.user);
      this.notify();
    }
  }

  /**
   * 保存当前游戏的角色选择信息（按 token 标识）
   * @param appKey 游戏 appKey
   * @param thinkingDataConfig 数数配置信息（可选）
   */
  saveGameRoleSelection(appKey: string, thinkingDataConfig?: { ss_app_id?: string; ss_url?: string }): void {
    if (!this.state.user || !appKey || !this.state.user.token) return;
    
    const token = this.state.user.token;
    // 存储结构：{ [token]: { [appKey]: GameRoleSelection } }
    const tokenSelections = storage.get<Record<string, Record<string, GameRoleSelection>>>(GAME_ROLE_SELECTIONS_STORAGE_KEY, {}) || {};
    
    // 获取当前 token 的选择数据
    const selections = tokenSelections[token] || {};
    // 获取该游戏之前保存的数据（用于保留数数配置）
    const previousSelection = selections[appKey] || {};
    
    selections[appKey] = {
      gameServer: this.state.user.gameServer,
      characterName: this.state.user.characterName,
      avatar: this.state.user.avatar,
      // 如果传入了新的数数配置，使用新的；否则保留之前保存的数数配置
      ss_app_id: thinkingDataConfig?.ss_app_id ?? previousSelection.ss_app_id,
      ss_url: thinkingDataConfig?.ss_url ?? previousSelection.ss_url,
    };
    
    // 保存回按 token 分组的存储结构
    tokenSelections[token] = selections;
    storage.set(GAME_ROLE_SELECTIONS_STORAGE_KEY, tokenSelections);
  }

  /**
   * 获取指定游戏的角色选择信息（按 token 标识）
   * 只有当前 token 与存储的 token 一致时才返回
   */
  getGameRoleSelection(appKey: string): GameRoleSelection | null {
    if (!appKey || !this.state.user?.token) return null;
    
    const token = this.state.user.token;
    // 存储结构：{ [token]: { [appKey]: GameRoleSelection } }
    const tokenSelections = storage.get<Record<string, Record<string, GameRoleSelection>>>(GAME_ROLE_SELECTIONS_STORAGE_KEY, {}) || {};
    
    // 只读取当前 token 的数据
    const selections = tokenSelections[token];
    if (!selections) return null;
    
    return selections[appKey] || null;
  }

  /**
   * 清除游戏特定的字段（切换游戏时调用）
   * 在清除前保存当前游戏的角色选择
   * 然后加载新游戏的角色选择（如果有）
   * @param previousAppKey 切换前的 appKey（用于保存当前游戏的选择）
   * @param newAppKey 切换后的 appKey（用于加载新游戏的选择）
   */
  clearGameSpecificFields(previousAppKey?: string, newAppKey?: string): void {
    if (!this.state.user) return;

    // 如果没有传入 previousAppKey，尝试从 localStorage 读取
    const currentAppKey = previousAppKey || storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
    
    // 保存当前游戏的角色选择
    if (currentAppKey) {
      this.saveGameRoleSelection(currentAppKey);
    }

    // 清除当前用户信息中的游戏特定字段
    this.state.user.gameServer = undefined;
    this.state.user.characterName = undefined;
    this.state.user.avatar = undefined;

    // 如果切换到了新游戏，尝试加载该游戏的角色选择
    if (newAppKey) {
      const selection = this.getGameRoleSelection(newAppKey);
      if (selection) {
        this.state.user.gameServer = selection.gameServer;
        this.state.user.characterName = selection.characterName;
        this.state.user.avatar = selection.avatar;
        
        // 如果有数数配置，自动初始化 SDK（在组件中调用，这里只返回配置信息）
        // 实际初始化会在组件中进行
      }
    }

    // 注意：不清除 sdkId, country, ip, platform，因为这些是全局的
    storage.set(USER_STORAGE_KEY, this.state.user);
    this.notify();
  }

  /**
   * 清除当前 token 的所有相关数据
   */
  clearTokenData(token: string): void {
    if (!token) return;
    
    // 清除角色选择信息（只清除当前 token 的数据）
    const tokenSelections = storage.get<Record<string, Record<string, GameRoleSelection>>>(GAME_ROLE_SELECTIONS_STORAGE_KEY, {}) || {};
    if (tokenSelections[token]) {
      delete tokenSelections[token];
      storage.set(GAME_ROLE_SELECTIONS_STORAGE_KEY, tokenSelections);
    }
    
    // 清除已上报的 SDK 登录记录
    const reportedKeys = storage.get<Record<string, string[]>>(STORAGE_KEYS.SDK_LOGIN_REPORTED_KEYS, {}) || {};
    if (reportedKeys[token]) {
      delete reportedKeys[token];
      storage.set(STORAGE_KEYS.SDK_LOGIN_REPORTED_KEYS, reportedKeys);
    }
    
    // 清除已上报的内购曝光记录
    const iapShowKeys = storage.get<Record<string, string[]>>(STORAGE_KEYS.IAP_SHOW_REPORTED_KEYS, {}) || {};
    if (iapShowKeys[token]) {
      delete iapShowKeys[token];
      storage.set(STORAGE_KEYS.IAP_SHOW_REPORTED_KEYS, iapShowKeys);
    }
  }

  clear(): void {
    // 在清除前，先清除当前 token 的所有相关数据
    if (this.state.user?.token) {
      this.clearTokenData(this.state.user.token);
    }
    
    this.state.user = null;
    storage.remove(USER_STORAGE_KEY);
    
    // 清除 token
    setAuthToken(null);
    
    this.notify();
  }
}

export const userStore = new UserStore();

