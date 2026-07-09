import React, { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useScrollLock } from '@/hooks/useScrollLock';
import loginModalClose from '@/assets/img2/login_modal_close.png';
import styles from './LogoutModal.module.less';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => boolean | Promise<boolean>;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useLanguage();
  const [dontRemind, setDontRemind] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useScrollLock(isOpen);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (confirming) return;
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = async () => {
    if (confirming) return;

    if (dontRemind) {
      localStorage.setItem('logout_dont_remind', 'true');
    }

    setConfirming(true);
    try {
      const success = await Promise.resolve(onConfirm());
      if (success) {
        onClose();
      }
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className={styles.overlay} data-scroll-lock-overlay onClick={handleBackdropClick}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="关闭" disabled={confirming}>
          <img src={loginModalClose} alt="" className={styles.closeButtonImg} />
        </button>

        <h2 id="logout-modal-title" className={styles.title}>
          {t('logout.title')}
        </h2>

        <p className={styles.description}>
          {t('logout.messageLine1')}
          <br />
          {t('logout.messageLine2')}
        </p>

        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={dontRemind}
            onChange={(e) => setDontRemind(e.target.checked)}
            className={styles.checkbox}
          />
          <span className={styles.checkboxText}>{t('logout.dontRemind')}</span>
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.confirmButton} onClick={handleConfirm} disabled={confirming}>
            {t('logout.confirm')}
          </button>
          <button type="button" className={styles.cancelButton} onClick={onClose} disabled={confirming}>
            {t('logout.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
