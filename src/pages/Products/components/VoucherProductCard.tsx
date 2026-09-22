import React from 'react';
import { Product } from '@/types';
import { getVoucherBonusGemCount } from '@/utils/voucherGem';
import voucherCardBg from '@/assets/img2/daijinquan-bg.png';
import purchaseTokenItemImg from '@/assets/img2/purchase-token-item.png';
import { ProductCountdown } from './ProductCountdown';
import styles from '../Products.module.less';

interface VoucherProductCardProps {
  cardRef: React.RefObject<HTMLDivElement | null>;
  product: Product;
  isGray: boolean;
  onProductClick: (product: Product) => void;
  t: (key: string) => string;
  formatCountdown: (seconds: number) => string;
  formatPrice: (price: number, currency: string) => string;
}

export const VoucherProductCard: React.FC<VoucherProductCardProps> = ({
  cardRef,
  product,
  isGray,
  onProductClick,
  t,
  formatCountdown,
  formatPrice,
}) => {
  const gemCount = product.gem_count ?? 0;
  const valueRatio = product.value_ratio ?? 0;
  const bonusGemCount = getVoucherBonusGemCount(gemCount, valueRatio);
  const showBonusBadge = valueRatio > 0;
  const showGemTitleRow = gemCount > 0;
  const voucherTitleLabel =
    bonusGemCount > 0
      ? `${gemCount}+${bonusGemCount}`
      : showGemTitleRow
        ? String(gemCount)
        : product.description;

  return (
    <div
      ref={cardRef}
      className={`${styles.productCard} ${styles.productCardVoucher} ${
        isGray ? styles.productCardUnavailable : ''
      }`}
      style={{ backgroundImage: `url(${voucherCardBg})` }}
      onClick={() => onProductClick(product)}
    >
      {showBonusBadge && (
        <div className={styles.voucherBonusBadge} aria-hidden>
          <span className={styles.voucherBonusBadgeText}>{valueRatio}%+</span>
        </div>
      )}

      <img
        src={product.image}
        alt={product.name}
        className={styles.productImageMain}
        loading="lazy"
        decoding="async"
      />

      {product.expire_time_left !== undefined && product.expire_time_left > 0 && (
        <ProductCountdown
          text={`${t('products.remainingShort')}:${formatCountdown(product.expire_time_left)}`}
        />
      )}

      <div className={styles.productInfo}>
        <div className={styles.productDescriptionWrapper}>
          {showGemTitleRow ? (
            <div className={styles.voucherTitleRow} aria-label={voucherTitleLabel}>
              <img src={purchaseTokenItemImg} alt="" className={styles.voucherTitleGemIcon} />
              <span className={styles.voucherTitleGemText}>{gemCount}</span>
              {bonusGemCount > 0 && (
                <>
                  <span className={styles.voucherTitleGemPlus}>+</span>
                  <img src={purchaseTokenItemImg} alt="" className={styles.voucherTitleGemIcon} />
                  <span className={styles.voucherTitleGemText}>{bonusGemCount}</span>
                </>
              )}
            </div>
          ) : (
            <p className={styles.productDescription}>{product.description}</p>
          )}
        </div>
      </div>

      <button type="button" className={styles.productPriceButton}>
        {formatPrice(product.price, product.currency)}
      </button>
    </div>
  );
};
