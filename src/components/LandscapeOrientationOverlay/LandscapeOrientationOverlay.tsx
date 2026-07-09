import React from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import styles from './LandscapeOrientationOverlay.module.less';

export const LandscapeOrientationOverlay: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className={styles.overlay} role="status" aria-live="polite" aria-label={t('orientation.bestExperience')}>
      <div className={styles.phone} aria-hidden>
        <span className={styles.phoneScreen} />
      </div>
      <p className={styles.message}>{t('orientation.bestExperience')}</p>
    </div>
  );
};
