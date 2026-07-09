import React from 'react';
import { Product } from '@/types';
import {
  getGiftPackCardBackground,
  getGiftPackListBannerImage,
} from '@/utils/giftPackPurchaseLimitType';
import { isProductPurchaseDisabled } from '@/utils/productPurchaseLimit';
import { ProductCountdown } from './ProductCountdown';
import { ProductValueBadge } from './ProductValueBadge';
import styles from '../Products.module.less';

interface GiftPackProductCardProps {
  cardRef: React.RefObject<HTMLDivElement | null>;
  product: Product;
  onProductClick: (product: Product) => void;
  t: (key: string) => string;
  formatCountdown: (seconds: number) => string;
  formatPrice: (price: number, currency: string) => string;
}

export const GiftPackProductCard: React.FC<GiftPackProductCardProps> = ({
  cardRef,
  product,
  onProductClick,
  t,
  formatCountdown,
  formatPrice,
}) => {
  const showValueBadge = (product.value_ratio ?? 0) > 0;
  const smallImages = product.small_images ?? [];
  const isGray = isProductPurchaseDisabled(product);
  const giftCardBg = getGiftPackCardBackground(product.purchase_limit_type);
  const giftBannerImage = getGiftPackListBannerImage(product.purchase_limit_type);
  const showPurchaseLimit = (product.purchase_limit ?? 0) > 0;

  return (
    <div
      ref={cardRef}
      className={`${styles.productCard} ${styles.productCardGift} ${
        isGray ? styles.productCardUnavailable : ''
      }`}
      style={{ backgroundImage: `url(${giftCardBg})` }}
      onClick={() => onProductClick(product)}
    >
      {showValueBadge && (
        <ProductValueBadge
          valueRatio={product.value_ratio!}
          superValueLabel={t('products.superValue')}
        />
      )}

      <div
        className={`${styles.giftBannerWrap} ${
          smallImages.length > 0 ? styles.giftBannerWrapHasItems : ''
        }`}
      >
        <div className={styles.giftBanner}>
          <img
            src={giftBannerImage}
            alt={product.name}
            className={styles.giftBannerImage}
            loading="lazy"
            decoding="async"
          />
        </div>

        {smallImages.length > 0 && (
          <ul className={styles.giftSmallItems}>
            {smallImages.map((item, index) => (
              <li key={`${item.img_url}-${index}`} className={styles.giftSmallItem}>
                <div
                  className={styles.giftSmallItemIcon}
                  data-quality={item.quality.toLowerCase()}
                >
                  <img
                    src={item.img_url}
                    alt=""
                    className={styles.giftSmallItemImage}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <span className={styles.giftSmallItemQty}>x{item.num}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {product.expire_time_left !== undefined && product.expire_time_left > 0 && (
        <ProductCountdown
          text={`${t('products.remainingShort')}:${formatCountdown(product.expire_time_left)}`}
        />
      )}

      <div className={styles.giftTitleWrap}>
        {product.name ? <p className={styles.giftTitle}>{product.name}</p> : null}
        {showPurchaseLimit && (
          <p className={styles.giftLimitInfo}>
            {`${t('products.limitShort')} ${product.purchase_used ?? 0}/${product.purchase_limit}`}
          </p>
        )}
      </div>

      <button type="button" className={styles.giftPriceButton}>
        {formatPrice(product.price, product.currency)}
      </button>
    </div>
  );
};
