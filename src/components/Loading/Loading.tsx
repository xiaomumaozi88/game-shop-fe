import React from 'react';
import styles from './Loading.module.less';

interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
}

export const Loading: React.FC<LoadingProps> = ({ size = 'medium' }) => {
  return (
    <div className={styles.loading}>
      <div className={`${styles.spinner} ${styles[size]}`}></div>
    </div>
  );
};

