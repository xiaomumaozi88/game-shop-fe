// URL参数解析
export const parseURLParams = (): Record<string, string> => {
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

// 格式化价格
export const formatPrice = (price: number, currency: string = '金币'): string => {
  return `${price.toLocaleString()} ${currency}`;
};

// 防抖函数
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// 节流函数
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let lastTime = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastTime >= wait) {
      lastTime = now;
      func(...args);
    }
  };
};

// 本地存储
export const storage = {
  get: <T>(key: string, defaultValue?: T): T | null => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue ?? null;
    } catch {
      return defaultValue ?? null;
    }
  },
  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  },
  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  },
};

// 图片懒加载
export const lazyLoadImage = (img: HTMLImageElement, src: string): void => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          img.src = src;
          observer.unobserve(img);
        }
      });
    },
    { rootMargin: '50px' }
  );
  observer.observe(img);
};

// 检查是否为移动设备
export const isMobile = (): boolean => {
  return window.innerWidth < 768;
};

// 检查是否为平板设备
export const isTablet = (): boolean => {
  return window.innerWidth >= 768 && window.innerWidth < 1024;
};

// 检查是否为桌面设备
export const isDesktop = (): boolean => {
  return window.innerWidth >= 1024;
};

// 检测是否为 Firefox 浏览器
export const isFirefox = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  // 检测 userAgent 中是否包含 Firefox
  return /firefox/i.test(navigator.userAgent) || /mozilla/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent) && !/safari/i.test(navigator.userAgent);
};

/**
 * 兼容的页面跳转函数
 * Firefox 浏览器使用 window.location.assign()，其他浏览器使用 window.location.href
 * @param url 要跳转的 URL
 */
export const navigateTo = (url: string): void => {
  try {
    if (isFirefox()) {
      // Firefox 浏览器使用 assign 方法
      window.location.assign(url);
    } else {
      // 其他浏览器使用 href 赋值
      window.location.href = url;
    }
  } catch (error) {
    console.error('页面跳转失败:', error);
    // 如果以上方法都失败，尝试使用 replace
    try {
      window.location.replace(url);
    } catch (e) {
      console.error('页面跳转替换失败:', e);
    }
  }
};

// 导出API和常量
export * from './api';
export * from './constants';
export * from './thinkingData';
export * from './analytics';

/**
 * 将秒数转换为剩余时间格式
 * @param seconds 剩余秒数
 * @returns 格式化的剩余时间字符串，如 "1W2D"（大于一周）、"2D2H"（小于一周）
 */
export const formatCountdown = (seconds: number): string => {
  if (seconds <= 0) {
    return '0D';
  }

  const weeks = Math.floor(seconds / 604800); // 7 * 24 * 60 * 60
  const days = Math.floor((seconds % 604800) / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);

  const parts: string[] = [];

  // 如果大于一周，显示周和天
  if (weeks > 0) {
    parts.push(`${weeks}W`);
    if (days > 0) {
      parts.push(`${days}D`);
    }
  } else {
    // 小于一周，显示天和小时
    if (days > 0) {
      parts.push(`${days}D`);
    }
    if (hours > 0) {
      parts.push(`${hours}H`);
    }
  }

  return parts.length > 0 ? parts.join('') : '0D';
};

