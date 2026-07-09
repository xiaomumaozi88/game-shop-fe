import { useEffect } from 'react';

const SCROLL_LOCK_OVERLAY_ATTR = 'data-scroll-lock-overlay';

let lockCount = 0;
let preventScrollHandler: ((event: Event) => void) | null = null;
let touchStartHandler: ((event: TouchEvent) => void) | null = null;
let lastTouchY = 0;

function isInsideOverlay(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${SCROLL_LOCK_OVERLAY_ATTR}]`) !== null;
}

/** 在蒙版内查找可纵向滚动的祖先节点（弹窗内容区） */
function findOverlayScrollableAncestor(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;

  let el: Element | null = target;
  while (el instanceof HTMLElement) {
    const overlay = el.closest(`[${SCROLL_LOCK_OVERLAY_ATTR}]`);
    if (!overlay) return null;

    const { overflowY } = window.getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      return el;
    }

    if (el === overlay) break;
    el = el.parentElement;
  }

  return null;
}

function canScrollVertically(el: HTMLElement, deltaY: number): boolean {
  const { scrollTop, scrollHeight, clientHeight } = el;
  if (deltaY < 0) return scrollTop > 0;
  if (deltaY > 0) return scrollTop + clientHeight < scrollHeight - 1;
  return false;
}

function getTouchDeltaY(event: TouchEvent): number {
  const touchY = event.touches[0]?.clientY ?? lastTouchY;
  const deltaY = lastTouchY - touchY;
  lastTouchY = touchY;
  return deltaY;
}

function shouldPreventScrollEvent(event: Event): boolean {
  const { target } = event;

  // 蒙版外：拦截，不透传到背景列表
  if (!isInsideOverlay(target)) {
    return true;
  }

  const scrollable = findOverlayScrollableAncestor(target);

  // 蒙版内非可滚动区域：拦截
  if (!scrollable) {
    return true;
  }

  if (event instanceof WheelEvent) {
    return !canScrollVertically(scrollable, event.deltaY);
  }

  if (event instanceof TouchEvent && event.type === 'touchmove') {
    return !canScrollVertically(scrollable, getTouchDeltaY(event));
  }

  return false;
}

function attachScrollPreventers(): void {
  if (preventScrollHandler) return;

  preventScrollHandler = (event: Event) => {
    if (shouldPreventScrollEvent(event)) {
      event.preventDefault();
    }
  };

  touchStartHandler = (event: TouchEvent) => {
    lastTouchY = event.touches[0]?.clientY ?? 0;
  };

  document.addEventListener('wheel', preventScrollHandler, { passive: false, capture: true });
  document.addEventListener('touchstart', touchStartHandler, { passive: true, capture: true });
  document.addEventListener('touchmove', preventScrollHandler, { passive: false, capture: true });
}

function detachScrollPreventers(): void {
  if (preventScrollHandler) {
    document.removeEventListener('wheel', preventScrollHandler, { capture: true });
    document.removeEventListener('touchmove', preventScrollHandler, { capture: true });
    preventScrollHandler = null;
  }

  if (touchStartHandler) {
    document.removeEventListener('touchstart', touchStartHandler, { capture: true });
    touchStartHandler = null;
  }

  lastTouchY = 0;
}

function acquireScrollLock(): void {
  lockCount += 1;
  if (lockCount === 1) {
    attachScrollPreventers();
  }
}

function releaseScrollLock(): void {
  if (lockCount <= 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    detachScrollPreventers();
  }
}

/** 弹窗打开时在捕获阶段拦截滚动事件，不修改 overflow，避免滚动条消失导致页面晃动 */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    acquireScrollLock();
    return () => {
      releaseScrollLock();
    };
  }, [locked]);
}
