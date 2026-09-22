import React, { useRef } from 'react';
import { useFitText } from '@/hooks/useFitText';
import { useResponsive } from '@/hooks/useResponsive';
import { Product } from '@/types';
import {
  getGiftPackCardBackground,
  getGiftPackListBannerImage,
} from '@/utils/giftPackPurchaseLimitType';
import { isProductPurchaseDisabled } from '@/utils/productPurchaseLimit';
import { ProductCountdown } from './ProductCountdown';
import { ProductValueBadge } from './ProductValueBadge';
import styles from '../Products.module.less';

const GIFT_TITLE_MIN_FONT_SIZE: Record<'mobile' | 'tablet' | 'desktop', number> = {
  mobile: 16,
  tablet: 18,
  desktop: 20,
};

const GIFT_TITLE_MAX_FONT_SIZE: Record<'mobile' | 'tablet' | 'desktop', number> = {
  mobile: 40,
  tablet: 56,
  desktop: 72,
};

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
  const featuredTitleRef = useRef<HTMLSpanElement>(null);
  const { breakpoint } = useResponsive();
  const showValueBadge = (product.value_ratio ?? 0) > 0;
  const isGray = isProductPurchaseDisabled(product);
  const giftCardBg = getGiftPackCardBackground(product.purchase_limit_type);
  const giftBannerImage = getGiftPackListBannerImage(product.purchase_limit_type);
  const showPurchaseLimit = (product.purchase_limit ?? 0) > 0;
  const isFeaturedGiftPack = product.purchase_limit_type === 1;
  const isWeeklyGiftPack = product.purchase_limit_type === 2;
  const giftFeaturedTitleText = product.name ?? t('products.giftPackLimitType.lifetime');

  useFitText(featuredTitleRef, giftFeaturedTitleText, {
    minFontSize: GIFT_TITLE_MIN_FONT_SIZE[breakpoint],
    maxFontSize: GIFT_TITLE_MAX_FONT_SIZE[breakpoint],
    step: 0.25,
    fitHeight: true,
    allowWrapAtMin: true,
    wrapClassName: styles.giftFeaturedTitleWrapText,
  });

  const smallImages = (product.small_images ?? []).slice(0, isFeaturedGiftPack ? 2 : 3);
  const smallItemsNode =
    smallImages.length > 0 ? (
      <ul className={styles.giftSmallItems} data-item-count={smallImages.length}>
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
    ) : null;
  const purchaseLimitNode = showPurchaseLimit ? (
    <p
      className={`${styles.giftLimitInfo} ${
        isWeeklyGiftPack ? styles.giftLimitInfoWeekly : ''
      }`}
    >
      {`${t('products.limitShort')} ${product.purchase_used ?? 0}/${product.purchase_limit}`}
    </p>
  ) : null;
  const priceButtonNode = (
    <button type="button" className={styles.giftPriceButton}>
      {formatPrice(product.price, product.currency)}
    </button>
  );

  return (
    <div
      ref={cardRef}
      className={`${styles.productCard} ${styles.productCardGift} ${
        isFeaturedGiftPack ? styles.productCardGiftFeatured : ''
      } ${
        isGray ? styles.productCardUnavailable : ''
      }`}
      style={{ backgroundImage: `url(${giftCardBg})` }}
      onClick={() => onProductClick(product)}
    >
      {showValueBadge && !isFeaturedGiftPack && (
        <ProductValueBadge
          valueRatio={product.value_ratio!}
          superValueLabel={t('products.superValue')}
        />
      )}

      <div className={styles.giftBannerWrap}>
        <div className={styles.giftBanner}>
          <img
            src={giftBannerImage}
            alt={product.name}
            className={styles.giftBannerImage}
            loading="lazy"
            decoding="async"
          />

          {isFeaturedGiftPack && (
            <div className={styles.giftFeaturedTitleRow}>
              <div className={styles.giftFeaturedTitleWrap}>
                <span ref={featuredTitleRef} className={styles.giftFeaturedTitle}>
                  {giftFeaturedTitleText}
                </span>
              </div>
              {showValueBadge && (
                <ProductValueBadge
                  valueRatio={product.value_ratio!}
                  superValueLabel={t('products.superValue')}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {product.name ? (
        <p className={styles.giftTitle}>
          <span className={styles.giftTitleText}>
            {product.name}
          </span>
        </p>
      ) : null}

      {isFeaturedGiftPack ? (
        <div className={styles.giftFeaturedMetaRow}>
          {smallItemsNode}
          <div className={styles.giftFeaturedActions}>
            <div className={styles.giftTitleWrap}>{purchaseLimitNode}</div>
            {priceButtonNode}
          </div>
        </div>
      ) : (
        <>
          {smallItemsNode}
          <div className={styles.giftTitleWrap}>{purchaseLimitNode}</div>
          {priceButtonNode}
        </>
      )}

      {product.expire_time_left !== undefined && product.expire_time_left > 0 && (
        <ProductCountdown
          text={`${t('products.remainingShort')}:${formatCountdown(product.expire_time_left)}`}
        />
      )}
    </div>
  );
};
