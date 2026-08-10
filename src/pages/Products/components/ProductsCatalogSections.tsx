import React from 'react';
import { Product } from '@/types';
import { Loading } from '@/components/Loading';
import { GiftPackProductSections } from './GiftPackProductSections';
import purchaseTokenItemImg from '@/assets/img2/purchase-token-item.png';
import toukaCoinGuideArrowIcon from '@/assets/img2/touka-coin-guide-arrow.png';
import styles from '../Products.module.less';

export type ProductCategory = 'vouchers' | 'diamond' | 'giftPacks' | 'redeemCode';

export const getCategorySectionId = (categoryId: ProductCategory): string =>
  `products-category-${categoryId}`;

interface CategoryConfig {
  id: ProductCategory;
  label: string;
}

interface ProductsCatalogSectionsProps {
  visibleCategories: CategoryConfig[];
  productsByCategory: Record<ProductCategory, Product[]>;
  loading: boolean;
  t: (key: string) => string;
  renderProduct: (product: Product) => React.ReactNode;
  onToukaCoinGuideClick: () => void;
  renderRedeemCodeSection: () => React.ReactNode;
}

const SectionTitle: React.FC<{ categoryId: ProductCategory; label: string }> = ({
  categoryId,
  label,
}) => (
  <div className={styles.sectionTitle}>
    <div className={styles.sectionTitleBg} aria-hidden>
      <span className={styles.sectionTitleBgLeft} />
      <span className={styles.sectionTitleBgMiddle} />
      <span className={styles.sectionTitleBgRight} />
    </div>
    <span id={`${getCategorySectionId(categoryId)}-title`} className={styles.sectionTitleText}>
      {label}
    </span>
  </div>
);

const ToukaCoinGuideEntry: React.FC<{ label: string; onClick: () => void }> = ({
  label,
  onClick,
}) => (
  <button
    type="button"
    className={styles.toukaCoinGuideEntry}
    onClick={onClick}
  >
    <span className={styles.toukaCoinGuideEntryBgMiddle} aria-hidden />
    <span className={styles.toukaCoinGuideEntryContent}>
      <span className={styles.toukaCoinGuideEntryLabel}>
        <img src={purchaseTokenItemImg} alt="" className={styles.toukaCoinGuideEntryIcon} />
        <span className={styles.toukaCoinGuideEntryText}>{label}</span>
      </span>
      <img src={toukaCoinGuideArrowIcon} alt="" className={styles.toukaCoinGuideEntryArrow} />
    </span>
  </button>
);

export const ProductsCatalogSections: React.FC<ProductsCatalogSectionsProps> = ({
  visibleCategories,
  productsByCategory,
  loading,
  t,
  renderProduct,
  onToukaCoinGuideClick,
  renderRedeemCodeSection,
}) => {
  if (loading) {
    return (
      <div className={styles.tableLoading}>
        <Loading size="small" />
      </div>
    );
  }

  if (visibleCategories.length === 0) {
    return <div className={styles.tableLoading}>{t('common.noData')}</div>;
  }

  return (
    <div className={styles.productsCatalogAll}>
      {visibleCategories.map((category) => {
        const categoryProducts = productsByCategory[category.id] ?? [];
        const shouldShowSectionTitle = visibleCategories.length > 1;
        const sectionContent = category.id === 'redeemCode' ? (
          renderRedeemCodeSection()
        ) : (
          <>
            {category.id === 'vouchers' && (
              <p className={styles.toukaCoinBonusTip}>
                {t('products.toukaCoinBonusTip')}
              </p>
            )}
            {category.id === 'giftPacks' ? (
              <GiftPackProductSections
                products={categoryProducts}
                t={t}
                renderProduct={renderProduct}
              />
            ) : (
              <>
                <div
                  className={`${styles.productGrid}${
                    (category.id === 'vouchers' && categoryProducts.length < 3) ||
                    category.id === 'diamond'
                      ? ` ${styles.productGridFewItems}`
                      : ''
                  }`}
                >
                  {categoryProducts.map((product) => renderProduct(product))}
                </div>
                {category.id === 'vouchers' && (
                  <ToukaCoinGuideEntry
                    label={t('products.howToUseVouchers')}
                    onClick={onToukaCoinGuideClick}
                  />
                )}
              </>
            )}
          </>
        );

        return (
          <section
            key={category.id}
            id={getCategorySectionId(category.id)}
            className={styles.categorySection}
            data-category-section={category.id}
            {...(shouldShowSectionTitle
              ? { 'aria-labelledby': `${getCategorySectionId(category.id)}-title` }
              : { 'aria-label': category.label })}
          >
            {shouldShowSectionTitle && (
              <SectionTitle categoryId={category.id} label={category.label} />
            )}
            {sectionContent}
          </section>
        );
      })}
    </div>
  );
};
