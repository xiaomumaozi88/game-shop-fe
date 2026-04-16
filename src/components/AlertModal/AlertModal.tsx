import React from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import styles from './AlertModal.module.less';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  /** 主文案与按钮之间的额外内容（如无角色弹窗的刷新提示） */
  extraBelowMessage?: React.ReactNode;
  /** 与主按钮并列的「返回」类按钮文案（提供时展示双按钮） */
  dismissText?: string;
  onDismiss?: () => void;
  /** 主按钮点击时执行；未设置时主按钮等价于 onClose */
  onPrimary?: () => void;
  /** 为 true 时禁用两个按钮（如提交中） */
  actionsLocked?: boolean;
  /** 交换双按钮视觉层级：dismiss 为主按钮，confirm 为次按钮 */
  swapDualButtonStyles?: boolean;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  confirmText,
  extraBelowMessage,
  dismissText,
  onDismiss,
  onPrimary,
  actionsLocked,
  swapDualButtonStyles,
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !actionsLocked) {
      onClose();
    }
  };

  const handlePrimaryClick = () => {
    if (actionsLocked) return;
    if (onPrimary) {
      onPrimary();
      return;
    }
    onClose();
  };

  const handleDismissClick = () => {
    if (actionsLocked) return;
    if (onDismiss) {
      onDismiss();
      return;
    }
    onClose();
  };

  const dualActions = Boolean(dismissText && onDismiss);

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {title && <h2 className={styles.title}>{title}</h2>}
        {message ? <p className={styles.message}>{message}</p> : null}
        {extraBelowMessage ? <div className={styles.extraBelow}>{extraBelowMessage}</div> : null}
        <div className={dualActions ? styles.actionsRow : styles.actions}>
          {dualActions ? (
            <>
              <button
                type="button"
                className={swapDualButtonStyles ? styles.confirmButton : styles.dismissButton}
                onClick={handleDismissClick}
                disabled={actionsLocked}
              >
                {dismissText}
              </button>
              <button
                type="button"
                className={swapDualButtonStyles ? styles.dismissButton : styles.confirmButton}
                onClick={handlePrimaryClick}
                disabled={actionsLocked}
              >
                {confirmText || t('purchaseConfirm.confirm') || '确定'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.confirmButton}
              onClick={handlePrimaryClick}
              disabled={actionsLocked}
            >
              {confirmText || t('purchaseConfirm.confirm') || '确定'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

