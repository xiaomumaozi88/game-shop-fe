import { CartItem, Product } from '@/types';
import { storage, STORAGE_KEYS } from '@/utils';

const CART_STORAGE_KEY = STORAGE_KEYS.CART;

interface CartState {
  items: CartItem[];
}

class CartStore {
  private listeners: Set<() => void> = new Set();
  private state: CartState = {
    items: this.loadCart(),
  };

  private loadCart(): CartItem[] {
    return storage.get<CartItem[]>(CART_STORAGE_KEY, []);
  }

  private saveCart(): void {
    storage.set(CART_STORAGE_KEY, this.state.items);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): CartState {
    return this.state;
  }

  getItems(): CartItem[] {
    return this.state.items;
  }

  getTotalCount(): number {
    return this.state.items.reduce((total, item) => total + item.quantity, 0);
  }

  getTotalPrice(): number {
    return this.state.items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    );
  }

  addItem(product: Product, quantity: number = 1): void {
    const existingItem = this.state.items.find(
      (item) => item.product.id === product.id
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      this.state.items.push({ product, quantity });
    }

    this.saveCart();
    this.notify();
  }

  removeItem(productId: string): void {
    this.state.items = this.state.items.filter(
      (item) => item.product.id !== productId
    );
    this.saveCart();
    this.notify();
  }

  updateQuantity(productId: string, quantity: number): void {
    const item = this.state.items.find((item) => item.product.id === productId);
    if (item) {
      if (quantity <= 0) {
        this.removeItem(productId);
      } else {
        item.quantity = quantity;
        this.saveCart();
        this.notify();
      }
    }
  }

  clear(): void {
    this.state.items = [];
    this.saveCart();
    this.notify();
  }
}

export const cartStore = new CartStore();

