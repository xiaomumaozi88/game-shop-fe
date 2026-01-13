import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { LoginModal } from '@/components/LoginModal';
import homeSelectImg from '@/assets/imgs/touka_home_BotomInf_homeSelect.png';
import homeUnSelectImg from '@/assets/imgs/touka_home_BotomInf_homeUnSelect.png';
import orderSelectImg from '@/assets/imgs/touka_home_BotomInf_OrderSelect.png';
import orderUnSelectImg from '@/assets/imgs/touka_home_BotomInf_OrderUnSelect.png';
import styles from './BottomNav.module.less';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { requireLogin, showLoginModal, setShowLoginModal } = useLoginGuard();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const navItems = [
    {
      id: 'home',
      label: t('bottomNav.home'),
      path: '/',
      iconActive: homeSelectImg,
      iconInactive: homeUnSelectImg,
    },
    {
      id: 'orders',
      label: t('bottomNav.myOrders'),
      path: '/history',
      iconActive: orderSelectImg,
      iconInactive: orderUnSelectImg,
    },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    // 主页不需要登录检查
    if (path === '/') {
      navigate(path);
      return;
    }
    // 其他页面需要登录检查
    requireLogin(() => {
      navigate(path);
    });
  };

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY || window.pageYOffset;
          
          // 如果滚动距离很小（小于10px），不改变状态，避免频繁切换
          if (Math.abs(currentScrollY - lastScrollY.current) < 10) {
            ticking.current = false;
            return;
          }

          // 在页面顶部时始终显示
          if (currentScrollY <= 50) {
            setIsVisible(true);
          } else {
            // 向下滚动时隐藏，向上滚动时显示
            if (currentScrollY > lastScrollY.current) {
              // 向下滚动时隐藏
              setIsVisible(false);
            } else if (currentScrollY < lastScrollY.current) {
              // 向上滚动时显示
              setIsVisible(true);
            }
          }

          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });

        ticking.current = true;
      }
    };

    // 监听滚动事件
    window.addEventListener('scroll', handleScroll, { passive: true });

    // 初始化滚动位置和可见性
    lastScrollY.current = window.scrollY || window.pageYOffset;
    setIsVisible(lastScrollY.current <= 50);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <>
      <nav className={`${styles.bottomNav} ${!isVisible ? styles.bottomNavHidden : ''}`}>
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.id}
              className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
              onClick={() => handleNavClick(item.path)}
              aria-label={item.label}
            >
              <span className={styles.icon}>
                <img
                  src={active ? item.iconActive : item.iconInactive}
                  alt={item.label}
                  className={styles.iconImg}
                />
              </span>
              <span className={styles.label}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 登录弹窗 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
};

