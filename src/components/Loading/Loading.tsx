import React from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import styles from './Loading.module.less';

interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
}

export const Loading: React.FC<LoadingProps> = ({ size = 'medium', text }) => {
  const { t } = useLanguage();
  const displayText = text || t('common.loading');

  return (
    <div className={styles.loading}>
      <div className={`${styles.spinner} ${styles[size]}`}></div>
      <p className={styles.text}>{displayText}</p>
    </div>
  );
};

