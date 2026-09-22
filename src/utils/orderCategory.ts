import { parseGiftPackPurchaseLimitType } from './giftPackPurchaseLimitType';

export type OrderCategoryId = 'vouchers' | 'diamond' | 'giftPacks';

const POSITION_CATEGORY_MAP: Record<string, OrderCategoryId> = {
  coupon: 'vouchers',
  voucher: 'vouchers',
  luxury: 'diamond',
  diamond: 'diamond',
  gift: 'giftPacks',
  giftpack: 'giftPacks',
  giftpacks: 'giftPacks',
};

const normalizePosition = (position: string): string =>
  position.trim().toLowerCase().replace(/[\s_-]+/g, '');

export const resolveOrderCategoryId = (
  position?: string,
  purchaseLimitType?: unknown
): OrderCategoryId => {
  if (position) {
    const normalizedPosition = normalizePosition(position);
    const resolvedCategory = POSITION_CATEGORY_MAP[normalizedPosition];
    if (resolvedCategory) {
      return resolvedCategory;
    }
  }

  if (parseGiftPackPurchaseLimitType(purchaseLimitType)) {
    return 'giftPacks';
  }

  return 'vouchers';
};
