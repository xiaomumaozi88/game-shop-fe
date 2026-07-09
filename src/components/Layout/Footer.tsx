import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { Locale, selectableLocales } from '@/i18n';
import { useLocation, useParams } from 'react-router-dom';
import { parseURLParams, storage, STORAGE_KEYS, isGameStoreProductsPath, isGameStoreEntryVisible } from '@/utils';
import { SupportModal } from '../SupportModal';
import { ChevronDownIcon } from '../Icons/ChevronDownIcon';
import { ChevronUpIcon } from '../Icons/ChevronUpIcon';
import { ChevronRightIcon } from '../Icons/ChevronRightIcon';
import languageIcon from '@/assets/img2/touka_home_ic_Language.png';
import mailIcon from '@/assets/img2/touka_home_ic_mail.png';
import appIcon from '@/assets/img2/touka_home_ic_app.png';
import googleIcon from '@/assets/img2/touka_home_ic_google.png';
import BAM_ICON from '@/assets/img2/bam_icon.png';
import OOPSIE_ICON from '@/assets/img2/oopsie_icon.png';
import styles from './Footer.module.less';

// 游戏数据配置（与 Home 页面保持一致）
interface GameDownloadInfo {
  id: string;
  appKey: string;
  icon: string;
  downloadLinks: {
    ios: string;
    android: string;
  };
}

const gamesDownloadInfo: GameDownloadInfo[] = [
  {
    id: 'bam-bam-squad',
    appKey: 'f6594168ce3a9cc57ab7ed74426e25e1',
    icon: BAM_ICON,
    downloadLinks: {
      ios: 'https://apps.apple.com/app/id6751526939',
      android: 'https://play.google.com/store/apps/details?id=com.bam.bam.squad.pigeon.wall.wow.clash.battle.game',
    },
  },
  {
    id: 'oopsie-croco',
    appKey: '45a56d38bbdd60353438aa25d1ccff20',
    icon: OOPSIE_ICON,
    downloadLinks: {
      ios: 'https://apps.apple.com/app/id6746253182',
      android: 'https://play.google.com/store/apps/details?id=com.oopsie.croco.challenge.leisure.battle.game',
    },
  },
].filter((game) => isGameStoreEntryVisible(game.id));

// 各语言的本地名称
const LANGUAGE_NAMES: Record<Locale, string> = {
  'zh-CN': '中文(简体)', // 
  'zh-TW': '中文(繁體)',
  'en-US': 'English',
  'ja-JP': '日本語',
  'ko-KR': '한국어',
  'ru-RU': 'Русский',
  'vi-VN': 'Tiếng Việt',
  'de-DE': 'Deutsch',
  'pt-PT': 'Português',
  'es-ES': 'Español',
  'fr-FR': 'Français',
};

