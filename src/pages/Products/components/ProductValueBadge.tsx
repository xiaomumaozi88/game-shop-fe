import React, { useRef } from 'react';
import { useFitText } from '@/hooks/useFitText';
import { useResponsive } from '@/hooks/useResponsive';
import valueLabelBg from '@/assets/img2/pay_ic_label.png';
import styles from '../Products.module.less';

interface ProductValueBadgeProps {
  valueRatio: number;
  superValueLabel: string;
}

const VALUE_BADGE_MIN_FONT_SIZE: Record<'mobile' | 'tablet' | 'desktop', number> = {
  mobile: 6,
  tablet: 8,
  desktop: 9,
};

export const ProductValueBadge: React.FC<ProductValueBadgeProps> = ({
  valueRatio,
  superValueLabel,
}) => {
  const labelRef = useRef<HTMLSpanElement>(null);
  const { breakpoint } = useResponsive();

  useFitText(labelRef, superValueLabel, {
    minFontSize: VALUE_BADGE_MIN_FONT_SIZE[breakpoint],
    step: 0.25,
  });

  return (
    <div className={styles.productValueBadge} aria-hidden>
      <img src={valueLabelBg} alt="" className={styles.productValueBadgeBg} />
      <div className={styles.productValueBadgeText}>
        <span className={styles.productValueRatio}>{valueRatio}%</span>
        <span className={styles.productValueLabelBox}>
          <span ref={labelRef} className={styles.productValueLabel}>
            {superValueLabel}
          </span>
        </span>
      </div>
    </div>
  );
};
