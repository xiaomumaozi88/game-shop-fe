import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

interface ResponsiveState {
  breakpoint: Breakpoint;
  isTouchLandscape: boolean;
}

const getResponsiveState = (): ResponsiveState => {
  if (typeof window === 'undefined') {
    return {
      breakpoint: 'desktop',
      isTouchLandscape: false,
    };
  }

  const width = window.innerWidth;
  const breakpoint: Breakpoint = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
  const isTouchLandscape = window.matchMedia(
    '(hover: none) and (pointer: coarse) and (orientation: landscape)',
  ).matches;

  return {
    breakpoint,
    isTouchLandscape,
  };
};

export const useResponsive = () => {
  const [{ breakpoint, isTouchLandscape }, setResponsiveState] = useState<ResponsiveState>(
    getResponsiveState,
  );

  useEffect(() => {
    const touchLandscapeQuery = window.matchMedia(
      '(hover: none) and (pointer: coarse) and (orientation: landscape)',
    );
    const syncResponsiveState = () => {
      setResponsiveState(getResponsiveState());
    };

    window.addEventListener('resize', syncResponsiveState);
    if (touchLandscapeQuery.addEventListener) {
      touchLandscapeQuery.addEventListener('change', syncResponsiveState);
    } else {
      touchLandscapeQuery.addListener(syncResponsiveState);
    }

    return () => {
      window.removeEventListener('resize', syncResponsiveState);
      if (touchLandscapeQuery.removeEventListener) {
        touchLandscapeQuery.removeEventListener('change', syncResponsiveState);
      } else {
        touchLandscapeQuery.removeListener(syncResponsiveState);
      }
    };
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isTouchLandscape,
  };
};