export const Footer: React.FC = () => {
  const { locale, t, setLanguage } = useLanguage();
  const location = useLocation();
  const { gameId } = useParams<{ gameId?: string }>();
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const languageDropdownRef = useRef<HTMLDivElement>(null);

  const languageOptions = selectableLocales.map((code) => ({
    code,
    label: LANGUAGE_NAMES[code] || code,
  }));

  const getLanguageLabel = (loc: Locale): string => {
    return LANGUAGE_NAMES[loc] || loc;
  };

  // 判断是否在商品页面（订单页 /game/:id/history 不算）
  const isProductsPage = useMemo(() => {
    return isGameStoreProductsPath(location.pathname);
  }, [location.pathname]);

  // 根据 gameId 或 appKey 获取本地化的游戏名称
  const getLocalizedGameName = (id: string | undefined, appKey?: string): string => {
    // 优先使用 gameId
    if (id) {
      if (id === 'bam-bam-squad') {
        return t('games.bamBamSquad');
      } else if (id === 'oopsie-croco' || id === 'oopsie') {
        return t('games.oopsieCroco');
      }
    }
    
    // 如果没有 gameId，使用 appKey 判断
    if (appKey) {
      if (appKey === 'f6594168ce3a9cc57ab7ed74426e25e1') {
        return t('games.bamBamSquad');
      } else if (appKey === '45a56d38bbdd60353438aa25d1ccff20') {
        return t('games.oopsieCroco');
      }
    }
    
    return '';
  };

  // 获取当前游戏信息（名称、图标和下载链接）
  const currentGameInfo = useMemo(() => {
    if (!isProductsPage) return { name: '', icon: '', downloadLinks: null };
    
    let finalGameId = gameId;
    
    // Footer 不在 Route element 内，useParams 可能取不到；支付回跳还可能带尾斜杠。
    if (!finalGameId && location.pathname.startsWith('/game/')) {
      finalGameId = location.pathname.replace(/\/+$/, '').split('/').pop();
    }
    
    // 如果没有 gameId，尝试从 localStorage 获取 appKey
    if (!finalGameId && location.pathname === '/products') {
      const currentAppKey = storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
      const gameInfo = gamesDownloadInfo.find(g => g.appKey === currentAppKey);
      if (gameInfo) {
        finalGameId = gameInfo.id;
      }
    }
    
    if (!finalGameId) return { name: '', icon: '', downloadLinks: null };
    
    // 从配置中查找游戏信息
    const gameInfo = gamesDownloadInfo.find(g => g.id === finalGameId);
    if (!gameInfo) return { name: '', icon: '', downloadLinks: null };
    
    // 获取游戏名称
    const gameName = getLocalizedGameName(finalGameId);
    
    return { 
      name: gameName, 
      icon: gameInfo.icon,
      downloadLinks: gameInfo.downloadLinks,
    };
  }, [isProductsPage, gameId, location.pathname, locale]);

  // 点击外部区域关闭语言选择下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false);
      }
    };

    if (showLanguageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLanguageDropdown]);

  // 判断是否显示下载按钮
  const showDownloadSection = isProductsPage && currentGameInfo.name;

  return (
    <footer className={`${styles.footer} ${showDownloadSection ? styles.footerWithDownload : ''}`}>
      <div className={styles.container}>
        <div className={styles.topSection}>
          <div ref={languageDropdownRef} style={{ position: 'relative' }}>
          <button
            className={styles.languageButton}
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
          >
            <img src={languageIcon} alt="Language" className={styles.buttonIcon} />
            <span>{getLanguageLabel(locale)}</span>
              {showLanguageDropdown ? (
                <ChevronUpIcon
                  className={styles.chevronIcon}
                  color="#ffffff"
                />
              ) : (
                <ChevronDownIcon
                  className={styles.chevronIcon}
                  color="#ffffff"
                />
              )}
            </button>
            {showLanguageDropdown && (
              <div className={styles.languageDropdown}>
                {languageOptions.map((item) => (
                  <button
                    key={item.code}
                    className={styles.languageOption}
                    onClick={() => {
                      setLanguage(item.code);
                      setShowLanguageDropdown(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button 
            className={styles.supportButton}
            onClick={() => setSupportModalOpen(true)}
          >
            <img src={mailIcon} alt="Support" className={styles.buttonIcon} />
            <span>{t('footer.userSupport')}</span>
            <ChevronRightIcon
              className={styles.chevronIcon}
              color="#ffffff"
            />
          </button>
        </div>

        {/* 下载按钮区域 - 仅在商品页面显示 */}
        {isProductsPage && currentGameInfo.name && (
          <div className={styles.downloadSection}>
            <div className={styles.downloadTitle}>
              {currentGameInfo.icon && (
                <img src={currentGameInfo.icon} alt={currentGameInfo.name} className={styles.downloadGameIcon} />
              )}
              <div className={styles.downloadTitleText}>
                <span className={styles.downloadGameName}>{currentGameInfo.name}</span>
                <span className={styles.downloadPrompt}>{t('footer.downloadNow')}</span>
              </div>
            </div>
            <div className={styles.downloadButtons}>
              {currentGameInfo.downloadLinks && (
                <>
                  <a
                    href={currentGameInfo.downloadLinks.ios}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.downloadButton}
                  >
                    <img src={appIcon} alt="App Store" className={styles.downloadIcon} />
                    <span>App Store</span>
                  </a>
                  <a
                    href={currentGameInfo.downloadLinks.android}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.downloadButton}
                  >
                    <img src={googleIcon} alt="Google Play" className={styles.downloadIcon} />
                    <span>Google Play</span>
                  </a>
                </>
              )}
            </div>
          </div>
        )}

        <div className={styles.bottomSection}>
          <a href="/TermsOfService.html" className={styles.link}>
            {t('footer.termsOfService')}
          </a>
          <a href="/PrivacyPolicy.html" className={styles.link}>
            {t('footer.privacyPolicy')}
          </a>
          <a href="/RefundPolicy.html" className={styles.link}>
            {t('footer.refundPolicy')}
          </a>
        </div>
      </div>

      {/* 联系客服弹窗 */}
      <SupportModal 
        isOpen={supportModalOpen} 
        onClose={() => setSupportModalOpen(false)} 
      />
    </footer>
  );
};
