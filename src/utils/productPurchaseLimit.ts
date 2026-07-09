import { Product } from '@/types';

export function getProductRemainingPurchaseLimit(product: Product): number | null {
  const purchaseLimit = product.purchase_limit ?? 0;
  if (purchaseLimit <= 0) return null;

  const purchaseUsed = product.purchase_used ?? 0;
  return Math.max(purchaseLimit - purchaseUsed, 0);
}

/** 商品是否不可购买（置灰）：接口 is_gray 或已达限购次数 */
export function isProductPurchaseDisabled(product: Product): boolean {
  if (product.is_gray === 1) return true;
  if (product.stock === 0) return true;

  const remainingPurchaseLimit = getProductRemainingPurchaseLimit(product);
  return remainingPurchaseLimit !== null && remainingPurchaseLimit <= 0;
}

/** 当前可购买的最大数量（含限购与库存） */
export function getProductMaxPurchasableQuantity(product: Product): number {
  if (isProductPurchaseDisabled(product)) return 0;

  const stockLimit = product.stock ?? 999;
  const remainingPurchaseLimit = getProductRemainingPurchaseLimit(product);

  return Math.min(stockLimit, remainingPurchaseLimit ?? stockLimit);
}

export function isProductQuantityOverPurchaseLimit(product: Product, quantity: number): boolean {
  const remainingPurchaseLimit = getProductRemainingPurchaseLimit(product);
  return remainingPurchaseLimit !== null && quantity > remainingPurchaseLimit;
}
