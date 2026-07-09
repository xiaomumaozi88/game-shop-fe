import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { useUser } from '@/hooks/useUser';
import { useGameRole } from '@/hooks/useGameRole';
import { useLanguage } from '@/hooks/useLanguage';
import { shouldShowMobileHomeNav } from '@/i18n';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { useFitText, useFitTextGroup } from '@/hooks/useFitText';
import { useResponsive } from '@/hooks/useResponsive';
import { useProductsUserPanelVisibility } from '@/hooks/useProductsUserPanelVisibility';
import { storage, STORAGE_KEYS, resolveOrdersListPath, isGameStoreProductsPath, getDefaultAvatarByAppKey } from '@/utils';
import { logoutUser } from '@/utils/auth';
import { messageStore } from '@/store/messageStore';
import { userDetailApi, gameRoleApi } from '@/utils/api';
import { gameRoleStore } from '@/store/gameRoleStore';
import { productsUserPanelStore } from '@/store/productsUserPanelStore';
import { thinkingData } from '@/utils/thinkingData';
import { trackStoreSdkLoginOnce, trackStoreRoleSelect } from '@/utils/analytics';

import { MenuIcon } from '../Icons/MenuIcon';
import { CloseIcon } from '../Icons/CloseIcon';
import { DocumentIcon } from '../Icons/DocumentIcon';
import { EyeIcon } from '../Icons/EyeIcon';
import { MessageIcon } from '../Icons/MessageIcon';
import { SwitchIcon } from '../Icons/SwitchIcon';
import { ChevronDownIcon } from '../Icons/ChevronDownIcon';
import { SupportModal } from '../SupportModal';
import { LogoutModal } from '../LogoutModal';
import { ServerSelectModal } from '../ServerSelectModal';
import { LoginModal } from '../LoginModal';
import exitIcon from '@/assets/img2/touka_home_ic_exit.png';
import logoIconImg from '@/assets/img2/login_modal_logo.png';
import logoTextImg from '@/assets/img2/login_modal_logotext.png';
import styles from './Header.module.less';

const HEADER_LOGO_SUBTITLE_MIN_FONT_SIZE: Record<'mobile' | 'tablet' | 'desktop', number> = {
  mobile: 7,
  tablet: 9,
  desktop: 14,
};

