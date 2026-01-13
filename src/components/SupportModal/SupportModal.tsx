import React, { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import styles from './SupportModal.module.less';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const email = 'support@toukagame.com';

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      // 降级方案：使用传统方法
      const textArea = document.createElement('textarea');
      textArea.value = email;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch (err) {
        console.error('复制失败', err);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{t('support.title')}</h2>
        <p className={styles.description}>{t('support.description')}</p>
        <div className={styles.email}>{email}</div>
        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose}>
            {t('support.cancel')}
          </button>
          <button className={styles.copyButton} onClick={handleCopy}>
            {copied ? t('support.copied') : t('support.copy')}
          </button>
        </div>
      </div>
    </div>
  );
};

