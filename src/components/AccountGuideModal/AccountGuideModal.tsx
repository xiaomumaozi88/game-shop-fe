import React from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useScrollLock } from '@/hooks/useScrollLock';
import logoIconImg from '@/assets/img2/login_modal_logo.png';
import logoTextImg from '@/assets/img2/login_modal_logotext.png';
import loginModalClose from '@/assets/img2/login_modal_close.png';
import styles from './AccountGuideModal.module.less';

interface AccountGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 绑定游戏须知：仅展示说明文案，无顶部 logo 与标题 */
  variant?: 'default' | 'bindGuide';
}

export const AccountGuideModal: React.FC<AccountGuideModalProps> = ({
  isOpen,
  onClose,
  variant = 'default',
}) => {
  const { t } = useLanguage();
  const isBindGuide = variant === 'bindGuide';

  useScrollLock(isOpen);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} data-scroll-lock-overlay onClick={handleBackdropClick}>
      <div
        className={
          isBindGuide
            ? `${styles.modal} ${styles.modalBindGuide}`
            : `${styles.modal} ${styles.modalDefault}`
        }
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label={t('paymentSuccess.closeModal')}
        >
          <img src={loginModalClose} alt="" className={styles.closeButtonImg} />
        </button>

        {isBindGuide ? (
          <p className={styles.contentBindGuide}>{t('login.bindGameGuideContent')}</p>
        ) : (
          <div className={styles.modalBody}>
            <img src={logoIconImg} alt="" className={styles.logoIcon} aria-hidden />
            <span className={styles.logoTextGroup}>
              <img src={logoTextImg} alt="TOUKA" className={styles.logoTextImg} />
            </span>
            <h2 className={styles.title}>{t('accountGuide.title')}</h2>
            <p className={styles.content}>{t('accountGuide.content')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
