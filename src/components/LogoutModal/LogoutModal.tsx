import React, { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import styles from './LogoutModal.module.less';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useLanguage();
  const [dontRemind, setDontRemind] = useState(false);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    // 保存"下次不再提醒"的选项到本地存储
    if (dontRemind) {
      localStorage.setItem('logout_dont_remind', 'true');
    }
    onConfirm();
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{t('logout.title')}</h2>
        <div className={styles.message}>
          <div>{t('logout.messageLine1')}{t('logout.messageLine2')}</div>
        </div>
        <div className={styles.checkboxContainer}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={dontRemind}
              onChange={(e) => setDontRemind(e.target.checked)}
              className={styles.checkbox}
            />
            <span className={styles.checkboxText}>{t('logout.dontRemind')}</span>
          </label>
        </div>
        <div className={styles.actions}>
          <button className={styles.confirmButton} onClick={handleConfirm}>
            {t('logout.confirm')}
          </button>
          <button className={styles.cancelButton} onClick={onClose}>
            {t('logout.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

