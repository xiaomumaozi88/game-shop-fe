import React, { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useScrollLock } from '@/hooks/useScrollLock';
import loginModalClose from '@/assets/img2/login_modal_close.png';
import styles from './SupportModal.module.less';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const email = 'support@toukagame.com';

  useScrollLock(isOpen);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
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
      } catch (copyErr) {
        // console.error('复制失败', copyErr);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className={styles.overlay} data-scroll-lock-overlay>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="support-modal-title">
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="关闭"
        >
          <img src={loginModalClose} alt="" className={styles.closeButtonImg} />
        </button>

        <h2 id="support-modal-title" className={styles.title}>
          {t('support.title')}
        </h2>
        <p className={styles.description}>{t('support.description')}</p>
        <p className={styles.email}>{email}</p>
        <button type="button" className={styles.copyButton} onClick={handleCopy}>
          {copied ? t('support.copied') : t('support.copy')}
        </button>
      </div>
    </div>
  );
};
