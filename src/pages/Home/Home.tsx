import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { useUser } from '@/hooks/useUser';
import { LoginModal } from '@/components/LoginModal';
import { AlertModal } from '@/components/AlertModal';
import alertModalStyles from '@/components/AlertModal/AlertModal.module.less';
import { useGameRole } from '@/hooks/useGameRole';
import { useResponsive } from '@/hooks/useResponsive';
import { gameRoleStore } from '@/store/gameRoleStore';
import { messageStore } from '@/store/messageStore';
import { gameRoleApi } from '@/utils/api';
import { storage, STORAGE_KEYS, type GameStoreNoRoleLocationState, isGameStoreEntryVisible } from '@/utils';
import BAM_ICON from '@/assets/img2/bam_icon.png';
import OOPSIE_ICON from '@/assets/img2/oopsie_icon.png';
import oopsieDesktopBannerImg from '@/assets/img2/home-oopsie-desktop-banner-packs.png';
import oopsieMobileCarouselBannerImg from '@/assets/img2/pay_item_banner.png';
import bamBannerImg from '@/assets/img2/pay_item_gift_banner_Lifetime.png';
import oopsieMobileGameListBanner from '@/assets/img2/home_mobile_game_list_oopsie_croco.png';
import bamMobileGameListBanner from '@/assets/img2/home_mobile_game_list_bam_bam_squad.png';
import bannerArrowImg from '@/assets/img2/pay_home_banner_arrow.png';
import { HomeBackgroundPattern } from './components/HomeBackgroundPattern';
import { HomeMobileGameList } from './components/HomeMobileGameList';
import styles from './Home.module.less';

// 游戏数据
interface Game {
  id: string;
  name: string;
  /** ≥768px 轮播图 */
  bannerImage: string;
  /** <768px 轮播图，未设置则与 bannerImage 相同 */
  mobileCarouselBannerImage?: string;
  mobileBannerImage: string;
  app_key: string;
  icon: string;
  downloadLinks: {
    ios: string;
    android: string;
  };
}

