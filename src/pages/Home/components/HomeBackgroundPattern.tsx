import React, { useMemo } from 'react';
import mainBgItem from '@/assets/img2/main-bg-item.png';
import { useResponsive } from '@/hooks/useResponsive';
import styles from './HomeBackgroundPattern.module.less';

const DESKTOP_PATTERN = {
  tileWidth: 300,
  tileHeight: 360,
  iconWidth: 156,
  iconHeight: 183,
};

const MOBILE_PATTERN = {
  tileWidth: 150,
  tileHeight: 180,
  iconWidth: 78,
  iconHeight: 92,
};

export const HomeBackgroundPattern: React.FC = () => {
  const { isMobile } = useResponsive();
  const pattern = useMemo(
    () => (isMobile ? MOBILE_PATTERN : DESKTOP_PATTERN),
    [isMobile]
  );
  const patternId = isMobile ? 'home-bg-pattern-mobile' : 'home-bg-pattern-desktop';

  return (
    <div className={styles.patternLayer} aria-hidden="true">
      <svg
        className={`${styles.patternSvg} ${isMobile ? styles.patternSvgMobile : ''}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id={patternId}
            width={pattern.tileWidth}
            height={pattern.tileHeight}
            patternUnits="userSpaceOnUse"
          >
            <image
              href={mainBgItem}
              x={(pattern.tileWidth - pattern.iconWidth) / 2}
              y={(pattern.tileHeight - pattern.iconHeight) / 2}
              width={pattern.iconWidth}
              height={pattern.iconHeight}
              preserveAspectRatio="xMidYMid meet"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
};
