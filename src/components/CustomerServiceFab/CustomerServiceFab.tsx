import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { SupportModal } from '@/components/SupportModal';
import customerServiceImg from '@/assets/img2/pay_co_home_CustomerService.png';
import styles from './CustomerServiceFab.module.less';

export const CustomerServiceFab: React.FC = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`${styles.fab} ${isHomePage ? styles.fabHome : ''}`}
        onClick={() => setSupportModalOpen(true)}
        aria-label={t('support.title')}
      >
        <img src={customerServiceImg} alt="" className={styles.fabImg} />
      </button>

      <SupportModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
      />
    </>
  );
};
