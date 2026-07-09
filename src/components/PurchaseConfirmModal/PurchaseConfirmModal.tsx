import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useUser } from '@/hooks/useUser';
import { useGameRole } from '@/hooks/useGameRole';
import { Product } from '@/types';
import { getDefaultAvatarForCurrentGame } from '@/utils';
import loginModalClose from '@/assets/img2/login_modal_close.png';
import styles from './PurchaseConfirmModal.module.less';

interface PurchaseConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  product: Product | null;
  quantity: number;
  onProceedToPayment?: () => Promise<string | null | void> | string | null | void;
}

export const PurchaseConfirmModal: React.FC<PurchaseConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  product,
  quantity,
  onProceedToPayment,
}) => {
  const { t } = useLanguage();
  const { user } = useUser();
  const { getAllRoles } = useGameRole();
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fallbackAvatarUrl = useMemo(() => getDefaultAvatarForCurrentGame(), [isOpen, product?.id]);

  useEffect(() => {
    if (!isOpen) {
      setInlineError('');
      setSubmitting(false);
    }
  }, [isOpen]);

  // 平台展示文案
  const getPlatformLabel = (platform: string | undefined): string => {
    if (!platform) return '';
    const lower = platform.toLowerCase();
    if (lower === 'ios') return 'iOS';
    return platform;
  };

  const normalizeChannel = (channel: string | number | undefined): string => {
    if (channel === undefined || channel === null) return '';
    return String(channel).trim();
  };

  const toComparableChannel = (channel: string | number | undefined): string => {
    const normalized = normalizeChannel(channel);
    if (!normalized) return '';
    return normalized.includes('_') ? normalized.split('_').pop() || normalized : normalized;
  };

  // 根据 game_server_channel 和 game_user_id 构建区服显示格式（channel + platform）
  const getServerDisplayLabel = (channel: string | undefined, gameUserId: string | undefined): string => {
    const normalizedChannel = normalizeChannel(channel);
    if (!normalizedChannel) return '';
    
    const allRoles = getAllRoles();
    let role;
    
    if (gameUserId) {
      // 如果有 game_user_id，优先按角色匹配，保证展示完整区服前缀（如 GL_58）
      role = allRoles.find((r) => r.game_user_id === gameUserId);
    }
    
    // 如果没有找到匹配角色，按区服匹配（兼容 "58" 与 "GL_58"）
    if (!role) {
      const comparableChannel = toComparableChannel(normalizedChannel);
      role = allRoles.find((r) => toComparableChannel(r.game_server_channel) === comparableChannel);
    }
    
    if (role) {
      const platformLabel = getPlatformLabel(role.platform);
      return platformLabel
        ? `${normalizeChannel(role.game_server_channel)}-${platformLabel}`
        : normalizeChannel(role.game_server_channel);
    }

    // 如果角色列表里暂时没有匹配到，回退使用当前用户平台（与外层展示保持一致）
    const fallbackPlatform = getPlatformLabel(user?.platform);
    return fallbackPlatform ? `${normalizedChannel}-${fallbackPlatform}` : normalizedChannel;
  };

  useScrollLock(isOpen && Boolean(product));

  if (!isOpen || !product) return null;

  const accountEmail = user?.email || user?.gameAccount || user?.username || '未绑定';
  const serverDisplayLabel =
    getServerDisplayLabel(user?.gameServer, user?.characterName) || t('purchaseConfirm.gameServer');

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = async () => {
    setInlineError('');
    setSubmitting(true);
    try {
      let paymentError: string | null | void = null;
      if (onProceedToPayment) {
        paymentError = await onProceedToPayment();
      }

      if (typeof paymentError === 'string' && paymentError.trim()) {
        setInlineError(paymentError);
        return;
      }

      if (dontAskAgain) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        localStorage.setItem('purchaseConfirmDontAsk', expiryDate.toISOString());
      }
      onClose();
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : '创建订单失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} data-scroll-lock-overlay onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="关闭">
          <img src={loginModalClose} alt="" className={styles.closeButtonImg} />
        </button>

        <h2 className={styles.title}>{t('purchaseConfirm.title')}</h2>

        <div className={styles.accountInfo}>
          <div className={styles.avatar}>
            <img
              src={user?.avatar || fallbackAvatarUrl}
              alt=""
              className={styles.avatarImg}
              onError={(e) => {
                e.currentTarget.src = fallbackAvatarUrl;
              }}
            />
          </div>
          <div className={styles.accountDetails}>
            <div className={styles.email}>{accountEmail}</div>
            <div className={styles.gameServerLabel}>{serverDisplayLabel}</div>
          </div>
        </div>

        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
            className={styles.checkbox}
          />
          <span className={styles.checkboxText}>{t('purchaseConfirm.dontAskAgain')}</span>
        </label>

        {inlineError && <div className={styles.inlineError}>{inlineError}</div>}

        <button type="button" className={styles.confirmButton} onClick={handleConfirm} disabled={submitting}>
          {t('purchaseConfirm.confirm')}
        </button>
      </div>
    </div>
  );
};

