import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useResponsive } from '@/hooks/useResponsive';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { resolveOrdersListPath, isGameStoreProductsPath } from '@/utils';
import { LoginModal } from '@/components/LoginModal';
import homeSelectImg from '@/assets/img2/touka_home_BotomInf_homeSelect.png';
import homeUnSelectImg from '@/assets/img2/touka_home_BotomInf_homeUnSelect.png';
import orderSelectImg from '@/assets/img2/touka_home_BotomInf_OrderSelect.png';
import orderUnSelectImg from '@/assets/img2/touka_home_BotomInf_OrderUnSelect.png';
import styles from './BottomNav.module.less';

interface BottomNavProps {
  hideOnMobile?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ hideOnMobile = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { isMobile } = useResponsive();
  const { requireLogin, showLoginModal, setShowLoginModal } = useLoginGuard();
  const [isVisible, setIsVisible] = useState(true);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ordersPath = resolveOrdersListPath(location.pathname);
  const isHomePage = location.pathname === '/';
  const isProductsPage = isGameStoreProductsPath(location.pathname);
  const isHistoryPage = location.pathname.includes('/history');
  const shouldRenderNav = isHomePage || isProductsPage || isHistoryPage;

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
      path: ordersPath,
      iconActive: orderSelectImg,
      iconInactive: orderUnSelectImg,
    },
  ];

  const isActive = (_path: string, id: string) => {
    if (id === 'home') {
      return isHomePage || isProductsPage;
    }
    return isHistoryPage;
  };

  const handleNavClick = (path: string, id: string) => {
    if (id === 'home') {
      navigate(path);
      return;
    }

    requireLogin(() => {
      navigate(ordersPath);
    });
  };

  useEffect(() => {
    if (!isMobile || !shouldRenderNav) {
      return;
    }

    const handleScroll = () => {
      setIsVisible(false);

      if (showTimer.current) {
        clearTimeout(showTimer.current);
      }

      showTimer.current = setTimeout(() => {
        setIsVisible(true);
      }, 200);
    };

    const scrollTargets = new Set<EventTarget>([window]);
    const layoutScroller = document.querySelector<HTMLElement>('[data-ios-scroll-fix]');

    if (layoutScroller) {
      scrollTargets.add(layoutScroller);
    }

    scrollTargets.forEach((target) => {
      target.addEventListener('scroll', handleScroll, { passive: true });
    });

    return () => {
      scrollTargets.forEach((target) => {
        target.removeEventListener('scroll', handleScroll);
      });

      if (showTimer.current) {
        clearTimeout(showTimer.current);
      }
    };
  }, [isMobile, shouldRenderNav]);

  if (!isMobile || !shouldRenderNav) {
    return (
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    );
  }

  return (
    <>
      <nav
        className={`${styles.bottomNav} ${
          !isVisible || hideOnMobile ? styles.bottomNavHidden : ''
        }`}
      >
        {navItems.map((item) => {
          const active = isActive(item.path, item.id);
          return (
            <button
              key={item.id}
              className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
              onClick={() => handleNavClick(item.path, item.id)}
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
