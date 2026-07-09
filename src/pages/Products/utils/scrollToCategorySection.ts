import type { ProductCategory } from '../components/ProductsCatalogSections';
import { getCategorySectionId } from '../components/ProductsCatalogSections';

const SCROLL_SPY_PAUSE_MS = 550;

let scrollSpyPaused = false;
let scrollSpyPauseTimer: ReturnType<typeof setTimeout> | null = null;

export const isCategoryScrollSpyPaused = (): boolean => scrollSpyPaused;

export const scrollToCategorySection = (categoryId: ProductCategory): boolean => {
  const section = document.getElementById(getCategorySectionId(categoryId));
  if (!section) return false;

  scrollSpyPaused = true;
  if (scrollSpyPauseTimer) clearTimeout(scrollSpyPauseTimer);

  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  scrollSpyPauseTimer = setTimeout(() => {
    scrollSpyPaused = false;
    scrollSpyPauseTimer = null;
  }, SCROLL_SPY_PAUSE_MS);

  return true;
};