const HEADER_MOBILE_NAV_MIN_FONT_SIZE: Record<'mobile' | 'tablet' | 'desktop', number> = {
  mobile: 7,
  tablet: 9,
  desktop: 10,
};

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, saveGameRoleSelection, getGameRoleSelection } = useUser();
  const { getAllRoles, getRolesByAppKey, roles } = useGameRole(); // 获取所有角色列表和按游戏获取角色
  
  // 从 localStorage 读取当前游戏的 appKey，使用 state 确保响应式更新
  const [currentAppKey, setCurrentAppKey] = useState<string | undefined>(
    storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined) || undefined
  );
  const fallbackAvatarUrl = useMemo(
    () => getDefaultAvatarByAppKey(currentAppKey),
    [currentAppKey]
  );
  // 监听 localStorage 中 CURRENT_GAME_APP_KEY 的变化，并在页面加载时初始化数数SDK
  useEffect(() => {
    const handleStorageChange = () => {
      const newAppKey = storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined) || undefined;
      setCurrentAppKey(newAppKey);
      
      // 如果页面刷新后，尝试从保存的配置中初始化数数SDK
      if (newAppKey && user && user.token) {
        const selection = getGameRoleSelection(newAppKey);
        if (selection?.ss_app_id && selection?.ss_url && !thinkingData.isInitialized()) {
          const initSuccess = thinkingData.initForGame(newAppKey, {
            appId: selection.ss_app_id,
            serverUrl: selection.ss_url,
          });
          
          if (initSuccess) {
            thinkingData.setCurrentGame(newAppKey);
            if (user.sdkId) {
              thinkingData.login(user.sdkId);
              // 设置用户属性
              thinkingData.userSet({
                username: user.username || user.gameAccount || '',
                gameAccount: user.gameAccount || '',
                nickName: user.username || '',
                gameUserId: user.characterName || '',
                gameServerChannel: user.gameServer || '',
                platform: user.platform || '',
              });
            }
          }
        }
      }
    };

    // 初始检查
    handleStorageChange();

    // 监听 storage 事件（当其他标签页或窗口修改 localStorage 时）
    window.addEventListener('storage', handleStorageChange);

    // 定期检查 localStorage（因为同窗口内的修改不会触发 storage 事件）
    const interval = setInterval(handleStorageChange, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [user, getGameRoleSelection]);

  // 获取所有游戏的 app_key
  const getAllAppKeys = (): string[] => {
    return [
      'f6594168ce3a9cc57ab7ed74426e25e1', // Bam! Bam Squad
      '45a56d38bbdd60353438aa25d1ccff20', // Oopsie Croco
    ];
  };

  // 加载游戏区服角色列表（确保角色列表在需要时已加载）
  const roleLoadingRef = useRef(false); // 防止重复请求
  const lastRoleTokenRef = useRef<string | undefined>(undefined); // 记录上次的 token

  useEffect(() => {
    const loadGameRoles = async () => {
      const currentToken = user?.token;

      // 如果 token 没有变化，不重复请求
      if (currentToken === lastRoleTokenRef.current) {
        return;
      }

      // 更新记录的 token
      lastRoleTokenRef.current = currentToken;

      if (!currentToken) {
        // 未登录，清空角色列表
        gameRoleStore.clear();
        roleLoadingRef.current = false;
        return;
      }

      // 如果正在加载中，直接返回
      if (roleLoadingRef.current) {
        return;
      }

      // 如果已有数据且 token 相同，不再重复请求
      const currentRoles = gameRoleStore.getRoles();
      if (currentRoles.length > 0) {
        roleLoadingRef.current = false;
        return;
      }

      // 如果没有角色数据，调用接口获取
      roleLoadingRef.current = true;
      gameRoleStore.setLoading(true);

      try {
        const appKeys = getAllAppKeys();
        const res = await gameRoleApi.getGameServerRoleList(appKeys);

        if (res.success && res.data) {
          gameRoleStore.setRoles(res.data);
        } else {
          gameRoleStore.setError(res.error || '获取游戏角色列表失败');
        }
      } catch (error) {
        console.error('Header: 获取游戏角色列表失败:', error);
        gameRoleStore.setError(error instanceof Error ? error.message : '获取游戏角色列表失败');
      } finally {
        roleLoadingRef.current = false;
        gameRoleStore.setLoading(false);
      }
    };

    loadGameRoles();
  }, [user?.token]);

  // 平台展示文案
  const getPlatformLabel = (platform: string | undefined): string => {
    if (!platform) return '';
    const lower = platform.toLowerCase();
    if (lower === 'ios') return 'iOS';
    return platform;
  };

  const formatServerDisplay = (channel: string | undefined, platform: string | undefined): string => {
    if (!channel) return '';
    const platformLabel = getPlatformLabel(platform);
    return platformLabel ? `${channel}-${platformLabel}` : channel;
  };

  // 根据 game_user_id 获取"昵称-平台"展示（只查找当前游戏的角色）
  // 使用 useMemo 确保角色列表变化时重新计算
  const characterDisplayName = useMemo(() => {
    if (!user?.characterName || !currentAppKey) return '';
    // 只查找当前游戏的角色
    const currentGameRoles = getRolesByAppKey(currentAppKey);
    const role = currentGameRoles.find((r) => r.game_user_id === user.characterName);
    if (!role) return '';
    const platformLabel = getPlatformLabel(role.platform);
    return platformLabel ? `${role.nick_name}-${platformLabel}` : role.nick_name;
  }, [user?.characterName, currentAppKey, roles]);

  // 根据 game_server_channel 和 game_user_id 构建区服显示格式（channel + platform）（只查找当前游戏的角色）
  // 使用 useMemo 确保角色列表变化时重新计算
  const serverDisplayLabel = useMemo(() => {
    if (!currentAppKey) return '';
    
    // 只查找当前游戏的角色
    const currentGameRoles = getRolesByAppKey(currentAppKey);
    if (currentGameRoles.length === 0) {
      // 如果角色列表还未加载，使用用户信息兜底拼接展示
      return formatServerDisplay(user?.gameServer, user?.platform);
    }
    
    let role;
    
    // 优先通过 game_user_id 查找角色（最准确的方式）
    if (user?.characterName) {
      role = currentGameRoles.find((r) => r.game_user_id === user.characterName);
    }
    
    // 如果通过 game_user_id 找到了角色，直接使用它的 game_server_channel
    if (role) {
      return formatServerDisplay(role.game_server_channel, role.platform);
    }
    
    // 如果没有 game_user_id 或找不到匹配的角色，尝试通过 user.gameServer 查找
    // user.gameServer 可能是 game_server_channel（新格式）或服务器ID（旧格式）
    if (user?.gameServer) {
      // 首先尝试作为 game_server_channel 查找
      role = currentGameRoles.find((r) => r.game_server_channel === user.gameServer);
      
      // 如果没找到，可能 user.gameServer 是旧的服务器ID格式，尝试通过其他方式查找
      // 由于我们无法直接通过服务器ID查找，如果上面都没找到，返回原始值
      if (role) {
        return formatServerDisplay(role.game_server_channel, role.platform);
      }
    }
    
    // 如果都没找到，使用用户信息兜底拼接展示
    return formatServerDisplay(user?.gameServer, user?.platform);
  }, [user?.gameServer, user?.characterName, currentAppKey, roles]);

  const { t, locale } = useLanguage();
  const { breakpoint, isTouchLandscape } = useResponsive();
  const productsUserPanelVisible = useProductsUserPanelVisibility();

  const showMobileHomeNav = shouldShowMobileHomeNav(locale);
  const logoSubtitleText = t('header.title');
  const gameListNavText = t('menu.gameList');
  const ordersNavText = t('menu.myOrders');
  const logoSubtitleRef = useRef<HTMLSpanElement>(null);
  const gameListNavTextRef = useRef<HTMLSpanElement>(null);
  const ordersNavTextRef = useRef<HTMLSpanElement>(null);
  const mobileNavTextRefs = useMemo(() => [gameListNavTextRef, ordersNavTextRef], []);

  useFitText(logoSubtitleRef, logoSubtitleText, {
    minFontSize: HEADER_LOGO_SUBTITLE_MIN_FONT_SIZE[breakpoint],
    step: 0.25,
    allowWrapAtMin: true,
    wrapClassName: styles.logoSubtitleWrapped,
  });

  useFitTextGroup(mobileNavTextRefs, [gameListNavText, ordersNavText], {
    minFontSize: HEADER_MOBILE_NAV_MIN_FONT_SIZE[breakpoint],
  });
  
  // 根据 appKey 获取游戏名称（使用本地化）
  const getGameNameByAppKey = (appKey: string | undefined): string => {
    if (!appKey) return '';
    
    // BamBamSquad
    if (appKey === 'f6594168ce3a9cc57ab7ed74426e25e1') {
      return t('games.bamBamSquad');
    }
    // Oopsie Croco
    if (appKey === '45a56d38bbdd60353438aa25d1ccff20') {
      return t('games.oopsieCroco');
    }
    
    return '';
  };

  const currentGameName = getGameNameByAppKey(currentAppKey);
  
  const { requireLogin, showLoginModal: showLoginModalFromGuard, setShowLoginModal: setShowLoginModalFromGuard } = useLoginGuard();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [serverSelectModalOpen, setServerSelectModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownTriggerRef = useRef<HTMLButtonElement>(null);
  const [useMobileDropdownPortal, setUseMobileDropdownPortal] = useState(false);
  const [portalMenuStyle, setPortalMenuStyle] = useState<React.CSSProperties | null>(null);

  // 判断是否在商品页面（订单页 /game/:id/history 等不算商品页）
  const isProductsPage = isGameStoreProductsPath(location.pathname);
  const isHistoryPage = location.pathname.includes('/history');
  // 判断是否为home页面
  const isHomePage = location.pathname === '/';
  const isMobileInlineNavPage = isHomePage || isProductsPage || isHistoryPage;
  const isMobileHomeNoInlineNav = isMobileInlineNavPage && !showMobileHomeNav;
  const isHomeGuestMobile = isHomePage && !user;
  const isHomeAuthedMobile = isHomePage && !!user;
  const isHistoryAuthedMobile = isHistoryPage && !!user;
  const useInlineNavProductsSizing = showMobileHomeNav && isMobileInlineNavPage;
  const useProductsMobileUserDropdown =
    isProductsPage ||
    (showMobileHomeNav && (isHomeAuthedMobile || isHistoryAuthedMobile));
  const shouldUseProductsCompactPanelToggle =
    isProductsPage && (breakpoint === 'mobile' || breakpoint === 'tablet' || isTouchLandscape);
  const isHomeMobileDark = isHomePage || isHistoryPage;
  const normalizedPathname = (location.pathname.replace(/\/+$/, '') || '/');
  const isGameListNavActive = normalizedPathname === '/';
  const isOrdersNavActive =
    normalizedPathname === '/history' || /^\/game\/[^/]+\/history$/.test(normalizedPathname);
  const hasActiveMobileHomeNavItem = isGameListNavActive || isOrdersNavActive;
  const shouldHideMenuButton = isHomePage || ((isProductsPage || isHistoryPage) && !!user);

  const handleLoginClick = () => {
    // TODO: 实现登录逻辑
    if (!user) {
      // 打开登录弹窗
      setLoginModalOpen(true);
    }
  };

  const handleExitClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (user) {
      if (logoutLoading) return;
      // 检查是否需要显示提醒
      const dontRemind = localStorage.getItem('logout_dont_remind') === 'true';
      if (dontRemind) {
        void handleLogout();
      } else {
        setLogoutModalOpen(true);
      }
    }
  };

  const handleLogout = async (): Promise<boolean> => {
    if (logoutLoading) return false;

    setLogoutLoading(true);
    try {
      const result = await logoutUser();
      if (!result.success) {
        messageStore.show(result.error || t('logout.failed'));
        return false;
      }

      setMobileMenuOpen(false);
      setUserDropdownOpen(false);
      navigate('/', { replace: true });
      return true;
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleUserDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (shouldUseProductsCompactPanelToggle) {
      productsUserPanelStore.toggle();
      setUserDropdownOpen(false);
      return;
    }
    setUserDropdownOpen(!userDropdownOpen);
  };

  const handleLogoutClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUserDropdownOpen(false);
    if (logoutLoading) return;
    // 检查是否需要显示提醒
    const dontRemind = localStorage.getItem('logout_dont_remind') === 'true';
    if (dontRemind) {
      void handleLogout();
    } else {
      setLogoutModalOpen(true);
    }
  };

  // 手机端顶栏 overflow:hidden 会裁切菜单；挂到 body 避免被 banner 区域挡住
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const syncPortal = () => setUseMobileDropdownPortal(mq.matches && isMobileInlineNavPage);
    syncPortal();
    mq.addEventListener('change', syncPortal);
    return () => mq.removeEventListener('change', syncPortal);
  }, [isMobileInlineNavPage]);

  useEffect(() => {
    if (shouldUseProductsCompactPanelToggle && userDropdownOpen) {
      setUserDropdownOpen(false);
    }
  }, [shouldUseProductsCompactPanelToggle, userDropdownOpen]);

  useLayoutEffect(() => {
    if (!userDropdownOpen || !useMobileDropdownPortal || !userDropdownTriggerRef.current) {
      setPortalMenuStyle(null);
      return;
    }
    let frameId: number | null = null;

    const updateMenuPosition = () => {
      const trigger = userDropdownTriggerRef.current!;
      const rect = trigger.getBoundingClientRect();
      const width = Math.round(rect.width);
      setPortalMenuStyle({
        position: 'fixed',
        top: rect.bottom,
        left: rect.left,
        width,
        minWidth: width,
        maxWidth: width,
        boxSizing: 'border-box',
        zIndex: 2000,
      });
    };

    const scheduleMenuPositionUpdate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updateMenuPosition();
      });
    };

    updateMenuPosition();
    const resizeObserver = new ResizeObserver(scheduleMenuPositionUpdate);
    resizeObserver.observe(userDropdownTriggerRef.current);
    window.addEventListener('resize', scheduleMenuPositionUpdate);
    window.addEventListener('scroll', scheduleMenuPositionUpdate, true);
    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleMenuPositionUpdate);
      window.removeEventListener('scroll', scheduleMenuPositionUpdate, true);
    };
  }, [userDropdownOpen, useMobileDropdownPortal]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = () => {
      if (userDropdownOpen) {
        setUserDropdownOpen(false);
      }
    };
    if (userDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [userDropdownOpen]);

  const renderUserDropdownMenu = () => (
    <>
      <div className={styles.userDropdownDivider} />
      <button type="button" className={styles.userDropdownItem} onClick={handleLogoutClick}>
        {t('header.logout')}
      </button>
    </>
  );

  const renderUserDropdownMenuLayer = () => {
    if (!userDropdownOpen) return null;

    const isPortaledMenu = useMobileDropdownPortal;
    const menuClassName = [
      styles.userDropdownMenu,
      isPortaledMenu ? styles.userDropdownMenuPortal : styles.userDropdownMenuDocked,
    ].join(' ');

    const menuNode = (
      <div
        className={menuClassName}
        style={
          isPortaledMenu
            ? {
                ...portalMenuStyle,
                visibility: portalMenuStyle ? 'visible' : 'hidden',
              }
            : undefined
        }
        onClick={(e) => e.stopPropagation()}
      >
        {renderUserDropdownMenu()}
      </div>
    );

    if (isPortaledMenu) {
      return createPortal(menuNode, document.body);
    }

    return menuNode;
  };


  return (
    <>
      <header
        className={`${styles.header} ${
          isHomeMobileDark ? styles.headerHomeMobileDark : ''
        } ${isMobileInlineNavPage && !isHomeMobileDark ? styles.headerHomeMobile : ''} ${
          isHomeGuestMobile ? styles.headerHomeGuestMobile : ''
        } ${isMobileInlineNavPage && showMobileHomeNav ? styles.headerWithMobileHomeNav : ''} ${
          isMobileHomeNoInlineNav ? styles.headerHomeMobileNoInlineNav : ''
        }`}
      >
        <div
          className={`${styles.container} ${isMobileInlineNavPage ? styles.containerHomeMobile : ''} ${
            isHomeMobileDark && !useInlineNavProductsSizing ? styles.containerHomeMobileDark : ''
          } ${isMobileHomeNoInlineNav ? styles.containerHomeMobileNoInlineNav : ''}`}
        >
          <div className={styles.logoSection}>
            <Link to="/" className={styles.logo}>
              <img src={logoIconImg} alt="" className={styles.logoIcon} aria-hidden />
              <span className={styles.logoTextGroup}>
                <img src={logoTextImg} alt="TOUKA" className={styles.logoTextImg} />
                {isMobileInlineNavPage && (
                  <span className={styles.logoSubtitleWrap}>
                    <span ref={logoSubtitleRef} className={styles.logoSubtitle}>
                      {logoSubtitleText}
                    </span>
                  </span>
                )}
              </span>
            </Link>
          </div>

          {isMobileInlineNavPage && showMobileHomeNav && (
            <nav
              className={`${styles.mobileHomeNav} ${
                hasActiveMobileHomeNavItem ? '' : styles.mobileHomeNavNoActive
              }`}
              aria-label={t('menu.gameList')}
            >
              <Link
                to="/"
                className={`${styles.mobileHomeNavItem} ${
                  isGameListNavActive ? styles.mobileHomeNavItemActive : ''
                }`}
              >
                <span ref={gameListNavTextRef} className={styles.mobileHomeNavItemText}>
                  {gameListNavText}
                </span>
              </Link>
              <span className={styles.mobileHomeNavDivider} aria-hidden />
              <button
                type="button"
                className={`${styles.mobileHomeNavItem} ${
                  isOrdersNavActive ? styles.mobileHomeNavItemActive : ''
                }`}
                onClick={() => {
                  requireLogin(() => {
                    navigate(resolveOrdersListPath(location.pathname));
                  });
                }}
              >
                <span ref={ordersNavTextRef} className={styles.mobileHomeNavItemText}>
                  {ordersNavText}
                </span>
              </button>
            </nav>
          )}

          {/* PC端导航 */}
          <nav className={styles.desktopNav}>
            <Link
              to="/"
              className={`${styles.desktopNavItem} ${styles.desktopNavItemPlatform}`}
            >
              {t('header.title')}
            </Link>
            <Link
              to="/"
              className={`${styles.desktopNavItem} ${styles.desktopNavItemTab} ${location.pathname === '/' || isGameStoreProductsPath(location.pathname) ? styles.desktopNavItemActive : ''}`}
            >
              {t('menu.gameList')}
            </Link>
            <span className={styles.desktopNavDivider} aria-hidden />
            <button
              className={`${styles.desktopNavItem} ${styles.desktopNavItemTab} ${location.pathname.includes('/history') ? styles.desktopNavItemActive : ''}`}
              onClick={() => {
                requireLogin(() => {
                  navigate(resolveOrdersListPath(location.pathname));
                });
              }}
            >
              {t('menu.myOrders')}
            </button>
          </nav>

          <div className={styles.actions}>
            {/* PC端登录按钮或用户下拉菜单 */}
            {!user ? (
              <button
                className={`${styles.loginButton} ${isHomeGuestMobile ? styles.loginButtonMobileHome : ''}`}
                onClick={handleLoginClick}
              >
                {t('login.submit')}
              </button>
            ) : (
              <div
                className={`${styles.userDropdown} ${
                  useProductsMobileUserDropdown ? styles.userDropdownProductsMobile : ''
                } ${
                  (isHomeAuthedMobile || isHistoryAuthedMobile) && !useProductsMobileUserDropdown
                    ? styles.userDropdownHomeMobile
                    : ''
                } ${userDropdownOpen ? styles.userDropdownOpen : ''}`}
              >
                <button
                  ref={userDropdownTriggerRef}
                  type="button"
                  className={styles.userDropdownTrigger}
                  onClick={handleUserDropdownToggle}
                >
                  <span className={styles.userEmail}>
                    {user.email || user.gameAccount || user.username}
                  </span>
                  <ChevronDownIcon
                    className={`${styles.chevronIcon} ${
                      (shouldUseProductsCompactPanelToggle ? productsUserPanelVisible : userDropdownOpen)
                        ? styles.chevronIconOpen
                        : ''
                    }`}
                    color="#9c8466"
                  />
                </button>
                {renderUserDropdownMenuLayer()}
              </div>
            )}
            <button
              className={`${styles.menuButton} ${
                shouldHideMenuButton ? styles.menuButtonHomeHidden : ''
              }`}
              onClick={() => {
                if (mobileMenuOpen) {
                  // 关闭菜单时不需要登录检查
                  setMobileMenuOpen(false);
                } else {
                  // 打开菜单时需要登录检查
                  requireLogin(() => {
                    setMobileMenuOpen(true);
                  });
                }
              }}
              aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
            >
              {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </header>

      {/* 登录状态横条 - 紧跟Header下方 */}
      <div
        className={`${styles.loginBar} ${!isProductsPage ? styles.loginBarHiddenOnDesktop : ''} ${
          isProductsPage ? styles.loginBarProductsMobileOnly : ''
        } ${isHomePage || isHistoryPage ? styles.loginBarHomeMobileHidden : ''} ${
          isProductsPage ? styles.loginBarProductsMobileHidden : ''
        }`}
      >
        {user ? (
          <div className={styles.loginContent}>
            <div className={styles.userInfo} onClick={handleLoginClick}>
              {isProductsPage && (
                <div className={styles.avatar}>
                    <img 
                    src={user.avatar || fallbackAvatarUrl}
                      alt="avatar" 
                      className={styles.avatarImage}
                      onError={(e) => {
                      // 如果头像加载失败，使用当前游戏默认头像
                      e.currentTarget.src = fallbackAvatarUrl;
                      }}
                    />
                </div>
              )}
              <div className={styles.userText}>
                {currentGameName && (
                  <div className={styles.gameNameRow}>
                    {currentGameName}
                  </div>
                )}
                <div className={styles.loginRow}>
                  <span className={styles.loginText}>
                    {t('header.greeting')}, {user.email || user.gameAccount || user.username}
                  </span>
                  <img
                    src={exitIcon}
                    alt="exit"
                    className={styles.arrowIcon}
                    onClick={handleExitClick}
                  />
                </div>
                {isProductsPage && (
                  <div className={styles.characterInfo}>
                    {user.gameServer ? (
                      <>
                        <span
                          className={styles.characterNameLink}
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: 实现选择角色名称功能
                          }}
                        >
                          {characterDisplayName || t('header.characterName')}
                        </span>
                        <span className={styles.gameServerText}>
                          {serverDisplayLabel || t('header.selectGameServer')}
                        </span>
                      </>
                    ) : (
                      <span className={styles.gameServerText}>
                        {t('header.selectGameServer')}
                      </span>
                    )}
                    <button
                      className={styles.switchServerButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        requireLogin(() => {
                          setServerSelectModalOpen(true);
                        });
                      }}
                      aria-label={t('header.switchServer')}
                    >
                      <SwitchIcon size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.loginContent} onClick={handleLoginClick}>
            <span className={styles.greetingText}>{t('header.greeting')}, </span>
            <span className={styles.loginPromptText}>{t('header.loginPrompt')}</span>
          </div>
        )}
      </div>

      <nav className={`${styles.nav} ${mobileMenuOpen ? styles.navOpen : ''}`}>
        <button
          className={styles.navItem}
          onClick={() => {
            setMobileMenuOpen(false);
            requireLogin(() => {
              navigate(resolveOrdersListPath(location.pathname));
            });
          }}
        >
          <span className={styles.navIcon}>
            <DocumentIcon />
          </span>
          <span className={styles.navText}>{t('menu.myOrders')}</span>
        </button>
        <Link
          to="/"
          className={styles.navItem}
          onClick={() => setMobileMenuOpen(false)}
        >
          <span className={styles.navIcon}>
            <EyeIcon />
          </span>
          <span className={styles.navText}>{t('menu.gameList')}</span>
        </Link>
        <button
          className={styles.navItem}
          onClick={() => {
            setMobileMenuOpen(false);
            requireLogin(() => {
              setSupportModalOpen(true);
            });
          }}
        >
          <span className={styles.navIcon}>
            <MessageIcon />
          </span>
          <span className={styles.navText}>{t('menu.contactSupport')}</span>
        </button>
      </nav>

      <SupportModal isOpen={supportModalOpen} onClose={() => setSupportModalOpen(false)} />
      <LogoutModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />
      <ServerSelectModal
        isOpen={serverSelectModalOpen}
        onClose={() => setServerSelectModalOpen(false)}
        onConfirm={async (serverName, characterName, gameUserId, userAvatar) => {
          console.log('🔵 Header ServerSelectModal onConfirm 被调用', { serverName, characterName, gameUserId, userAvatar });
          // characterName 是角色昵称，gameUserId 是 game_user_id，userAvatar 是角色数据中的头像
          const appKey = currentAppKey;
          console.log('🔵 Header 获取 appKey', appKey);
          
          if (!appKey || !gameUserId) {
            console.error('缺少 appKey 或 game_user_id', { appKey, gameUserId });
            return;
          }

          // 如果传入了头像信息，先立即更新头像（不需要等待接口返回）
          if (userAvatar && user) {
            setUser({
              ...user,
              gameServer: serverName,
              characterName: gameUserId, // 存储 game_user_id
              avatar: userAvatar, // 立即使用角色数据中的头像
            });
          }

          try {
            // 调用用户详情接口（可能会更新更多信息，包括头像）
            const res = await userDetailApi.getUserDetail(appKey, gameUserId);
            
            if (!res.success || !res.data) {
              console.error('获取用户详情失败:', res.error);
              // 即使失败，也更新基本的区服信息（头像已经在上面设置了）
              if (user) {
                setUser({
                  ...user,
                  gameServer: serverName,
                  characterName: gameUserId, // 存储 game_user_id
                  avatar: userAvatar || user.avatar, // 使用传入的头像或保持原有头像
                });
                
                // 保存当前游戏的角色选择信息（失败时没有数数配置，只保存角色信息）
                if (appKey) {
                  saveGameRoleSelection(appKey);
                }
              }
              return;
            }

            const userDetail = res.data;
            console.log('🔵 Header 获取用户详情', userDetail);
            
            // 更新用户信息（接口返回的数据会覆盖之前设置的头像，如果接口返回了更新的头像）
            if (user) {
              setUser({
                ...user,
                gameServer: userDetail.game_server_channel, // 使用接口返回的区服ID
                characterName: gameUserId, // 使用传入的 game_user_id
                avatar: userDetail.user_avatar || userAvatar || user.avatar, // 优先使用接口返回的头像，否则使用传入的头像，最后使用原有头像
                sdkId: userDetail.sdk_id, // 存储 sdk_id（用于数数上报的account_id）
                country: userDetail.country, // 存储国家代码（用于数数上报的#country_code）
                ip: userDetail.ip, // 存储IP地址（用于数数上报的#ip）
                platform: userDetail.platform, // 存储平台（用于数数上报的#os）
              });
            }
         

            // 使用返回的数数配置初始化数数SDK
            // 使用 appKey 作为游戏标识
            console.log('🔵 Header 准备初始化数数SDK', { ss_app_id: userDetail.ss_app_id, ss_url: userDetail.ss_url, appKey });
            if (userDetail.ss_app_id && userDetail.ss_url && appKey) {
              const initSuccess = thinkingData.initForGame(appKey, {
                appId: userDetail.ss_app_id,
                serverUrl: userDetail.ss_url,
              });
              console.log('🔵 Header 数数SDK初始化结果', initSuccess);

              if (initSuccess) {
                // 设置当前游戏（使用 appKey）
                thinkingData.setCurrentGame(appKey);
                
                // 设置账号ID（使用 sdk_id）
                if (userDetail.sdk_id) {
                  thinkingData.login(userDetail.sdk_id);
                  
                  // 设置用户属性
                  thinkingData.userSet({
                    username: user?.username || user?.gameAccount || '',
                    gameAccount: user?.gameAccount || '',
                    nickName: userDetail.nick_name,
                    gameUserId: userDetail.game_user_id,
                    gameServerChannel: userDetail.game_server_channel,
                    platform: userDetail.platform,
                  });
                }

                // 上报登录事件：按 appKey+token 维度仅上报一次
                console.log('🔵 Header 准备上报登录事件', { appKey, sdk_id: userDetail.sdk_id, token: user?.token });
                trackStoreSdkLoginOnce(appKey, userDetail.sdk_id, user?.token);

                // 上报角色选择事件（确保数数配置已初始化后）
                const serverChannelNum = parseInt(userDetail.game_server_channel) || 0;
                console.log('🔵 Header 准备上报角色选择事件', { serverChannelNum, game_user_id: userDetail.game_user_id });
                trackStoreRoleSelect(serverChannelNum, userDetail.game_user_id);
                
                // 保存当前游戏的角色选择信息和数数配置
                if (appKey) {
                  saveGameRoleSelection(appKey, {
                    ss_app_id: userDetail.ss_app_id,
                    ss_url: userDetail.ss_url,
                  });
                }
              } else {
                console.warn('🔵 Header 数数SDK初始化失败，无法上报事件');
              }
            } else {
              console.warn('🔵 Header 数数配置不完整，无法初始化SDK', { ss_app_id: userDetail.ss_app_id, ss_url: userDetail.ss_url, appKey });
            }
          } catch (error) {
            console.error('获取用户详情异常:', error);
            // 即使异常，也更新基本的区服信息
            if (user) {
              setUser({
                ...user,
                gameServer: serverName,
                characterName: gameUserId,
              });
              
              // 保存当前游戏的角色选择信息（异常时没有数数配置，只保存角色信息）
              if (appKey) {
                saveGameRoleSelection(appKey);
              }
            }
          }
        }}
        currentServer={user?.gameServer}
        currentCharacter={user?.characterName}
        appKey={currentAppKey} // 传递 appKey
      />
      <LoginModal
        isOpen={loginModalOpen || showLoginModalFromGuard}
        onClose={() => {
          setLoginModalOpen(false);
          setShowLoginModalFromGuard(false);
        }}
      />
    </>
  );
};
