import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '../Button';
import { navigateTo } from '@/utils';
import styles from './ErrorBoundary.module.less';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

const CHUNK_RELOAD_STORAGE_KEY = 'game-shop-chunk-load-retried-at';
const CHUNK_RELOAD_GUARD_MS = 60 * 1000;

const isChunkLoadError = (error?: Error): boolean => {
  const message = error?.message || '';
  const name = error?.name || '';

  return (
    name === 'ChunkLoadError' ||
    /Loading (CSS )?chunk \d+ failed/i.test(message) ||
    /ChunkLoadError/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
};

const canAutoReloadForChunkError = (): boolean => {
  try {
    const lastReloadAt = Number(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) || '0');
    const now = Date.now();
    if (now - lastReloadAt < CHUNK_RELOAD_GUARD_MS) {
      return false;
    }
    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
    return true;
  } catch {
    return false;
  }
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // console.error('Error caught by boundary:', error, errorInfo);
    if (isChunkLoadError(error) && canAutoReloadForChunkError()) {
      window.location.reload();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    navigateTo('/');
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const chunkLoadError = isChunkLoadError(this.state.error);

      return (
        <div className={styles.errorBoundary}>
          <div className={styles.content}>
            <h1 className={styles.title}>{chunkLoadError ? '页面资源已更新' : '出错了'}</h1>
            <p className={styles.message}>
              {chunkLoadError ? '页面资源加载失败，请刷新页面重试。' : '发生了未知错误，请稍后重试。'}
            </p>
            <div className={styles.actions}>
              <Button variant="primary" onClick={chunkLoadError ? this.handleReload : this.handleReset}>
                {chunkLoadError ? '刷新页面' : '返回首页'}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
