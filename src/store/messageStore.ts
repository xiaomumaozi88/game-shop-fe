class MessageStore {
  private listeners: Set<() => void> = new Set();
  private currentMessage: string | null = null;

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getMessage(): string | null {
    return this.currentMessage;
  }

  show(message: string): void {
    this.currentMessage = message;
    this.notify();
  }

  clear(): void {
    this.currentMessage = null;
    this.notify();
  }
}

export const messageStore = new MessageStore();

