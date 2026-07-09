import React, { useLayoutEffect, useRef, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useScrollLock } from '@/hooks/useScrollLock';
import paymentSuccessArtTopLeft from '@/assets/img2/payment_success_art_top_left.png';
import paymentSuccessExclamation from '@/assets/img2/payment_success_exclamation.png';
import paymentSuccessArtBottomRight from '@/assets/img2/payment_success_art_bottom_right.png';
import styles from './PaymentSuccessModal.module.less';

export interface PaymentSuccessCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PaymentSuccessCelebration: React.FC<PaymentSuccessCelebrationProps> = ({
  isOpen,
  onClose,
}) => {
  const { t, locale } = useLanguage();
  const [celebrationTitleWidth, setCelebrationTitleWidth] = useState(0);
  const celebrationTitleRef = useRef<HTMLParagraphElement>(null);

  const isChineseLocale = locale === 'zh-CN' || locale === 'zh-TW';

  useLayoutEffect(() => {
    if (!isOpen) {
      setCelebrationTitleWidth(0);
      return;
    }

    const measureTitleWidth = () => {
      if (celebrationTitleRef.current) {
        setCelebrationTitleWidth(celebrationTitleRef.current.offsetWidth);
      }
    };

    measureTitleWidth();
    window.addEventListener('resize', measureTitleWidth);

    return () => {
      window.removeEventListener('resize', measureTitleWidth);
    };
  }, [isOpen, locale, t]);

  useScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <button
      type="button"
      className={styles.celebrationOverlay}
      data-scroll-lock-overlay
      onClick={onClose}
      aria-label={t('paymentSuccess.closeModal')}
    >
      <div className={styles.celebrationStage}>
        <div
          className={styles.celebrationBarFrame}
          style={
            {
              '--celebration-title-width': `${celebrationTitleWidth}px`,
            } as React.CSSProperties
          }
        >
          <div className={styles.celebrationBarTrack}>
            <img
              src={paymentSuccessArtTopLeft}
              alt=""
              className={styles.celebrationArtLeft}
              aria-hidden
            />
            <img
              src={paymentSuccessArtBottomRight}
              alt=""
              className={styles.celebrationArtBottom}
              aria-hidden
            />
          </div>
          <div className={styles.celebrationCluster}>
            <p
              ref={celebrationTitleRef}
              className={`${styles.celebrationTitle}${
                isChineseLocale ? '' : ` ${styles.celebrationTitleCompact}`
              }`}
            >
              {t('paymentSuccess.celebrationTitle')}
            </p>
          </div>
          {celebrationTitleWidth > 0 && (
            <img
              src={paymentSuccessExclamation}
              alt=""
              className={styles.celebrationExclamation}
              aria-hidden
            />
          )}
        </div>
      </div>
    </button>
  );
};
