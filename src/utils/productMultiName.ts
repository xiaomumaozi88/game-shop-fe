/**
 * 将界面 locale 解析为 multi_name JSON 中可能使用的键候选（仅与「当前语言」相关，不含跨语言兜底）。
 */
function resolveLanguageCode(locale: string): string {
  const langMap: Record<string, string> = {
    'zh-CN': 'zh',
    'zh-TW': 'zh',
    'en-US': 'en',
    'ja-JP': 'ja',
    'ko-KR': 'ko',
    'ru-RU': 'ru',
    'vi-VN': 'vi',
    'de-DE': 'de',
    'pt-PT': 'pt',
    'es-ES': 'es',
    'fr-FR': 'fr',
  };
  return langMap[locale] || locale.split('-')[0] || 'en';
}

function dedupeLowerKeys(keys: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    const x = k.toLowerCase();
    if (x && !seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

function multiNameLookupKeysForLocale(locale: string): string[] {
  const localeLower = locale.toLowerCase();

  const langKeyMap: Record<string, string[]> = {
    'zh-cn': ['cn', 'zh'],
    'zh-tw': ['zh', 'cn'],
    zh: ['zh', 'cn'],
    de: ['de'],
    es: ['es'],
    fr: ['fr'],
    ja: ['ja'],
    ko: ['ko'],
    pt: ['pt'],
    vi: ['vi'],
    ru: ['ru'],
  };

  if (langKeyMap[localeLower]) {
    return langKeyMap[localeLower];
  }

  const langCode = resolveLanguageCode(locale).toLowerCase();
  if (langKeyMap[langCode]) {
    return langKeyMap[langCode];
  }

  return dedupeLowerKeys([langCode, localeLower.split('-')[0], localeLower]);
}

/** 订单/支付回调等接口：英文默认名在 `product_name`，部分旧接口为 `name` */
export function resolveOrderProductFallbackName(order: {
  product_name?: string;
  name?: string;
}): string {
  const raw = order.product_name ?? order.name ?? '';
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * 从后端 `multi_name` JSON 中取当前界面语言对应的商品名。
 * 未命中与当前语言相关的任何键时，仅使用 `fallbackName`（接口外层的 `product_name` / `name`），
 * 不会回退到其它语言条目或 JSON 中的第一个键。
 */
export function parseProductMultiName(
  multiNameStr: string | undefined,
  locale: string,
  fallbackName: string,
): string {
  if (!multiNameStr?.trim()) {
    return fallbackName;
  }

  const localeLower = locale.toLowerCase();
  const langCode = resolveLanguageCode(locale).toLowerCase();

  // 英文界面：约定仅用外层 name
  if (langCode === 'en' || localeLower.startsWith('en')) {
    return fallbackName;
  }

  try {
    const multiNameRaw = JSON.parse(multiNameStr) as Record<string, string>;
    if (!multiNameRaw || typeof multiNameRaw !== 'object') {
      return fallbackName;
    }

    const multiName: Record<string, string> = {};
    Object.keys(multiNameRaw).forEach((k) => {
      multiName[k.toLowerCase()] = multiNameRaw[k];
    });

    const candidates = multiNameLookupKeysForLocale(locale);
    const hit = candidates.find((code) => {
      const v = multiName[code];
      return typeof v === 'string' && v.trim().length > 0;
    });
    return hit ? multiName[hit] : fallbackName;
  } catch {
    return fallbackName;
  }
}
