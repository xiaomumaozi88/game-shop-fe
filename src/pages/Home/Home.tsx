import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { useUser } from '@/hooks/useUser';
import { useResponsive } from '@/hooks/useResponsive';
import { LoginModal } from '@/components/LoginModal';
import { AlertModal } from '@/components/AlertModal';
import { useGameRole } from '@/hooks/useGameRole';
import { gameRoleStore } from '@/store/gameRoleStore';
import { gameRoleApi } from '@/utils/api';
import { storage, STORAGE_KEYS } from '@/utils';
import BAM_IMG from '@/assets/imgs/bam_bam_game_img.png';
import CROCO_IMG from '@/assets/imgs/croco_game_img.png';
import BAM_ICON from '@/assets/imgs/bam_icon.png';
import OOPSIE_ICON from '@/assets/imgs/oopsie_icon.png';
import crocoBannerImg from '@/assets/imgs/croco_banner.png';
import banBamBannerImg from '@/assets/imgs/ban_bam_banner.jpg';
import toukaWebHomeBanner1 from '@/assets/imgs/touka_web_home_banner1.png';
import toukaWebHomeBanner2 from '@/assets/imgs/touka_web_home_banner2.png';
import styles from './Home.module.less';

// 游戏数据
interface Game {
  id: string;
  name: string;
  image: string; // 游戏卡片完整图片
  app_key: string;
  icon: string; // 游戏图标（用于 Footer 下载部分）
  downloadLinks: {
    ios: string; // iOS App Store 下载链接
    android: string; // Google Play 下载链接
  };
}

