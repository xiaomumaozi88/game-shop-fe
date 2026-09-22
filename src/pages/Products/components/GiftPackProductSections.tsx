import React from 'react';
import { Product } from '@/types';
import {
  getGiftPackPurchaseLimitTypeLabel,
  groupGiftPackProductsByLimitType,
} from '@/utils/giftPackPurchaseLimitType';
import titleSectionItemImg from '@/assets/img2/title-section-item.png';
import styles from '../Products.module.less';

interface GiftPackProductSectionsProps {
  products: Product[];
  renderProduct: (product: Product) => React.ReactNode;
  t: (key: string) => string;
}

export const GiftPackProductSections: React.FC<GiftPackProductSectionsProps> = ({
  products,
  renderProduct,
  t,
}) => {
  const groups = groupGiftPackProductsByLimitType(products);
  const groupedIds = new Set(groups.flatMap(group => group.products.map(product => product.id)));
  const ungroupedProducts = products.filter(product => !groupedIds.has(product.id));

  return (
    <div className={styles.giftPackSections}>
      {groups.map(group => (
        <section key={group.type} className={styles.giftPackSection}>
          <div className={styles.giftPackSectionHeading}>
            <img
              src={titleSectionItemImg}
              alt=""
              className={styles.giftPackSectionLineImage}
              aria-hidden
            />
            <h3 className={styles.giftPackSectionTitle}>
              {getGiftPackPurchaseLimitTypeLabel(group.type, t)}
            </h3>
            <img
              src={titleSectionItemImg}
              alt=""
              className={`${styles.giftPackSectionLineImage} ${styles.giftPackSectionLineImageRight}`}
              aria-hidden
            />
          </div>
          <div className={`${styles.productGrid} ${styles.productGridGift}`}>
            {group.products.map(product => renderProduct(product))}
          </div>
        </section>
      ))}

      {ungroupedProducts.length > 0 && (
        <section className={styles.giftPackSection}>
          <div className={`${styles.productGrid} ${styles.productGridGift}`}>
            {ungroupedProducts.map(product => renderProduct(product))}
          </div>
        </section>
      )}
    </div>
  );
};
