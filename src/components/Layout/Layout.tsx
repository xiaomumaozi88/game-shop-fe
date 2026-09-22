import React, { useState } from 'react';
import { userStore } from '@/store/userStore';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
import { useViewportHeightFix } from '@/hooks/useViewportHeightFix';
import styles from './Layout.module.less';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const isHomePage = useLocation().pathname === '/';
  const [isLoggedIn, setIsLoggedIn] = useState(!!userStore.getUser()?.token);
  const [hideBottomNavOnMobile, setHideBottomNavOnMobile] = useState(false);
  useViewportHeightFix();

  React.useEffect(() => {
    const unsubscribe = userStore.subscribe(() => {
      setIsLoggedIn(!!userStore.getUser()?.token);
    });
    return unsubscribe;
  }, []);

  return (
    <div
      className={`${styles.layout} ${isHomePage ? styles.layoutHome : ''}`}
      data-ios-scroll-fix
    >
      <Header />
      <main className={styles.main}>{children}</main>
      <Footer onLanguageDropdownVisibilityChange={setHideBottomNavOnMobile} />
      <BottomNav hideOnMobile={hideBottomNavOnMobile || !isLoggedIn || isHomePage} />
    </div>
  );
};
