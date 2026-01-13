import React, { useEffect, useState } from 'react';
import { messageStore } from '@/store/messageStore';
import styles from './Message.module.less';

export const Message: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimer: NodeJS.Timeout | null = null;
    let clearTimer: NodeJS.Timeout | null = null;

    const unsubscribe = messageStore.subscribe(() => {
      const currentMessage = messageStore.getMessage();
      if (currentMessage) {
        // 清除之前的定时器
        if (hideTimer) clearTimeout(hideTimer);
        if (clearTimer) clearTimeout(clearTimer);
        
        setMessage(currentMessage);
        setVisible(true);
        
        // 3秒后自动隐藏
        hideTimer = setTimeout(() => {
          setVisible(false);
          // 等待动画完成后清除消息
          clearTimer = setTimeout(() => {
            messageStore.clear();
            setMessage(null);
          }, 300); // 等待动画完成
        }, 3000);
      } else {
        // 如果消息被清除，立即隐藏
        setVisible(false);
        setTimeout(() => {
          setMessage(null);
        }, 300);
      }
    });

    // 初始化时检查是否有消息
    const currentMessage = messageStore.getMessage();
    if (currentMessage) {
      setMessage(currentMessage);
      setVisible(true);
      // 3秒后自动隐藏
      hideTimer = setTimeout(() => {
        setVisible(false);
        clearTimer = setTimeout(() => {
          messageStore.clear();
          setMessage(null);
        }, 300);
      }, 3000);
    }

    return () => {
      unsubscribe();
      if (hideTimer) clearTimeout(hideTimer);
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, []);

  if (!message) return null;

  return (
    <div className={`${styles.messageContainer} ${visible ? styles.visible : ''}`}>
      <div className={styles.message}>
        {message}
      </div>
    </div>
  );
};

