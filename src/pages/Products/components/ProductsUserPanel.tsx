import React, { useMemo } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useUser } from '@/hooks/useUser';
import { useGameRole } from '@/hooks/useGameRole';
import { useResponsive } from '@/hooks/useResponsive';
import { useProductsUserPanelVisibility } from '@/hooks/useProductsUserPanelVisibility';
import { storage, STORAGE_KEYS } from '@/utils';
import exitIcon from '@/assets/img2/touka_home_ic_exit.png';
import bamGameIcon from '@/assets/img2/bam_icon.png';
import oopsieGameIcon from '@/assets/img2/oopsie_icon.png';
import panelCardBgImg from '@/assets/img2/pay_game_window_infbg.png';
import { ProductsUserPanelRoleRow } from './ProductsUserPanelRoleRow';
import styles from './ProductsUserPanel.module.less';

interface ProductsUserPanelProps {
  gameId?: string;
  onSwitchServer: () => void;
  onLogout: () => void;
}

function getGameNameByGameId(gameId: string | undefined, t: (key: string) => string): string {
  if (gameId === 'bam-bam-squad') return t('games.bamBamSquad');
  if (gameId === 'oopsie-croco' || gameId === 'oopsie') return t('games.oopsieCroco');
  return '';
}

function getGameIconByGameId(gameId: string | undefined): string | null {
  if (gameId === 'bam-bam-squad') return bamGameIcon;
  if (gameId === 'oopsie-croco' || gameId === 'oopsie') return oopsieGameIcon;
  return null;
}

function resolveGameId(gameId: string | undefined, appKey: string | undefined): string | undefined {
  if (gameId) return gameId;
  if (appKey === 'f6594168ce3a9cc57ab7ed74426e25e1') return 'bam-bam-squad';
  if (appKey === '45a56d38bbdd60353438aa25d1ccff20') return 'oopsie-croco';
  return undefined;
}

function formatServerDisplay(gameServer?: string, platform?: string): string {
  if (!gameServer) return '';
  const platformLabel =
    platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : platform || '';
  return platformLabel ? `${platformLabel} / ${gameServer}` : gameServer;
}

export const ProductsUserPanel: React.FC<ProductsUserPanelProps> = ({
  gameId,
  onSwitchServer,
  onLogout,
}) => {
  const { t, locale } = useLanguage();
  const { isMobile, isTablet, isTouchLandscape } = useResponsive();
  const panelVisible = useProductsUserPanelVisibility();
  const shouldUseCompactPanelToggle = isMobile || isTablet || isTouchLandscape;
  const effectivePanelVisible = !shouldUseCompactPanelToggle || panelVisible;
  const isTightGreetingLocale =
    locale === 'ja-JP' || locale === 'ko-KR' || locale === 'ru-RU' || locale === 'vi-VN';
  const { user } = useUser();
  const { getRolesByAppKey } = useGameRole();

  const appKey = storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
  const resolvedGameId = useMemo(() => resolveGameId(gameId, appKey), [gameId, appKey]);
  const gameIcon = useMemo(() => getGameIconByGameId(resolvedGameId), [resolvedGameId]);
  const gameName = getGameNameByGameId(resolvedGameId, t);

  const serverDisplayLabel = useMemo(() => {
    if (!user?.gameServer) return '';
    const roles = appKey ? getRolesByAppKey(appKey) : [];
    const role = roles.find((r) => r.game_server_channel === user.gameServer);
    if (role?.game_server_name) {
      return formatServerDisplay(role.game_server_name, user.platform);
    }
    return formatServerDisplay(user.gameServer, user.platform);
  }, [user?.gameServer, user?.platform, appKey, getRolesByAppKey]);

  const characterDisplayName = useMemo(() => {
    if (!user?.characterName) return '';
    const roles = appKey ? getRolesByAppKey(appKey) : [];
    const role = roles.find((r) => r.game_user_id === user.characterName);
    return role?.role_name || user.characterName;
  }, [user?.characterName, appKey, getRolesByAppKey]);

  if (!user) return null;

  return (
    <aside
      className={`${styles.panel}${effectivePanelVisible ? ` ${styles.panelVisible}` : ` ${styles.panelHidden}`}${
        isTightGreetingLocale ? ` ${styles.panelTightLocale}` : ''
      }`}
      aria-label={t('header.greeting')}
      aria-hidden={!effectivePanelVisible}
    >
      <div className={styles.panelCard}>
        <img src={panelCardBgImg} alt="" className={styles.panelCardBg} aria-hidden />
        <div className={styles.panelCardInner}>
        {gameIcon && (
          <div className={styles.avatarWrap}>
            <img src={gameIcon} alt="" className={styles.gameIcon} aria-hidden />
          </div>
        )}
        {gameName && <h2 className={styles.gameName}>{gameName}</h2>}
        <div className={styles.greetingRow}>
          <div className={styles.greetingGroup}>
            <span className={styles.greetingText}>
              {t('header.greeting')}, {user.email || user.gameAccount || user.username}
            </span>
            <button type="button" className={styles.logoutButton} onClick={onLogout} aria-label="退出">
              <img src={exitIcon} alt="" className={styles.logoutIcon} />
            </button>
          </div>
        </div>
        <ProductsUserPanelRoleRow
          roleName={characterDisplayName || t('header.characterName')}
          serverText={serverDisplayLabel || t('header.selectGameServer')}
          switchServerLabel={t('header.switchServer')}
          onSwitchServer={onSwitchServer}
        />
        </div>
      </div>
    </aside>
  );
};
