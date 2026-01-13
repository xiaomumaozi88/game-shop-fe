import React from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { CloseIcon } from '../Icons/CloseIcon';
import idIcon from '@/assets/imgs/touka_login_ID_YE.png';
import styles from './AccountGuideModal.module.less';

interface AccountGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountGuideModal: React.FC<AccountGuideModalProps> = ({ isOpen, onClose }) => {
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
        <button className={styles.closeButton} onClick={onClose} aria-label="关闭">
          <CloseIcon size={24} />
        </button>

        {/* TOUKA ID Logo */}
        <div className={styles.logoSection}>
          <span className={styles.logoText}>TOUKA</span>
          <img src={idIcon} alt="ID" className={styles.idBadge} />
        </div>

        {/* 标题 */}
        <h2 className={styles.title}>{t('accountGuide.title')}</h2>

        {/* 内容 */}
        <p className={styles.content}>{t('accountGuide.content')}</p>
      </div>
    </div>
  );
};

