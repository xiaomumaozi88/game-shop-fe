import React from 'react';
import valueLabelBg from '@/assets/img2/pay_ic_label.png';
import styles from '../Products.module.less';

interface ProductValueBadgeProps {
  valueRatio: number;
  superValueLabel: string;
}

export const ProductValueBadge: React.FC<ProductValueBadgeProps> = ({
  valueRatio,
  superValueLabel,
}) => (
  <div className={styles.productValueBadge} aria-hidden>
    <img src={valueLabelBg} alt="" className={styles.productValueBadgeBg} />
    <div className={styles.productValueBadgeText}>
      <span className={styles.productValueRatio}>{valueRatio}%</span>
      <span className={styles.productValueLabel}>{superValueLabel}</span>
    </div>
  </div>
);
