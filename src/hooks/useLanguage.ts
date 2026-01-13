import { useEffect, useState } from 'react';
import { languageStore } from '@/store/languageStore';
import { Locale, getTranslation } from '@/i18n';

export const useLanguage = () => {
  const [locale, setLocale] = useState<Locale>(languageStore.getLocale());

  useEffect(() => {
    const unsubscribe = languageStore.subscribe(() => {
      setLocale(languageStore.getLocale());
    });

    return unsubscribe;
  }, []);

  const t = (key: string): string => {
    return getTranslation(locale, key);
  };

  const setLanguage = (newLocale: Locale) => {
    languageStore.setLocale(newLocale);
  };

  return {
    locale,
    t,
    setLanguage,
  };
};

