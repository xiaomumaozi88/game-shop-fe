import { generatedTranslations, GeneratedLocale } from './locales';

export type Locale = GeneratedLocale;
export type Translations = (typeof generatedTranslations)[Locale];
export const translations: Record<Locale, Translations> = generatedTranslations;

// 默认语言
export const defaultLocale: Locale = 'zh-CN';

// 获取翻译文本
export const getTranslation = (locale: Locale, key: string): string => {
  const keys = key.split('.');
  let value: any = translations[locale];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // 如果找不到，回退到默认语言
      value = translations[defaultLocale];
      for (const k2 of keys) {
        if (value && typeof value === 'object' && k2 in value) {
          value = value[k2];
        } else {
          return key; // 如果还是找不到，返回key本身
        }
      }
      break;
    }
  }

  return typeof value === 'string' ? value : key;
};

