import type { Locale } from '@/i18n';

import zhCNMailImage from '@/assets/touka-coin-guide-screenshots/zh-CN/step-mail.jpg';
import zhCNStoreImage from '@/assets/touka-coin-guide-screenshots/zh-CN/step-store.jpg';
import zhTWMailImage from '@/assets/touka-coin-guide-screenshots/zh-TW/step-mail.jpg';
import zhTWStoreImage from '@/assets/touka-coin-guide-screenshots/zh-TW/step-store.jpg';
import enUSMailImage from '@/assets/touka-coin-guide-screenshots/en-US/step-mail.jpg';
import enUSStoreImage from '@/assets/touka-coin-guide-screenshots/en-US/step-store.jpg';
import jaJPMailImage from '@/assets/touka-coin-guide-screenshots/ja-JP/step-mail.jpg';
import jaJPStoreImage from '@/assets/touka-coin-guide-screenshots/ja-JP/step-store.jpg';
import koKRMailImage from '@/assets/touka-coin-guide-screenshots/ko-KR/step-mail.jpg';
import koKRStoreImage from '@/assets/touka-coin-guide-screenshots/ko-KR/step-store.jpg';
import ruRUMailImage from '@/assets/touka-coin-guide-screenshots/ru-RU/step-mail.jpg';
import ruRUStoreImage from '@/assets/touka-coin-guide-screenshots/ru-RU/step-store.jpg';
import viVNMailImage from '@/assets/touka-coin-guide-screenshots/vi-VN/step-mail.jpg';
import viVNStoreImage from '@/assets/touka-coin-guide-screenshots/vi-VN/step-store.jpg';
import deDEMailImage from '@/assets/touka-coin-guide-screenshots/de-DE/step-mail.jpg';
import deDEStoreImage from '@/assets/touka-coin-guide-screenshots/de-DE/step-store.jpg';
import ptPTMailImage from '@/assets/touka-coin-guide-screenshots/pt-PT/step-mail.jpg';
import ptPTStoreImage from '@/assets/touka-coin-guide-screenshots/pt-PT/step-store.jpg';
import esESMailImage from '@/assets/touka-coin-guide-screenshots/es-ES/step-mail.jpg';
import esESStoreImage from '@/assets/touka-coin-guide-screenshots/es-ES/step-store.jpg';
import frFRMailImage from '@/assets/touka-coin-guide-screenshots/fr-FR/step-mail.jpg';
import frFRStoreImage from '@/assets/touka-coin-guide-screenshots/fr-FR/step-store.jpg';

interface ToukaCoinGuideImages {
  mail: string;
  store: string;
}

const toukaCoinGuideImagesByLocale: Record<Locale, ToukaCoinGuideImages> = {
  'zh-CN': {
    mail: zhCNMailImage,
    store: zhCNStoreImage,
  },
  'zh-TW': {
    mail: zhTWMailImage,
    store: zhTWStoreImage,
  },
  'en-US': {
    mail: enUSMailImage,
    store: enUSStoreImage,
  },
  'ja-JP': {
    mail: jaJPMailImage,
    store: jaJPStoreImage,
  },
  'ko-KR': {
    mail: koKRMailImage,
    store: koKRStoreImage,
  },
  'ru-RU': {
    mail: ruRUMailImage,
    store: ruRUStoreImage,
  },
  'vi-VN': {
    mail: viVNMailImage,
    store: viVNStoreImage,
  },
  'de-DE': {
    mail: deDEMailImage,
    store: deDEStoreImage,
  },
  'pt-PT': {
    mail: ptPTMailImage,
    store: ptPTStoreImage,
  },
  'es-ES': {
    mail: esESMailImage,
    store: esESStoreImage,
  },
  'fr-FR': {
    mail: frFRMailImage,
    store: frFRStoreImage,
  },
};

export function getToukaCoinGuideImages(locale: Locale): ToukaCoinGuideImages {
  return toukaCoinGuideImagesByLocale[locale] ?? toukaCoinGuideImagesByLocale['en-US'];
}