export const games: Game[] = [
  {
    id: 'oopsie-croco',
    name: 'Oopsie Croco',
    bannerImage: oopsieDesktopBannerImg,
    mobileCarouselBannerImage: oopsieMobileCarouselBannerImg,
    mobileBannerImage: oopsieMobileGameListBanner,
    app_key: '45a56d38bbdd60353438aa25d1ccff20',
    icon: OOPSIE_ICON,
    downloadLinks: {
      ios: 'https://apps.apple.com/app/id6746253182',
      android: 'https://play.google.com/store/apps/details?id=com.oopsie.croco.challenge.leisure.battle.game',
    },
  },
  {
    id: 'bam-bam-squad',
    name: 'Bam! Bam Squad',
    bannerImage: bamBannerImg,
    mobileBannerImage: bamMobileGameListBanner,
    app_key: 'f6594168ce3a9cc57ab7ed74426e25e1',
    icon: BAM_ICON,
    downloadLinks: {
      ios: 'https://apps.apple.com/app/id6751526939',
      android: 'https://play.google.com/store/apps/details?id=com.bam.bam.squad.pigeon.wall.wow.clash.battle.game',
    },
  },
].filter((game) => isGameStoreEntryVisible(game.id));

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { requireLogin, showLoginModal, setShowLoginModal } = useLoginGuard();
  const { user, clearGameSpecificFields } = useUser();
  const { hasRolesForAppKey } = useGameRole();
  const { isMobile } = useResponsive();

  const hasMultipleGames = games.length > 1;

  const banners = useMemo(
    () =>
      games.map((game) =>
        isMobile ? (game.mobileCarouselBannerImage ?? game.bannerImage) : game.bannerImage
      ),
    [isMobile]
  );

  // 多游戏：无限循环 [克隆末张, …真实列表, 克隆首张]；单游戏：仅一张，不轮播
  const infiniteBanners = useMemo(() => {
    if (banners.length === 0) return [];
    if (!hasMultipleGames) return [banners[0]];
    return [banners[banners.length - 1], ...banners, banners[0]];
  }, [banners, hasMultipleGames]);

  const initialBannerIndex = hasMultipleGames ? 1 : 0;
  const [currentIndex, setCurrentIndex] = useState(initialBannerIndex);

  // 端别或套图切换时重置索引（仅依赖 length 无法覆盖「仍是 2 张图但 PC/移动图不同」的情况）
  useEffect(() => {
    if (banners.length > 0) {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      setCurrentIndex(initialBannerIndex);
      currentIndexRef.current = initialBannerIndex;
    }
  }, [banners, initialBannerIndex]);

  // 是否启用过渡动画
  const [enableTransition, setEnableTransition] = useState(true);
  
  // 触摸相关
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const bannerViewportRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const [bannerSlideWidth, setBannerSlideWidth] = useState(0);

  // 以视口像素位移，避免 translateX(%) 相对轨道总宽计算产生亚像素缝隙
  useEffect(() => {
    const viewport = bannerViewportRef.current;
    if (!viewport) return;
    let frameId: number | null = null;

    const measure = () => {
      const width = Math.round(viewport.getBoundingClientRect().width);
      setBannerSlideWidth((prev) => (prev === width ? prev : width));
    };

    const scheduleMeasure = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        measure();
      });
    };

    measure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(viewport);
    window.addEventListener('resize', scheduleMeasure);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      observer.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [banners]);
  
  // 自动轮播相关
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef<boolean>(false);
  const currentIndexRef = useRef<number>(1); // 用于在回调中获取最新的 currentIndex
  const infiniteBannersLengthRef = useRef<number>(0); // 用于在定时器中获取最新的 infiniteBanners 长度

  // 渲染期同步长度，避免首帧 effect 尚未跑时 ref 为 0
  infiniteBannersLengthRef.current = infiniteBanners.length;

  // 提示弹窗：存 i18n key，渲染时再 t(key)，切换语言后文案会同步更新
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessageI18nKey, setAlertMessageI18nKey] = useState<string | null>(null);
  /** 无角色提示弹窗：记录用户点击的游戏，用于刷新角色列表后判断是否进入商店 */
  const [pendingNoRoleGameId, setPendingNoRoleGameId] = useState<string | null>(null);
  const [noRoleRefreshLoading, setNoRoleRefreshLoading] = useState(false);
  const [noRoleRefreshInlineErrorI18nKey, setNoRoleRefreshInlineErrorI18nKey] = useState<string | null>(null);
  // 从订单页/商品页跳回：无角色时展示与首页点击游戏一致的提示弹窗
  useEffect(() => {
    const gameId = (location.state as GameStoreNoRoleLocationState | null)?.showNoRoleForGameId;
    if (!gameId || !user?.token) return;

    const game = games.find((g) => g.id === gameId);
    navigate('.', { replace: true, state: null });

    if (!game) return;

    storage.set(STORAGE_KEYS.CURRENT_GAME_APP_KEY, game.app_key);

    // 由商品页/订单页明确带回的无角色状态，直接展示弹窗（勿依赖可能过期的本地角色缓存）
    setPendingNoRoleGameId(gameId);
    setAlertMessageI18nKey('home.noRoleAccount');
    setNoRoleRefreshInlineErrorI18nKey(null);
    setShowAlertModal(true);
  }, [location.state, user?.token, navigate]);

  // 同步 currentIndex 到 ref
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // 索引越界时拉回（防止 transitionend 未触发等异常导致 translateX 极大、首屏空白）
  useEffect(() => {
    const n = infiniteBanners.length;
    if (n === 0) return;
    if (currentIndex < 0 || currentIndex >= n) {
      setEnableTransition(false);
      setCurrentIndex(initialBannerIndex);
      currentIndexRef.current = initialBannerIndex;
    }
  }, [currentIndex, infiniteBanners.length, initialBannerIndex]);

  // 将内部索引转换为真实索引（用于圆点 / 缩略图高亮）
  const getRealIndex = (index: number): number => {
    if (banners.length === 0) return 0;
    if (!hasMultipleGames) return 0;
    if (index === 0) return banners.length - 1;
    if (index === infiniteBanners.length - 1) return 0;
    return index - 1;
  };

  const realIndex = getRealIndex(currentIndex);

  // 处理边界跳转：当滑动到克隆图片时，无动画跳转到对应的真实图片
  useEffect(() => {
    const banner = bannerRef.current;
    if (!banner || banners.length === 0 || !hasMultipleGames) return;

    const handleTransitionEnd = (e: TransitionEvent) => {
      // 只处理 transform 的 transition 结束
      if (e.propertyName !== 'transform') return;

      const current = currentIndexRef.current;
      if (current === 0) {
        // 滑到了克隆的最后一张，跳转到真实最后一张（无动画）
        setEnableTransition(false);
        setCurrentIndex(banners.length);
      } else if (current === infiniteBanners.length - 1) {
        // 滑到了克隆的第一张，跳转到真实第一张（无动画）
        setEnableTransition(false);
        setCurrentIndex(1);
      }
    };

    // 监听 transition 结束事件
    banner.addEventListener('transitionend', handleTransitionEnd);

    return () => {
      banner.removeEventListener('transitionend', handleTransitionEnd);
    };
  }, [currentIndex, banners.length, infiniteBanners.length, hasMultipleGames]);

  // 当禁用过渡后，立即重新启用（用于下次滑动）
  useEffect(() => {
    if (!enableTransition) {
      // 使用 requestAnimationFrame 确保在浏览器渲染后执行
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setEnableTransition(true);
        });
      });
    }
  }, [enableTransition]);

  // 滑动处理
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasMultipleGames) return;
    touchStartX.current = e.touches[0].clientX;
    pauseAutoPlay();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!hasMultipleGames) return;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!hasMultipleGames) return;
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(diff) > minSwipeDistance) {
      const n = infiniteBannersLengthRef.current;
      if (diff > 0) {
        setCurrentIndex((prev) => Math.min(prev + 1, n - 1));
      } else {
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
      }
    }

    resumeAutoPlay();
  };

  // 点击圆点切换
  const handleDotClick = (index: number) => {
    setCurrentIndex(index + 1);
    resetAutoPlay();
  };

  const handlePrevBanner = () => {
    if (!hasMultipleGames) return;
    pauseAutoPlay();
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
    resumeAutoPlay();
  };

  const handleNextBanner = () => {
    if (!hasMultipleGames) return;
    pauseAutoPlay();
    setCurrentIndex((prev) => {
      const n = infiniteBannersLengthRef.current;
      return Math.min(prev + 1, n - 1);
    });
    resumeAutoPlay();
  };

  // 重置自动轮播
  const resetAutoPlay = useCallback(() => {
    // 清除现有定时器
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    
    if (!isPausedRef.current && banners.length > 0 && hasMultipleGames) {
      autoPlayTimerRef.current = setInterval(() => {
        const n = infiniteBannersLengthRef.current;
        if (n <= 1) return;
        setCurrentIndex((prev) => {
          // 最后一格为克隆首图，须等 transitionend 复位；若此处再累加会出现 translateX 数千 % 的失控
          if (prev >= n - 1) return prev;
          return prev + 1;
        });
      }, 5000); // 每5秒切换一次
    }
  }, [banners.length, hasMultipleGames]);

  // 暂停自动轮播
  const pauseAutoPlay = useCallback(() => {
    isPausedRef.current = true;
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, []);

  // 恢复自动轮播
  const resumeAutoPlay = useCallback(() => {
    isPausedRef.current = false;
    resetAutoPlay();
  }, [resetAutoPlay]);

  // 初始化自动轮播（当 banners 准备好时）
  useEffect(() => {
    // 确保 banners 有内容才启动自动轮播
    if (banners.length > 0 && hasMultipleGames) {
      // 延迟一小段时间确保DOM已经渲染
      const timer = setTimeout(() => {
    resetAutoPlay();
      }, 100);
      
      return () => {
        clearTimeout(timer);
        if (autoPlayTimerRef.current) {
          clearInterval(autoPlayTimerRef.current);
          autoPlayTimerRef.current = null;
        }
      };
    }
    
    // 组件卸载时清除定时器
    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [banners.length, hasMultipleGames, resetAutoPlay]);

  // 当 currentIndex 变化时，如果未暂停则重置自动轮播计时器（避免手动操作后立即自动切换）
  useEffect(() => {
    if (!hasMultipleGames) return;
    if (currentIndex === 0 || currentIndex === infiniteBannersLengthRef.current - 1) {
      return;
    }

    if (!isPausedRef.current && banners.length > 0) {
      // 延迟重置，避免在边界跳转时立即重置
      const timer = setTimeout(() => {
      resetAutoPlay();
      }, 300);
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [currentIndex, banners.length, hasMultipleGames, resetAutoPlay]);

  // 获取所有游戏的 app_key
  const getAllAppKeys = (): string[] => {
    return games.map((game) => game.app_key);
  };

  // 加载游戏区服角色列表
  const loadingRef = useRef(false); // 防止重复请求
  const lastTokenRef = useRef<string | undefined>(undefined); // 记录上次的 token
  
  useEffect(() => {
    const loadGameRoles = async () => {
      const currentToken = user?.token;
      
      // 如果 token 没有变化，不重复请求
      if (currentToken === lastTokenRef.current) {
        return;
      }
      
      // 更新记录的 token
      lastTokenRef.current = currentToken;
      
      if (!currentToken) {
        // 未登录，清空角色列表
        gameRoleStore.clear();
        loadingRef.current = false;
        return;
      }

      // 如果正在加载中，直接返回
      if (loadingRef.current) {
        return;
      }

      // 如果已有数据且 token 相同，不再重复请求
      const currentRoles = gameRoleStore.getRoles();
      if (currentRoles.length > 0) {
        loadingRef.current = false;
        return;
      }

      // 如果没有角色数据，调用接口获取
      loadingRef.current = true;
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
        // console.error('获取游戏角色列表失败:', error);
        gameRoleStore.setError(error instanceof Error ? error.message : '获取游戏角色列表失败');
      } finally {
      loadingRef.current = false;
        gameRoleStore.setLoading(false);
      }
    };

    loadGameRoles();
  }, [user?.token]);

  /** 无角色弹窗内：重新拉取区服角色列表，若已有当前游戏角色则进入商店 */
  const handleNoRoleRefreshRoles = useCallback(async () => {
    const gid = pendingNoRoleGameId;
    if (!gid || noRoleRefreshLoading) return;
    const game = games.find((g) => g.id === gid);
    if (!game || !user?.token) return;

    setNoRoleRefreshInlineErrorI18nKey(null);
    setNoRoleRefreshLoading(true);
    try {
      const appKeys = games.map((g) => g.app_key);
      const res = await gameRoleApi.getGameServerRoleList(appKeys);
      if (res.success && res.data) {
        gameRoleStore.setRoles(res.data);
        const hasCurrent = res.data.some((r) => r.app_key === game.app_key);
        if (hasCurrent) {
          setShowAlertModal(false);
          setAlertMessageI18nKey(null);
          setPendingNoRoleGameId(null);
          navigate(`/game/${gid}`);
        } else {
          setNoRoleRefreshInlineErrorI18nKey('home.noRoleRefreshNotFound');
          messageStore.show(t('home.noRoleRefreshNotFound'));
        }
      } else {
        setNoRoleRefreshInlineErrorI18nKey(null);
        messageStore.show(res.error || t('home.noRoleRefreshFailed'));
      }
    } catch {
      setNoRoleRefreshInlineErrorI18nKey(null);
      messageStore.show(t('home.noRoleRefreshFailed'));
    } finally {
      setNoRoleRefreshLoading(false);
    }
  }, [pendingNoRoleGameId, noRoleRefreshLoading, user?.token, navigate, t]);

  // 游戏卡片点击
  const handleGameClick = (gameId: string) => {
    requireLogin(() => {
      // 查找对应的游戏
      const game = games.find((g) => g.id === gameId);
      if (!game) {
        // console.error('Game not found:', gameId);
        return;
      }

      // 检查游戏是否切换
      const previousAppKey = storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
      const isGameSwitched = previousAppKey && previousAppKey !== game.app_key;
      
      // 如果游戏切换了，清除游戏特定的用户字段并加载新游戏的选择
      if (isGameSwitched) {
        clearGameSpecificFields(previousAppKey, game.app_key);
      }

      // 保存当前选择的游戏的 appKey 到 localStorage
      storage.set(STORAGE_KEYS.CURRENT_GAME_APP_KEY, game.app_key);

      // 检查是否有该游戏的角色账号（使用全局 hook）
      const hasRoles = hasRolesForAppKey(game.app_key);

      if (!hasRoles) {
        setPendingNoRoleGameId(gameId);
        setAlertMessageI18nKey('home.noRoleAccount');
        setNoRoleRefreshInlineErrorI18nKey(null);
        setShowAlertModal(true);
        return;
      }

      // 有角色账号，进入商品页面
      navigate(`/game/${gameId}`);
    });
  };

  const handleBannerClick = () => {
    const game = games[realIndex];
    if (game) {
      handleGameClick(game.id);
    }
  };


  return (
    <div className={styles.home}>
      <HomeBackgroundPattern />
      {/* 促销横幅 */}
      {banners.length > 0 && (
      <div className={styles.bannerSection}>
        <div
          className={`${styles.bannerCarousel} ${
            !hasMultipleGames ? styles.bannerCarouselSingle : ''
          }`}
        >
          {hasMultipleGames && (
            <button
              type="button"
              className={`${styles.bannerArrow} ${styles.bannerArrowPrev}`}
              onClick={handlePrevBanner}
              aria-label="上一张"
            >
              <img src={bannerArrowImg} alt="" className={styles.bannerArrowIcon} />
            </button>
          )}

          <div
            className={styles.banner}
            onTouchStart={hasMultipleGames ? handleTouchStart : undefined}
            onTouchMove={hasMultipleGames ? handleTouchMove : undefined}
            onTouchEnd={hasMultipleGames ? handleTouchEnd : undefined}
            onMouseEnter={hasMultipleGames ? pauseAutoPlay : undefined}
            onMouseLeave={hasMultipleGames ? resumeAutoPlay : undefined}
          >
            <div ref={bannerViewportRef} className={styles.bannerViewport}>
              <div
                ref={bannerRef}
                className={styles.bannerContent}
                style={
                  {
                    '--banner-slide-width':
                      bannerSlideWidth > 0 ? `${bannerSlideWidth}px` : '100%',
                    transform:
                      bannerSlideWidth > 0
                        ? `translate3d(-${currentIndex * bannerSlideWidth}px, 0, 0)`
                        : `translateX(-${currentIndex * 100}%)`,
                    transition: enableTransition ? 'transform 0.3s ease' : 'none',
                  } as React.CSSProperties
                }
              >
                {infiniteBanners.map((banner, index) => (
                  <img
                    key={index}
                    src={banner}
                    alt={`Banner ${index + 1}`}
                    className={styles.bannerImage}
                    loading={index === currentIndex ? 'eager' : 'lazy'}
                    decoding={index === currentIndex ? 'sync' : 'async'}
                    fetchpriority={index === currentIndex ? 'high' : 'low'}
                    onClick={handleBannerClick}
                  />
                ))}
              </div>
            </div>

            <div className={styles.bannerTips}>
              <span className={styles.bannerTipsText}>
                {t('home.purchaseEntryParts.prefix')}
                <span className={styles.bannerTipsKeyword}>{t('home.purchaseEntryParts.keyword')}</span>
                {t('home.purchaseEntryParts.suffix')}
              </span>
            </div>
          </div>

          {hasMultipleGames && (
            <button
              type="button"
              className={`${styles.bannerArrow} ${styles.bannerArrowNext}`}
              onClick={handleNextBanner}
              aria-label="下一张"
            >
              <img src={bannerArrowImg} alt="" className={styles.bannerArrowIcon} />
            </button>
          )}
        </div>

        {hasMultipleGames && (
          <div className={styles.bannerDots}>
            {games.map((game, index) => (
              <button
                key={game.id}
                type="button"
                className={`${styles.bannerDot} ${realIndex === index ? styles.bannerDotActive : ''}`}
                onClick={() => handleDotClick(index)}
                aria-label={game.name}
              />
            ))}
          </div>
        )}

        {hasMultipleGames && (
          <div className={styles.gameThumbList}>
            {games.map((game, index) => (
              <button
                key={game.id}
                type="button"
                className={`${styles.gameThumb} ${realIndex === index ? styles.gameThumbActive : ''}`}
                onClick={() => handleDotClick(index)}
                aria-label={game.name}
              >
                <span className={styles.gameThumbFrame}>
                  <img src={game.icon} alt={game.name} className={styles.gameThumbIcon} />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      <HomeMobileGameList
        games={games}
        onGameClick={handleGameClick}
        title={t('home.selectGameMobileTitle')}
        goLabel={t('home.mobileGameCardGo')}
      />

      {/* 底部导航栏会在Layout中处理 */}

      {/* 登录弹窗 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />

      {/* 提示弹窗 */}
      <AlertModal
        isOpen={showAlertModal}
        onClose={() => {
          setShowAlertModal(false);
          setAlertMessageI18nKey(null);
          setPendingNoRoleGameId(null);
          setNoRoleRefreshLoading(false);
          setNoRoleRefreshInlineErrorI18nKey(null);
        }}
        message={alertMessageI18nKey ? t(alertMessageI18nKey) : ''}
        hideActions={alertMessageI18nKey === 'home.noRoleAccount'}
        extraBelowMessage={
          alertMessageI18nKey === 'home.noRoleAccount' && pendingNoRoleGameId ? (
            <>
              <p className={alertModalStyles.refreshLine}>
                <span>{t('home.noRoleRefreshPrefix')}</span>
                <button
                  type="button"
                  className={alertModalStyles.refreshLink}
                  onClick={handleNoRoleRefreshRoles}
                  disabled={noRoleRefreshLoading}
                  aria-busy={noRoleRefreshLoading}
                  aria-label={noRoleRefreshLoading ? t('home.noRoleRefreshing') : t('home.noRoleRefreshAction')}
                >
                  {noRoleRefreshLoading ? (
                    <span className={alertModalStyles.refreshSpinner} aria-hidden />
                  ) : (
                    t('home.noRoleRefreshAction')
                  )}
                </button>
              </p>
              {noRoleRefreshInlineErrorI18nKey && (
                <p className={alertModalStyles.refreshError}>
                  {t(noRoleRefreshInlineErrorI18nKey)}
                </p>
              )}
            </>
          ) : null
        }
      />

    </div>
  );
};
