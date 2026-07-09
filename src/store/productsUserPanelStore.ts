class ProductsUserPanelStore {
  private listeners: Set<() => void> = new Set();
  private visible = true;

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  isVisible(): boolean {
    return this.visible;
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.notify();
  }

  show(): void {
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }
}

export const productsUserPanelStore = new ProductsUserPanelStore();
