import type { Product } from '@/types';
import giftLifetimeBg from '@/assets/img2/终身特惠-背景图.png';
import giftMonthBg from '@/assets/img2/month-bg.png';
import giftWeekBg from '@/assets/img2/week-bg.png';
import packDetailBlue from '@/assets/img2/pack-detail-blue.png';
import packDetailOrange from '@/assets/img2/pack-detail-orange.png';
import packDetailRed from '@/assets/img2/pack-detail-red.png';
import boxBlue from '@/assets/img2/box-blue.png';
import boxPink from '@/assets/img2/box-pink.png';
import boxOrange from '@/assets/img2/box-orange.png';
import giftBannerLifetime from '@/assets/img2/终身特惠- banner图.png';
import giftBannerMonth from '@/assets/img2/month-banner.png';
import giftBannerWeek from '@/assets/img2/week-banner.png';

export type GiftPackPurchaseLimitType = 1 | 2 | 3;

/** 礼包卡片背景：1 终身特惠 2 周特惠 3 月特惠 */
const GIFT_PACK_CARD_BG: Record<GiftPackPurchaseLimitType, string> = {
  1: giftLifetimeBg,
  2: giftWeekBg,
  3: giftMonthBg,
};

/** 礼包详情弹窗横幅：1 终身 2 周特惠 3 月特惠 */
const GIFT_PACK_DETAIL_BANNER: Record<GiftPackPurchaseLimitType, string> = {
  1: packDetailRed,
  2: packDetailBlue,
  3: packDetailOrange,
};

/** 订单页礼包示意：1 终身 2 周特惠 3 月特惠 */
const GIFT_PACK_ORDER_THUMBNAIL: Record<GiftPackPurchaseLimitType, string> = {
  1: boxPink,
  2: boxBlue,
  3: boxOrange,
};

/** 商品列表礼包横幅：1 终身 2 周特惠 3 月特惠 */
const GIFT_PACK_LIST_BANNER: Record<GiftPackPurchaseLimitType, string> = {
  1: giftBannerLifetime,
  2: giftBannerWeek,
  3: giftBannerMonth,
};

/** 展示顺序：终身特惠 → 月特惠 → 周特惠 */
export const GIFT_PACK_PURCHASE_LIMIT_TYPE_ORDER: GiftPackPurchaseLimitType[] = [1, 3, 2];

const GIFT_PACK_PURCHASE_LIMIT_TYPE_I18N_KEYS: Record<GiftPackPurchaseLimitType, string> = {
  1: 'products.giftPackLimitType.lifetime',
  2: 'products.giftPackLimitType.weekly',
  3: 'products.giftPackLimitType.monthly',
};

export function parseGiftPackPurchaseLimitType(value: unknown): GiftPackPurchaseLimitType | undefined {
  const num = Number(value);
  if (num === 1 || num === 2 || num === 3) {
    return num;
  }
  return undefined;
}

export function getGiftPackPurchaseLimitTypeLabel(
  type: GiftPackPurchaseLimitType | undefined,
  t: (key: string) => string
): string {
  if (!type) return '';
  const key = GIFT_PACK_PURCHASE_LIMIT_TYPE_I18N_KEYS[type];
  return t(key);
}

export function getGiftPackCardBackground(
  type: GiftPackPurchaseLimitType | undefined
): string {
  if (!type) return GIFT_PACK_CARD_BG[1];
  return GIFT_PACK_CARD_BG[type];
}

export function getGiftPackDetailBannerImage(
  type: GiftPackPurchaseLimitType | undefined
): string {
  if (!type) return GIFT_PACK_DETAIL_BANNER[1];
  return GIFT_PACK_DETAIL_BANNER[type];
}

export function getGiftPackOrderThumbnail(
  type: GiftPackPurchaseLimitType | undefined
): string {
  if (!type) return GIFT_PACK_ORDER_THUMBNAIL[1];
  return GIFT_PACK_ORDER_THUMBNAIL[type];
}

export function getGiftPackListBannerImage(
  type: GiftPackPurchaseLimitType | undefined
): string {
  if (!type) return GIFT_PACK_LIST_BANNER[1];
  return GIFT_PACK_LIST_BANNER[type];
}

export function groupGiftPackProductsByLimitType(products: Product[]): {
  type: GiftPackPurchaseLimitType;
  products: Product[];
}[] {
  const groups: { type: GiftPackPurchaseLimitType; products: Product[] }[] = [];

  for (const type of GIFT_PACK_PURCHASE_LIMIT_TYPE_ORDER) {
    const items = products.filter((product) => product.purchase_limit_type === type);
    if (items.length > 0) {
      groups.push({ type, products: items });
    }
  }

  return groups;
}
