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

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    navigateTo('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorBoundary}>
          <div className={styles.content}>
            <h1 className={styles.title}>出错了</h1>
            <p className={styles.message}>
              {this.state.error?.message || '发生了未知错误'}
            </p>
            <div className={styles.actions}>
              <Button variant="primary" onClick={this.handleReset}>
                返回首页
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

