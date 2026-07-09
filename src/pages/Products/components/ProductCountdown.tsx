import React from 'react';
import styles from '../Products.module.less';

interface ProductCountdownProps {
  text: string;
}

export const ProductCountdown: React.FC<ProductCountdownProps> = ({ text }) => (
  <div className={styles.countdown}>
    <div className={styles.countdownBg} aria-hidden>
      <span className={styles.countdownBgLeft} />
      <span className={styles.countdownBgMiddle} />
      <span className={styles.countdownBgRight} />
    </div>
    <div className={styles.countdownText}>{text}</div>
  </div>
);