// 导出游戏数据，供 Footer 组件使用
export const games: Game[] = [
  {
    id: 'bam-bam-squad',
    name: 'Bam! Bam Squad', // 包包3 
    image: BAM_IMG,
    app_key: 'f6594168ce3a9cc57ab7ed74426e25e1',
    icon: BAM_ICON,
    downloadLinks: {
      ios: 'https://apps.apple.com/app/id6751526939',
      android: 'https://play.google.com/store/apps/details?id=com.bam.bam.squad.pigeon.wall.wow.clash.battle.game',
    },
  },
  {
    id: 'oopsie-croco',
    name: 'Oopsie Croco', // 包包4 
    image: CROCO_IMG,
    app_key: '45a56d38bbdd60353438aa25d1ccff20',
    icon: OOPSIE_ICON,
    downloadLinks: {
      ios: 'https://apps.apple.com/app/id6746253182',
      android: 'https://play.google.com/store/apps/details?id=com.oopsie.croco.challenge.leisure.battle.game',
    },
  }
];

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { requireLogin, showLoginModal, setShowLoginModal } = useLoginGuard();
  const { user, clearGameSpecificFields } = useUser();
  const { hasRolesForAppKey } = useGameRole(); // 使用全局 hook 检查角色
  const { isDesktop } = useResponsive();
  
  // PC端使用新的banner图，移动端使用原有banner图
  const banners = useMemo(() => {
    return isDesktop 
      ? [toukaWebHomeBanner1, toukaWebHomeBanner2]
      : [crocoBannerImg, banBamBannerImg];
  }, [isDesktop]);
  
  // 创建无限循环数组：[最后一张, 第一张, 第二张, ..., 第一张]
  const infiniteBanners = useMemo(() => {
    if (banners.length === 0) return [];
    return [banners[banners.length - 1], ...banners, banners[0]];
  }, [banners]);
  
  // 当前显示的索引（初始为1，即第一张真实图片）
  const [currentIndex, setCurrentIndex] = useState(1);

  // 当 banners 变化时，重置 currentIndex 到初始值并清除定时器
  useEffect(() => {
    if (banners.length > 0) {
      // 清除现有定时器
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      setCurrentIndex(1);
      currentIndexRef.current = 1;
    }
  }, [banners.length]);
  
  // 是否启用过渡动画
  const [enableTransition, setEnableTransition] = useState(true);
  
  // 触摸相关
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const bannerRef = useRef<HTMLDivElement>(null);
  
  // 自动轮播相关
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef<boolean>(false);
  const currentIndexRef = useRef<number>(1); // 用于在回调中获取最新的 currentIndex
  const infiniteBannersLengthRef = useRef<number>(0); // 用于在定时器中获取最新的 infiniteBanners 长度

  // 同步 infiniteBanners.length 到 ref
  useEffect(() => {
    infiniteBannersLengthRef.current = infiniteBanners.length;
  }, [infiniteBanners.length]);

  // 提示弹窗状态
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // 同步 currentIndex 到 ref
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // 将内部索引转换为真实索引（用于圆点显示）
  const getRealIndex = (index: number): number => {
    if (banners.length === 0) return 0;
    if (index === 0) return banners.length - 1; // 克隆的最后一张
    if (index === infiniteBanners.length - 1) return 0; // 克隆的第一张
    return index - 1; // 真实图片
  };

  const realIndex = getRealIndex(currentIndex);

  // 处理边界跳转：当滑动到克隆图片时，无动画跳转到对应的真实图片
  useEffect(() => {
    const banner = bannerRef.current;
    if (!banner || banners.length === 0) return;

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
  }, [currentIndex, banners.length, infiniteBanners.length]);

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
    touchStartX.current = e.touches[0].clientX;
    // 暂停自动轮播
    pauseAutoPlay();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0) {
        // 向左滑动，下一张
        setCurrentIndex((prev) => prev + 1);
      } else {
        // 向右滑动，上一张
        setCurrentIndex((prev) => prev - 1);
      }
    }
    
    // 恢复自动轮播
    resumeAutoPlay();
  };

  // 点击圆点切换
  const handleDotClick = (index: number) => {
    setCurrentIndex(index + 1); // +1 因为前面有克隆图片
    // 重置自动轮播
    resetAutoPlay();
  };

  // 自动切换到下一张
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => {
      // 确保有足够的banner才切换
      if (infiniteBanners.length <= 1) return prev;
      const next = prev + 1;
      // 如果超过了最后一张，回到第一张（但实际上应该由边界处理逻辑处理）
      return next;
    });
  }, [infiniteBanners.length]);

  // 重置自动轮播
  const resetAutoPlay = useCallback(() => {
    // 清除现有定时器
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    
    // 如果未暂停且有banner内容，重新启动自动轮播
    if (!isPausedRef.current && banners.length > 0 && infiniteBannersLengthRef.current > 1) {
      autoPlayTimerRef.current = setInterval(() => {
        // 使用 ref 来获取最新的 infiniteBanners 长度，避免闭包问题
        if (infiniteBannersLengthRef.current <= 1) return;
        // 使用函数式更新确保获取最新的状态
        setCurrentIndex((prev) => prev + 1);
      }, 5000); // 每5秒切换一次
    }
  }, [banners.length, infiniteBanners.length]);

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
    if (banners.length > 0 && infiniteBannersLengthRef.current > 1) {
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
  }, [banners.length, infiniteBanners.length, resetAutoPlay]); // 依赖 banners 和 infiniteBanners

  // 当 currentIndex 变化时，如果未暂停则重置自动轮播计时器（避免手动操作后立即自动切换）
  useEffect(() => {
    // 跳过边界跳转时的重置（索引为0或infiniteBanners.length-1时）
    if (currentIndex === 0 || currentIndex === infiniteBannersLengthRef.current - 1) {
      return;
    }
    
    if (!isPausedRef.current && banners.length > 0 && infiniteBannersLengthRef.current > 1) {
      // 延迟重置，避免在边界跳转时立即重置
      const timer = setTimeout(() => {
      resetAutoPlay();
      }, 300);
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [currentIndex, banners.length, infiniteBanners.length, resetAutoPlay]);

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
        console.error('获取游戏角色列表失败:', error);
        gameRoleStore.setError(error instanceof Error ? error.message : '获取游戏角色列表失败');
      } finally {
      loadingRef.current = false;
        gameRoleStore.setLoading(false);
      }
    };

    loadGameRoles();
  }, [user?.token]);

  // 游戏卡片点击
  const handleGameClick = (gameId: string) => {
    requireLogin(() => {
      // 查找对应的游戏
      const game = games.find((g) => g.id === gameId);
      if (!game) {
        console.error('Game not found:', gameId);
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
        // 没有角色账号，显示提示弹窗
        setAlertMessage(t('home.noRoleAccount'));
        setShowAlertModal(true);
        return;
      }

      // 有角色账号，进入商品页面
      navigate(`/game/${gameId}`);
    });
  };


  return (
    <div className={styles.home}>
      {/* 促销横幅 */}
      {banners.length > 0 && (
      <div className={styles.bannerSection}>
        <div
          className={styles.banner}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseEnter={pauseAutoPlay}
          onMouseLeave={resumeAutoPlay}
        >
          <div
            ref={bannerRef}
            className={styles.bannerContent}
            style={{
              transform: `translateX(-${currentIndex * 100}%)`,
              transition: enableTransition ? 'transform 0.3s ease' : 'none',
            }}
          >
            {infiniteBanners.map((banner, index) => (
              <img
                key={index}
                src={banner}
                alt={`Banner ${index + 1}`}
                className={styles.bannerImage}
              />
            ))}
          </div>
        </div>
        {/* 轮播指示点 */}
        <div className={styles.bannerDots}>
          {banners.map((_, index) => (
            <button
              key={index}
              className={`${styles.dot} ${realIndex === index ? styles.dotActive : ''}`}
              onClick={() => handleDotClick(index)}
              aria-label={`切换到第${index + 1}张`}
            />
          ))}
        </div>
      </div>
      )}

      {/* 游戏选择部分 */}
      <div className={styles.gameSection}>
        <h2 className={styles.sectionTitle}>
          {isDesktop ? (
            <>
              {t('home.selectGameParts.prefix')}
              <span className={styles.rechargeKeyword}>{t('home.selectGameParts.keyword')}</span>
              {t('home.selectGameParts.suffix')}
            </>
          ) : (
            t('home.selectGame')
          )}
        </h2>
        <div className={styles.gameList}>
          {games.map((game) => (
            <div
              key={game.id}
              className={styles.gameCard}
              onClick={() => handleGameClick(game.id)}
            >
              {game.image ? (
                <img src={game.image} alt={game.name} className={styles.gameCardImage} />
              ) : (
                <div className={styles.gameCardPlaceholder}>
                  <span>{game.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 底部导航栏会在Layout中处理 */}

      {/* 登录弹窗 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />

      {/* 提示弹窗 */}
      <AlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        message={alertMessage}
      />

    </div>
  );
};
