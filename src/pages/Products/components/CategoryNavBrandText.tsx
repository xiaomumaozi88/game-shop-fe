import React, { useRef } from 'react';
import { useFitText } from '@/hooks/useFitText';
import { useResponsive } from '@/hooks/useResponsive';
import styles from '../Products.module.less';

interface CategoryNavBrandTextProps {
  text: string;
  locale: string;
}

const CJK_LOCALES = new Set(['zh-CN', 'zh-TW', 'ja-JP', 'ko-KR']);

const MIN_FONT_SIZE: Record<'mobile' | 'tablet' | 'desktop', number> = {
  mobile: 8,
  tablet: 9,
  desktop: 10,
};

export const CategoryNavBrandText: React.FC<CategoryNavBrandTextProps> = ({ text, locale }) => {
  const textRef = useRef<HTMLSpanElement>(null);
  const { breakpoint } = useResponsive();
  const isCompactLocale = !CJK_LOCALES.has(locale);

  useFitText(textRef, text, {
    minFontSize: MIN_FONT_SIZE[breakpoint],
  });

  return (
    <div className={styles.categoryNavBrandTextWrap}>
      <span
        ref={textRef}
        className={`${styles.categoryNavBrandText}${
          isCompactLocale ? ` ${styles.categoryNavBrandTextCompact}` : ''
        }`}
      >
        {text}
      </span>
    </div>
  );
};
