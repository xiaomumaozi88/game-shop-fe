import React from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { CustomerServiceFab } from '@/components/CustomerServiceFab';
import { useViewportHeightFix } from '@/hooks/useViewportHeightFix';
import styles from './Layout.module.less';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const isHomePage = useLocation().pathname === '/';
  useViewportHeightFix();

  return (
    <div
      className={`${styles.layout} ${isHomePage ? styles.layoutHome : ''}`}
      data-ios-scroll-fix
    >
      <Header />
      <main className={styles.main}>{children}</main>
      <Footer />
      <CustomerServiceFab />
    </div>
  );
};
