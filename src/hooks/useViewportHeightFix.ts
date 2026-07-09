import { useEffect } from 'react';

const IOS_DEVICE_PATTERN = /iP(ad|hone|od)/;
const SAFARI_SETTLE_DELAYS = [80, 240, 600, 1000];
const SCROLL_LOCK_OVERLAY_ATTR = 'data-scroll-lock-overlay';
const KEYBOARD_RESIZE_THRESHOLD = 80;

let lastStableViewportHeight = 0;

function isIOSLikeBrowser(): boolean {
  const { userAgent, platform, maxTouchPoints } = window.navigator;
  return IOS_DEVICE_PATTERN.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

function setViewportHeightVariable(): void {
  const nextViewportHeight = Math.round(
    isIOSLikeBrowser()
      ? Math.max(window.innerHeight, window.visualViewport?.height ?? 0)
      : window.visualViewport?.height ?? window.innerHeight
  );
  const previousViewportHeight = lastStableViewportHeight || nextViewportHeight;
  const shouldKeepStableHeight =
    !isIOSLikeBrowser() &&
    isFocusedEditableInsideOverlay() &&
    previousViewportHeight - nextViewportHeight > KEYBOARD_RESIZE_THRESHOLD;
  const viewportHeight = shouldKeepStableHeight ? previousViewportHeight : nextViewportHeight;

  if (!shouldKeepStableHeight) {
    lastStableViewportHeight = viewportHeight;
  }

  document.documentElement.style.setProperty('--app-viewport-height', `${viewportHeight}px`);
}

function isEditableElement(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;

  const tagName = el.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || el.isContentEditable;
}

function isFocusedEditableInsideOverlay(): boolean {
  const activeElement = document.activeElement;
  return (
    isEditableElement(activeElement) &&
    activeElement?.closest(`[${SCROLL_LOCK_OVERLAY_ATTR}]`) !== null
  );
}

function clampScrollableElement(el: Element | null): void {
  if (!(el instanceof HTMLElement)) return;

  const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  if (el.scrollTop > maxScrollTop) {
    el.scrollTop = maxScrollTop;
  }
}

function clampPageScroll(): void {
  clampScrollableElement(document.scrollingElement);
  document
    .querySelectorAll<HTMLElement>('[data-ios-scroll-fix]')
    .forEach((el) => clampScrollableElement(el));
}

function syncViewportFrame(): void {
  window.requestAnimationFrame(() => {
    setViewportHeightVariable();
    clampPageScroll();
  });
}

export function settleIOSViewportAfterKeyboardClose(): void {
  if (!isIOSLikeBrowser()) return;

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }

  syncViewportFrame();
  SAFARI_SETTLE_DELAYS.forEach((delay) => {
    window.setTimeout(syncViewportFrame, delay);
  });
}

export function useViewportHeightFix(): void {
  useEffect(() => {
    const visualViewport = window.visualViewport;
    const timeoutIds: number[] = [];
    let frameId: number | null = null;
    const isIOS = isIOSLikeBrowser();

    const syncViewport = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        setViewportHeightVariable();
        clampPageScroll();
      });
    };

    const syncViewportAfterSafariSettles = () => {
      syncViewport();
      SAFARI_SETTLE_DELAYS.forEach((delay) => {
        timeoutIds.push(window.setTimeout(syncViewport, delay));
      });
    };

    syncViewportAfterSafariSettles();

    if (!isIOS) {
      window.addEventListener('resize', syncViewportAfterSafariSettles);

      return () => {
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }

        timeoutIds.forEach((id) => window.clearTimeout(id));
        window.removeEventListener('resize', syncViewportAfterSafariSettles);
      };
    }

    window.addEventListener('resize', syncViewportAfterSafariSettles);
    window.addEventListener('orientationchange', syncViewportAfterSafariSettles);
    window.addEventListener('pageshow', syncViewportAfterSafariSettles);
    document.addEventListener('focusout', syncViewportAfterSafariSettles, true);
    visualViewport?.addEventListener('resize', syncViewportAfterSafariSettles);
    visualViewport?.addEventListener('scroll', syncViewportAfterSafariSettles);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      timeoutIds.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('resize', syncViewportAfterSafariSettles);
      window.removeEventListener('orientationchange', syncViewportAfterSafariSettles);
      window.removeEventListener('pageshow', syncViewportAfterSafariSettles);
      document.removeEventListener('focusout', syncViewportAfterSafariSettles, true);
      visualViewport?.removeEventListener('resize', syncViewportAfterSafariSettles);
      visualViewport?.removeEventListener('scroll', syncViewportAfterSafariSettles);
    };
  }, []);
}
