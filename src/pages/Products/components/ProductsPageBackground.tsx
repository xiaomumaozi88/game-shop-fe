import React, { useEffect } from 'react';
import productListBgItem from '@/assets/img2/product-list-bg-item.png';
import productListBannerTop from '@/assets/img2/banner.png';
import styles from './ProductsPageBackground.module.less';

/** 水平平铺单元宽 */
const WATERMARK_TILE_WIDTH = 300;
/** 单行高度（垂直行距） */
const WATERMARK_ROW_HEIGHT = 175;
/** 两行一循环，奇数行居中、偶数行半格错位 */
const WATERMARK_PATTERN_HEIGHT = WATERMARK_ROW_HEIGHT * 2;
const WATERMARK_ICON_WIDTH = 156;
const WATERMARK_ICON_HEIGHT = Math.round(
  (WATERMARK_ICON_WIDTH * 179) / 195
);
const WATERMARK_ICON_X = (WATERMARK_TILE_WIDTH - WATERMARK_ICON_WIDTH) / 2;
const WATERMARK_ROW_HALF_OFFSET = WATERMARK_TILE_WIDTH / 2;
const WATERMARK_ODD_ROW_Y = (WATERMARK_ROW_HEIGHT - WATERMARK_ICON_HEIGHT) / 2;
const WATERMARK_EVEN_ROW_Y = WATERMARK_ROW_HEIGHT + WATERMARK_ODD_ROW_Y;

const watermarkImageProps = {
  href: productListBgItem,
  width: WATERMARK_ICON_WIDTH,
  height: WATERMARK_ICON_HEIGHT,
  preserveAspectRatio: 'xMidYMid meet' as const,
};

const preloadProductBackgroundImages = () => {
  if (typeof document === 'undefined') return;

  const imageHints = [
    {
      href: productListBannerTop,
    },
  ];

  const existingPreloads = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]'),
  );

  imageHints.forEach(({ href }) => {
    const absoluteHref = new URL(href, document.baseURI).href;
    const alreadyExists = existingPreloads.some((link) => link.href === absoluteHref);
    if (alreadyExists) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    link.setAttribute('fetchpriority', 'high');
    document.head.appendChild(link);
    existingPreloads.push(link);
  });
};

/** 商品列表页全屏背景：顶部等比铺满宽度，底部 5% 区域水平拉伸 */
export const ProductsPageBackground: React.FC = () => {
  useEffect(() => {
    preloadProductBackgroundImages();
  }, []);

  return (
    <div className={styles.productsPageBg} aria-hidden>
      <div className={styles.productsPageBgTop}>
        <div className={styles.productsPageBgTopMain} />
      </div>
      <div className={styles.productsPageBgBottom}>
        <svg
          className={styles.productsPageBgBottomPattern}
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <pattern
              id="products-list-bg-pattern"
              width={WATERMARK_TILE_WIDTH}
              height={WATERMARK_PATTERN_HEIGHT}
              patternUnits="userSpaceOnUse"
            >
              {/* 奇数行：列居中 */}
              <image
                {...watermarkImageProps}
                x={WATERMARK_ICON_X}
                y={WATERMARK_ODD_ROW_Y}
              />
              {/* 偶数行：半格右移 + 左侧补图保证无缝 */}
              <image
                {...watermarkImageProps}
                x={WATERMARK_ICON_X + WATERMARK_ROW_HALF_OFFSET}
                y={WATERMARK_EVEN_ROW_Y}
              />
              <image
                {...watermarkImageProps}
                x={WATERMARK_ICON_X - WATERMARK_ROW_HALF_OFFSET}
                y={WATERMARK_EVEN_ROW_Y}
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#products-list-bg-pattern)" />
        </svg>
      </div>
    </div>
  );
};
