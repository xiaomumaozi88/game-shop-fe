import React from 'react';
import { Product } from '@/types';
import {
  getGiftPackPurchaseLimitTypeLabel,
  groupGiftPackProductsByLimitType,
} from '@/utils/giftPackPurchaseLimitType';
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
  const groupedIds = new Set(groups.flatMap((group) => group.products.map((product) => product.id)));
  const ungroupedProducts = products.filter((product) => !groupedIds.has(product.id));

  return (
    <div className={styles.giftPackSections}>
      {groups.map((group) => (
        <section key={group.type} className={styles.giftPackSection}>
          <div className={styles.giftPackSectionHeading}>
            <span className={styles.giftPackSectionLine} aria-hidden />
            <h3 className={styles.giftPackSectionTitle}>
              {getGiftPackPurchaseLimitTypeLabel(group.type, t)}
            </h3>
            <span className={styles.giftPackSectionLine} aria-hidden />
          </div>
          <div className={`${styles.productGrid} ${styles.productGridGift}`}>
            {group.products.map((product) => renderProduct(product))}
          </div>
        </section>
      ))}

      {ungroupedProducts.length > 0 && (
        <section className={styles.giftPackSection}>
          <div className={`${styles.productGrid} ${styles.productGridGift}`}>
            {ungroupedProducts.map((product) => renderProduct(product))}
          </div>
        </section>
      )}
    </div>
  );
};
