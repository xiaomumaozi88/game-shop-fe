import { STORAGE_KEYS } from './constants';
import bamDefaultAvatar from '@/assets/img2/bam-default-avatar.png';
import oopsDefaultAvatar from '@/assets/img2/opps-default-avatar.png';
import legacyDefaultAvatar from '@/assets/img2/default_avatar.png';

const BAM_APP_KEY = 'f6594168ce3a9cc57ab7ed74426e25e1';
const OOPS_APP_KEY = '45a56d38bbdd60353438aa25d1ccff20';

function readStoredAppKey(): string | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_GAME_APP_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as string;
  } catch {
    return undefined;
  }
}

/**
 * 按游戏 app_key 返回默认头像资源 URL（与 webpack 打包后的路径一致）
 */
export function getDefaultAvatarByAppKey(appKey: string | undefined | null): string {
  if (appKey === BAM_APP_KEY) return bamDefaultAvatar;
  if (appKey === OOPS_APP_KEY) return oopsDefaultAvatar;
  return legacyDefaultAvatar;
}

/**
 * 未传入 appKey 时从 localStorage 读取当前游戏，再解析默认头像
 */
export function getDefaultAvatarForCurrentGame(): string {
  return getDefaultAvatarByAppKey(readStoredAppKey());
}
