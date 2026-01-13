import React from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import styles from './AlertModal.module.less';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  confirmText?: string;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  confirmText,
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {title && <h2 className={styles.title}>{title}</h2>}
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className={styles.confirmButton} onClick={onClose}>
            {confirmText || t('purchaseConfirm.confirm') || '确定'}
          </button>
        </div>
      </div>
    </div>
  );
};

