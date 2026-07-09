import React from 'react';
import { Product } from '@/types';
import { getGiftPackDetailBannerImage } from '@/utils/giftPackPurchaseLimitType';
import styles from './ProductModalGiftShowcase.module.less';

interface ProductModalGiftShowcaseProps {
  product: Product;
}

/** 礼包弹窗：仅展示与列表卡 giftBannerWrap 一致的横幅与小物图标 */
export const ProductModalGiftShowcase: React.FC<ProductModalGiftShowcaseProps> = ({ product }) => {
  const smallImages = product.small_images ?? [];
  const bannerImage = getGiftPackDetailBannerImage(product.purchase_limit_type);

  return (
    <div
      className={`${styles.bannerWrap} ${
        smallImages.length > 0 ? styles.bannerWrapHasItems : ''
      }`}
    >
      <div className={styles.banner}>
        <img src={bannerImage} alt={product.name} className={styles.bannerImage} />
      </div>

      {smallImages.length > 0 && (
        <ul className={styles.smallItems}>
          {smallImages.map((item, index) => (
            <li key={`${item.img_url}-${index}`} className={styles.smallItem}>
              <div className={styles.smallItemIcon} data-quality={item.quality.toLowerCase()}>
                <img src={item.img_url} alt="" className={styles.smallItemImage} />
              </div>
              <span className={styles.smallItemQty}>x{item.num}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
