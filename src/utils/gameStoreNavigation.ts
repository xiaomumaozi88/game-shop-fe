import { gameRoleStore } from '@/store/gameRoleStore';
import { gameRoleApi } from './api';
import { getGameIdFromAppKey } from './historyNavigation';

/** 从订单页/商品页跳回首页时，用于展示「无角色」提示弹窗 */
export type GameStoreNoRoleLocationState = {
  showNoRoleForGameId?: string;
};

export const BAM_BAM_SQUAD_APP_KEY = 'f6594168ce3a9cc57ab7ed74426e25e1';
export const OOPSIE_CROCO_APP_KEY = '45a56d38bbdd60353438aa25d1ccff20';

/** 商店入口已上线、可在首页等展示的游戏 id */
export const VISIBLE_GAME_STORE_GAME_IDS = ['oopsie-croco'] as const;

export const DEFAULT_GAME_STORE_GAME_ID = 'oopsie-croco';

export function isGameStoreEntryVisible(gameId: string): boolean {
  return (VISIBLE_GAME_STORE_GAME_IDS as readonly string[]).includes(gameId);
}

export function getDefaultGameStoreAppKey(): string {
  return OOPSIE_CROCO_APP_KEY;
}

export const GAME_STORE_APP_KEYS = [
  BAM_BAM_SQUAD_APP_KEY,
  OOPSIE_CROCO_APP_KEY,
] as const;

const GAME_ID_TO_APP_KEY: Record<string, string> = {
  'bam-bam-squad': BAM_BAM_SQUAD_APP_KEY,
  'oopsie-croco': OOPSIE_CROCO_APP_KEY,
  oopsie: OOPSIE_CROCO_APP_KEY,
};

export function buildNoRoleHomeState(gameId: string): GameStoreNoRoleLocationState {
  return { showNoRoleForGameId: gameId };
}

export function getAppKeyByGameStoreGameId(gameId: string | undefined): string | undefined {
  if (!gameId) return undefined;
  return GAME_ID_TO_APP_KEY[gameId];
}

/** 进入商品页/返回专区前拉取最新角色列表，避免本地缓存导致误判 */
export async function refreshGameStoreRoles(): Promise<void> {
  gameRoleStore.setLoading(true);
  try {
    const res = await gameRoleApi.getGameServerRoleList([...GAME_STORE_APP_KEYS]);
    if (res.success && res.data) {
      gameRoleStore.setRoles(res.data);
    } else {
      gameRoleStore.setError(res.error || '获取游戏角色列表失败');
    }
  } catch (error) {
    gameRoleStore.setError(error instanceof Error ? error.message : '获取游戏角色列表失败');
  } finally {
    gameRoleStore.setLoading(false);
  }
}

export function hasGameStoreRolesForAppKey(appKey: string): boolean {
  return gameRoleStore.hasRolesForAppKey(appKey);
}

/** 解析「返回专区」目标：优先路由 gameId，否则用 appKey */
export function resolveGameStoreTargetFromRouteAndAppKey(
  routeGameId: string | undefined,
  appKey: string
): { gameId: string; appKey: string } | null {
  const routeAppKey = getAppKeyByGameStoreGameId(routeGameId);
  if (routeAppKey) {
    return { appKey: routeAppKey, gameId: routeGameId! };
  }
  if (!appKey) return null;
  const gameId = getGameIdFromAppKey(appKey);
  return { gameId, appKey };
}
