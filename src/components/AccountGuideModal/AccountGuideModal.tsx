import React from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { CloseIcon } from '../Icons/CloseIcon';
import idIcon from '@/assets/imgs/touka_login_ID_YE.png';
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

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div
        className={isBindGuide ? `${styles.modal} ${styles.modalBindGuide}` : styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label={t('paymentSuccess.closeModal')}
        >
          <CloseIcon size={24} />
        </button>

        {!isBindGuide && (
          <>
            <div className={styles.logoSection}>
              <span className={styles.logoText}>TOUKA</span>
              <img src={idIcon} alt="ID" className={styles.idBadge} />
            </div>
            <h2 className={styles.title}>{t('accountGuide.title')}</h2>
          </>
        )}

        <p className={isBindGuide ? styles.contentBindGuide : styles.content}>
          {isBindGuide ? t('login.bindGameGuideContent') : t('accountGuide.content')}
        </p>
      </div>
    </div>
  );
};

