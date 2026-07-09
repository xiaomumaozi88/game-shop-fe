/** 根据 gem_count 与 value_ratio（百分比）计算赠送数量 */
export function getVoucherBonusGemCount(gemCount: number, valueRatio: number): number {
  if (gemCount <= 0 || valueRatio <= 0) return 0;
  return Math.round((gemCount * valueRatio) / 100);
}
