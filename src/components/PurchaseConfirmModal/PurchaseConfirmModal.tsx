import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useUser } from '@/hooks/useUser';
import { useGameRole } from '@/hooks/useGameRole';
import { Product } from '@/types';
import { PAYMENT_TYPES, getDefaultAvatarForCurrentGame } from '@/utils';
import styles from './PurchaseConfirmModal.module.less';

interface PurchaseConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  product: Product | null;
  quantity: number;
  onProceedToPayment?: () => void; // 新增：继续支付的回调
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
  const fallbackAvatarUrl = useMemo(() => getDefaultAvatarForCurrentGame(), [isOpen, product?.id]);

  // 平台展示文案
  const getPlatformLabel = (platform: string | undefined): string => {
    if (!platform) return '';
    const lower = platform.toLowerCase();
    if (lower === 'ios') return 'iOS';
    if (lower === 'android') return '安卓';
    return platform;
  };

  // 根据 game_user_id 获取"昵称-平台"展示
  const getCharacterDisplayName = (gameUserId: string | undefined): string => {
    if (!gameUserId) return '';
    const allRoles = getAllRoles();
    const role = allRoles.find((r) => r.game_user_id === gameUserId);
    if (!role) return '';
    const platformLabel = getPlatformLabel(role.platform);
    return platformLabel ? `${role.nick_name}-${platformLabel}` : role.nick_name;
  };

  // 根据 game_server_channel 和 game_user_id 构建区服显示格式（channel + platform）
  const getServerDisplayLabel = (channel: string | undefined, gameUserId: string | undefined): string => {
    if (!channel) return '';
    
    const allRoles = getAllRoles();
    let role;
    
    if (gameUserId) {
      // 如果有 game_user_id，优先查找匹配的角色
      role = allRoles.find((r) => r.game_user_id === gameUserId && r.game_server_channel === channel);
    }
    
    // 如果没有找到匹配的角色，尝试查找该 channel 下的任意角色（获取 platform）
    if (!role) {
      role = allRoles.find((r) => r.game_server_channel === channel);
    }
    
    if (role) {
      return `${role.game_server_channel}-${role.platform}`;
    }
    
    // 如果都没找到，只返回 channel
    return channel;
  };

  if (!isOpen || !product) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    if (dontAskAgain) {
      // 保存到本地存储，30天内不再询问
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      localStorage.setItem('purchaseConfirmDontAsk', expiryDate.toISOString());
    }
    
    // 先关闭确认弹窗
    onClose();
    // 然后触发继续支付
    if (onProceedToPayment) {
      onProceedToPayment();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{t('purchaseConfirm.title')}</h2>

        {/* 账户信息区域 */}
        <div className={styles.accountInfo}>
          <div className={styles.avatar}>
            <img 
              src={user?.avatar || fallbackAvatarUrl} 
              alt="avatar" 
              className={styles.avatarImg}
              onError={(e) => {
                e.currentTarget.src = fallbackAvatarUrl;
              }}
            />
          </div>
          <div className={styles.accountDetails}>
            <div className={styles.email}>{user?.email || user?.gameAccount || user?.username || '未绑定'}</div>
            {(user?.gameServer || user?.characterName) && (
              <div className={styles.characterInfo}>
                {user?.characterName && (
                  <span className={styles.characterName}>
                    {getCharacterDisplayName(user.characterName)}
                  </span>
                )}
                {user?.gameServer && (
                  <span className={styles.gameServer}>
                    {getServerDisplayLabel(user.gameServer, user.characterName)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 30天内不再询问选项 */}
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
            className={styles.checkbox}
          />
          <span className={styles.checkboxText}>{t('purchaseConfirm.dontAskAgain')}</span>
        </label>

        {/* 确认按钮 */}
        <button className={styles.confirmButton} onClick={handleConfirm}>
          {t('purchaseConfirm.confirm')}
        </button>
      </div>
    </div>
  );
};

