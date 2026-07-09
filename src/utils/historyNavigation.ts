import { STORAGE_KEYS } from './constants';

const DEFAULT_GAME_STORE_GAME_ID = 'oopsie-croco';

const APP_KEY_TO_GAME_ID: Record<string, string> = {
  'f6594168ce3a9cc57ab7ed74426e25e1': 'bam-bam-squad',
  '45a56d38bbdd60353438aa25d1ccff20': 'oopsie-croco',
};

function readStoredAppKey(): string | undefined {
  try {
    const item = localStorage.getItem(STORAGE_KEYS.CURRENT_GAME_APP_KEY);
    if (!item) return undefined;
    return JSON.parse(item) as string;
  } catch {
    return undefined;
  }
}

/** 根据 app_key 得到路由里的 gameId（用于订单页 URL） */
export function getGameIdFromAppKey(appKey: string | null | undefined): string {
  if (!appKey) return DEFAULT_GAME_STORE_GAME_ID;
  return APP_KEY_TO_GAME_ID[appKey] ?? DEFAULT_GAME_STORE_GAME_ID;
}

/**
 * 解析「我的订单」列表路径：优先当前 URL 中的 /game/:gameId，否则用本地记录的游戏
 */
export function resolveOrdersListPath(currentPathname: string): string {
  const m = currentPathname.match(/^\/game\/([^/]+)/);
  if (m?.[1]) return `/game/${m[1]}/history`;
  const stored = readStoredAppKey();
  return `/game/${getGameIdFromAppKey(stored)}/history`;
}

/**
 * 是否为游戏内商品页（/game/:gameId 或 /products），不含 /game/:gameId/history 等子路由。
 * 用于 Header loginBar、Footer 下载区等仅应在「商品页」展示的逻辑。
 */
export function isGameStoreProductsPath(pathname: string): boolean {
  if (pathname === '/products') return true;
  const path = pathname.replace(/\/+$/, '') || pathname;
  return /^\/game\/[^/]+$/.test(path);
}
