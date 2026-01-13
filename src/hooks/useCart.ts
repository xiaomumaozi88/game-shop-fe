import { useEffect, useState } from 'react';
import { cartStore } from '@/store/cartStore';
import { CartItem } from '@/types';

export const useCart = () => {
  const [items, setItems] = useState<CartItem[]>(cartStore.getItems());
  const [totalCount, setTotalCount] = useState(cartStore.getTotalCount());
  const [totalPrice, setTotalPrice] = useState(cartStore.getTotalPrice());

  useEffect(() => {
    const unsubscribe = cartStore.subscribe(() => {
      setItems(cartStore.getItems());
      setTotalCount(cartStore.getTotalCount());
      setTotalPrice(cartStore.getTotalPrice());
    });

    return unsubscribe;
  }, []);

  return {
    items,
    totalCount,
    totalPrice,
    addItem: cartStore.addItem.bind(cartStore),
    removeItem: cartStore.removeItem.bind(cartStore),
    updateQuantity: cartStore.updateQuantity.bind(cartStore),
    clear: cartStore.clear.bind(cartStore),
  };
};

