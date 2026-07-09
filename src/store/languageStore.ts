import { Locale, defaultLocale, selectableLocales } from '@/i18n';

// 直接定义storage，避免循环依赖
const storage = {
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
      // console.error('Storage set error:', error);
    }
  },
};

const LANGUAGE_STORAGE_KEY = 'game-shop-language';

class LanguageStore {
  private listeners: Set<() => void> = new Set();
  private currentLocale: Locale = this.loadLanguage();

  private loadLanguage(): Locale {
    const saved = storage.get<Locale>(LANGUAGE_STORAGE_KEY, null);
    if (saved && selectableLocales.includes(saved)) {
      return saved;
    }
    // 检测浏览器语言
    const browserLang = (navigator.language || (navigator as any).userLanguage || '').toLowerCase();
    const match = selectableLocales.find((loc) => browserLang.startsWith(loc.split('-')[0].toLowerCase()));
    return match || defaultLocale;
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getLocale(): Locale {
    return this.currentLocale;
  }

  setLocale(locale: Locale): void {
    this.currentLocale = locale;
    storage.set(LANGUAGE_STORAGE_KEY, locale);
    this.notify();
  }
}

export const languageStore = new LanguageStore();
