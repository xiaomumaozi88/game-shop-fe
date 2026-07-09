import { useEffect, useState } from 'react';
import { productsUserPanelStore } from '@/store/productsUserPanelStore';

export function useProductsUserPanelVisibility(): boolean {
  const [visible, setVisible] = useState(() => productsUserPanelStore.isVisible());

  useEffect(() => {
    const unsubscribe = productsUserPanelStore.subscribe(() => {
      setVisible(productsUserPanelStore.isVisible());
    });

    return unsubscribe;
  }, []);

  return visible;
}
