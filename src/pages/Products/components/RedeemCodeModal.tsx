import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useScrollLock } from '@/hooks/useScrollLock';
import { settleIOSViewportAfterKeyboardClose } from '@/hooks/useViewportHeightFix';
import { redeemCodeApi } from '@/utils/api';
import { trackStoreRewardCode } from '@/utils/analytics';

import redeemClose from '@/assets/img2/redeem-close.png';
import payLoginTipsIcon from '@/assets/img2/pay_login_tips.png';
import redeemSuccessIcon from '@/assets/img2/redeem-success-icon.png';
import bamGameIcon from '@/assets/img2/bam_icon.png';
import oopsieGameIcon from '@/assets/img2/oopsie_icon.png';
import redeemGuideInfoEntryImg from '@/assets/img2/guide-info-entry.jpg';
import redeemGuideCopyGameIdImg from '@/assets/img2/guide-copy-game-id.jpg';
import styles from '../Products.module.less';

interface RedeemCodeModalProps {
  isOpen: boolean;
  gameId?: string;
  initialRedeemCode: string;
  initialGameUserId?: string;
  onClose: () => void;
}

type RedeemCodeMessage = {
  type: 'success' | 'error';
  text: string;
};

const REDEEM_CODE_MOBILE_CLOSE_ANIMATION_MS = 260;
const GAME_USER_ID_MAX_LENGTH = 10;
const REDEEM_CODE_KEYBOARD_SAFE_GAP = 20;
const REDEEM_CODE_KEYBOARD_OFFSET_MAX = 220;

function isIOSLikeBrowser(): boolean {
  const { userAgent, platform, maxTouchPoints } = window.navigator;
  return /iP(ad|hone|od)/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

const getGameIconByGameId = (gameId: string | undefined): string | null => {
  if (gameId === 'bam-bam-squad') return bamGameIcon;
  if (gameId === 'oopsie-croco' || gameId === 'oopsie') return oopsieGameIcon;
  return null;
};

const getRedeemApiLanguage = (locale: string): string => {
  const langMap: Record<string, string> = {
    'zh-CN': 'zh',
    'zh-TW': 'zh-TW',
    'en-US': 'en',
    'ja-JP': 'ja',
    'ko-KR': 'ko',
    'ru-RU': 'ru',
    'vi-VN': 'vi',
    'de-DE': 'de',
    'pt-PT': 'pt',
    'es-ES': 'es',
    'fr-FR': 'fr',
  };
  return langMap[locale] || locale.split('-')[0] || 'en';
};

const getTranslatedResultMessage = (
  t: (key: string) => string,
  resultCode: number | null | undefined,
  fallback: string
): string => {
  if (resultCode === null || resultCode === undefined) return fallback;
  const key = `redeemCode.resultMessages.${resultCode}`;
  const translated = t(key);
  return translated === key ? fallback : translated;
};

export const RedeemCodeModal: React.FC<RedeemCodeModalProps> = ({
  isOpen,
  gameId,
  initialRedeemCode,
  initialGameUserId,
  onClose,
}) => {
  const { t, locale } = useLanguage();
  const [gameUserId, setGameUserId] = useState('');
  const [redeemCode, setRedeemCode] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<RedeemCodeMessage | null>(null);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const guideWrapRef = useRef<HTMLDivElement>(null);
  const guidePanelRef = useRef<HTMLDivElement>(null);
  const guideIconRef = useRef<HTMLSpanElement>(null);
  const gameUserIdInputRef = useRef<HTMLInputElement>(null);
  const redeemCodeInputRef = useRef<HTMLInputElement>(null);
  const captchaInputRef = useRef<HTMLInputElement>(null);
  const keyboardOffsetRef = useRef(0);
  const ignoreNextGuideWrapClickRef = useRef(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const errorToastTimerRef = useRef<number | null>(null);
  const gameIcon = getGameIconByGameId(gameId);
  const captchaLoadFailedText = t('redeemCode.messages.captchaLoadFailed');

  const refreshCaptcha = useCallback(
    async (options: { clearInput?: boolean; keepMessage?: boolean } = {}) => {
      const { clearInput = true, keepMessage = false } = options;
      setCaptchaLoading(true);
      setCaptchaId('');
      setCaptchaImage('');
      if (clearInput) {
        setCaptchaCode('');
      }
      if (!keepMessage) {
        setMessage(null);
      }

      const res = await redeemCodeApi.getCaptcha();
      if (res.success && res.data) {
        setCaptchaId(res.data.captcha_id);
        setCaptchaImage(res.data.captcha_image);
      } else {
        const errorMessage = res.error || captchaLoadFailedText;
        setMessage({ type: 'error', text: errorMessage });
      }
      setCaptchaLoading(false);
    },
    [captchaLoadFailedText]
  );

  useEffect(() => {
    if (!isOpen) {
      setGameUserId('');
      setRedeemCode('');
      setCaptchaCode('');
      setCaptchaId('');
      setCaptchaImage('');
      setCaptchaLoading(false);
      setSubmitting(false);
      setMessage(null);
      setSuccessDialogOpen(false);
      setGuideOpen(false);
      setIsClosing(false);
      return;
    }

    setGameUserId(initialGameUserId || '');
    setRedeemCode(initialRedeemCode || '');
    setCaptchaCode('');
    setMessage(null);
    setSuccessDialogOpen(false);
    setGuideOpen(false);
    setIsClosing(false);
    void refreshCaptcha();
  }, [isOpen, initialGameUserId, initialRedeemCode, refreshCaptcha]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
      if (errorToastTimerRef.current !== null) {
        window.clearTimeout(errorToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    keyboardOffsetRef.current = keyboardOffset;
  }, [keyboardOffset]);

  useEffect(() => {
    if (!isOpen || !isIOSLikeBrowser()) {
      setKeyboardOffset(0);
      return;
    }

    const visualViewport = window.visualViewport;
    let frameId: number | null = null;

    const syncKeyboardOffset = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;

        const activeElement = document.activeElement;
        const inputElements = [
          gameUserIdInputRef.current,
          redeemCodeInputRef.current,
          captchaInputRef.current,
        ].filter((el): el is HTMLInputElement => el !== null);

        if (!inputElements.includes(activeElement as HTMLInputElement)) {
          setKeyboardOffset(0);
          return;
        }

        const viewportBottom = visualViewport
          ? visualViewport.offsetTop + visualViewport.height
          : window.innerHeight;
        const activeRect = (activeElement as HTMLInputElement).getBoundingClientRect();
        const inputBottomWithoutCurrentOffset = activeRect.bottom + keyboardOffsetRef.current;
        const keyboardOffsetMax = Math.max(
          REDEEM_CODE_KEYBOARD_OFFSET_MAX,
          Math.round(window.innerHeight * 0.35)
        );
        const nextOffset = Math.min(
          Math.max(
            0,
            inputBottomWithoutCurrentOffset + REDEEM_CODE_KEYBOARD_SAFE_GAP - viewportBottom
          ),
          keyboardOffsetMax
        );

        setKeyboardOffset(nextOffset);
      });
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (
        target === gameUserIdInputRef.current ||
        target === redeemCodeInputRef.current ||
        target === captchaInputRef.current
      ) {
        window.requestAnimationFrame(() => {
          (target as HTMLElement).scrollIntoView({
            block: 'center',
            inline: 'nearest',
          });
          syncKeyboardOffset();
        });
      }
    };

    const handleFocusOut = () => {
      syncKeyboardOffset();
    };

    syncKeyboardOffset();
    visualViewport?.addEventListener('resize', syncKeyboardOffset);
    visualViewport?.addEventListener('scroll', syncKeyboardOffset);
    window.addEventListener('resize', syncKeyboardOffset);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      setKeyboardOffset(0);
      visualViewport?.removeEventListener('resize', syncKeyboardOffset);
      visualViewport?.removeEventListener('scroll', syncKeyboardOffset);
      window.removeEventListener('resize', syncKeyboardOffset);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
    };
  }, [isOpen]);

  const syncGuideArrowPosition = useCallback(() => {
    const icon = guideIconRef.current;
    const panel = guidePanelRef.current;
    if (!icon || !panel) return;

    const iconRect = icon.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const arrowCenterLeft = iconRect.left + iconRect.width / 2 - panelRect.left;
    panel.style.setProperty('--redeem-guide-arrow-left', `${arrowCenterLeft}px`);
  }, []);

  useEffect(() => {
    if (!guideOpen) return undefined;

    const frameId = window.requestAnimationFrame(syncGuideArrowPosition);
    window.addEventListener('resize', syncGuideArrowPosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncGuideArrowPosition);
    };
  }, [guideOpen, syncGuideArrowPosition]);

  useEffect(() => {
    if (!guideOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (guidePanelRef.current?.contains(target)) return;

      if (guideWrapRef.current?.contains(target)) {
        ignoreNextGuideWrapClickRef.current = true;
      }
      setGuideOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [guideOpen]);

  useScrollLock(isOpen);

  const finishClose = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsClosing(false);
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (isClosing || closeTimeoutRef.current !== null) return;

    settleIOSViewportAfterKeyboardClose();

    const shouldAnimateOnMobile =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 767px)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setGuideOpen(false);

    if (!shouldAnimateOnMobile) {
      onClose();
      return;
    }

    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(
      finishClose,
      REDEEM_CODE_MOBILE_CLOSE_ANIMATION_MS + 80
    );
  }, [finishClose, isClosing, onClose]);

  const showErrorToast = useCallback((message: string) => {
    setErrorToast(message);
    if (errorToastTimerRef.current !== null) {
      window.clearTimeout(errorToastTimerRef.current);
    }
    errorToastTimerRef.current = window.setTimeout(() => {
      setErrorToast(null);
    }, 2400);
  }, []);

  if (!isOpen) return null;

  const isSuccessDialogOpen = successDialogOpen;
  const trimmedGameUserId = gameUserId.trim();
  const trimmedRedeemCode = redeemCode.trim();
  const trimmedCaptchaCode = captchaCode.trim();
  const canSubmit = Boolean(
    trimmedGameUserId &&
      trimmedRedeemCode &&
      trimmedCaptchaCode &&
      captchaId &&
      !captchaLoading &&
      !submitting
  );

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      requestClose();
    }
  };

  const handleModalAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !isClosing) return;
    finishClose();
  };

  const handleGuideWrapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (guidePanelRef.current?.contains(target)) return;

    if (ignoreNextGuideWrapClickRef.current) {
      ignoreNextGuideWrapClickRef.current = false;
      return;
    }

    setGuideOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!trimmedGameUserId || !trimmedRedeemCode || !trimmedCaptchaCode) {
      const errorMessage = t('redeemCode.messages.requiredFields');
      setMessage({ type: 'error', text: errorMessage });
      showErrorToast(errorMessage);
      return;
    }

    if (!captchaId) {
      const errorMessage = t('redeemCode.messages.captchaLoadFailed');
      setMessage({ type: 'error', text: errorMessage });
      showErrorToast(errorMessage);
      void refreshCaptcha({ clearInput: false });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const res = await redeemCodeApi.redeem({
      gameUserId: trimmedGameUserId,
      redeemCode: trimmedRedeemCode,
      captchaId,
      captchaCode: trimmedCaptchaCode,
      language: getRedeemApiLanguage(locale),
    });

    if (res.success) {
      trackStoreRewardCode(trimmedRedeemCode, {
        gameUserId: trimmedGameUserId,
        rewardCodeType: res.data?.rewardCodeType,
      });
      setMessage(null);
      setSuccessDialogOpen(true);
      setSubmitting(false);
      return;
    } else {
      const resultCode = res.data?.resultCode ?? res.bizCode;
      const errorMessage = getTranslatedResultMessage(
        t,
        resultCode,
        res.error || t('redeemCode.messages.redeemFailed')
      );
      setMessage({ type: 'error', text: errorMessage });
      showErrorToast(errorMessage);
      await refreshCaptcha({ clearInput: true, keepMessage: true });
    }

    setSubmitting(false);
  };

  return (
    <div
      className={`${styles.redeemCodeOverlay} ${
        isSuccessDialogOpen ? styles.redeemCodeSuccessOverlay : ''
      }`}
      data-scroll-lock-overlay
      onClick={handleBackdropClick}
    >
      <div
        className={`${styles.redeemCodeModal} ${
          isSuccessDialogOpen ? styles.redeemCodeModalSuccess : ''
        } ${isClosing ? styles.redeemCodeModalClosing : ''}`}
        onClick={event => event.stopPropagation()}
        onAnimationEnd={handleModalAnimationEnd}
        style={
          keyboardOffset > 0
            ? ({ '--redeem-code-keyboard-offset': `${keyboardOffset}px` } as React.CSSProperties)
            : undefined
        }
      >
        {isSuccessDialogOpen ? (
          <div
            className={styles.redeemCodeSuccessBody}
            role="dialog"
            aria-modal="true"
            aria-labelledby="redeem-code-success-title"
            aria-describedby="redeem-code-success-description"
          >
            <img
              src={redeemSuccessIcon}
              alt=""
              className={styles.redeemCodeSuccessIcon}
              aria-hidden
            />
            <h2 id="redeem-code-success-title" className={styles.redeemCodeSuccessTitle}>
              {t('redeemCode.success.title')}
            </h2>
            <p id="redeem-code-success-description" className={styles.redeemCodeSuccessDescription}>
              {t('redeemCode.success.description')}
            </p>
            <button
              type="button"
              className={styles.redeemCodeSuccessConfirm}
              onClick={requestClose}
            >
              {t('redeemCode.success.confirm')}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className={styles.redeemCodeDesktopClose}
              onClick={requestClose}
              aria-label={t('redeemCode.close')}
            >
              <img src={redeemClose} alt="" className={styles.redeemCodeCloseImg} />
            </button>

            <div className={styles.redeemCodeMobileHeader}>
              <h2 className={styles.redeemCodeMobileTitle}>{t('redeemCode.title')}</h2>
              <button
                type="button"
                className={styles.redeemCodeMobileClose}
                onClick={requestClose}
                aria-label={t('redeemCode.close')}
              >
                <img src={redeemClose} alt="" className={styles.redeemCodeMobileCloseIcon} />
              </button>
            </div>

            <div className={styles.redeemCodeModalBody}>
              {gameIcon && (
                <img src={gameIcon} alt="" className={styles.redeemCodeModalGameIcon} aria-hidden />
              )}
              <div className={styles.redeemCodeModalTitleBadge}>
                <span className={styles.redeemCodeModalTitleText}>{t('redeemCode.title')}</span>
              </div>

              <form className={styles.redeemCodeModalForm} onSubmit={handleSubmit}>
                <div className={styles.redeemCodeFieldHeader}>
                  <label className={styles.redeemCodeModalLabel} htmlFor="redeem-code-game-id">
                    {t('redeemCode.gameIdLabel')}
                  </label>
                  <div
                    ref={guideWrapRef}
                    className={styles.redeemCodeGuideWrap}
                    onClick={handleGuideWrapClick}
                  >
                    <button
                      type="button"
                      className={styles.redeemCodeGuideButton}
                      aria-expanded={guideOpen}
                    >
                      <span ref={guideIconRef} className={styles.redeemCodeGuideIcon} aria-hidden>
                        !
                      </span>
                      <span>{t('redeemCode.howToFindGameId')}</span>
                    </button>
                    {guideOpen && (
                      <div ref={guidePanelRef} className={styles.redeemCodeGuidePanel}>
                        <span className={styles.redeemCodeGuideArrow} aria-hidden />
                        <div className={styles.redeemCodeGuideStep}>
                          <p className={styles.redeemCodeGuideStepTitle}>
                            {t('redeemCode.guide.stepOne')}
                          </p>
                          <div className={styles.redeemCodeGuidePreview}>
                            <img src={redeemGuideInfoEntryImg} alt="" aria-hidden />
                          </div>
                        </div>
                        <div className={styles.redeemCodeGuideStep}>
                          <p className={styles.redeemCodeGuideStepTitle}>
                            {t('redeemCode.guide.stepTwo')}
                          </p>
                          <div className={styles.redeemCodeGuidePreview}>
                            <img src={redeemGuideCopyGameIdImg} alt="" aria-hidden />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <input
                  id="redeem-code-game-id"
                  className={styles.redeemCodeModalInput}
                  type="text"
                  inputMode="numeric"
                  ref={gameUserIdInputRef}
                  maxLength={GAME_USER_ID_MAX_LENGTH}
                  value={gameUserId}
                  placeholder={t('redeemCode.gameIdPlaceholder')}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={event => {
                    setGameUserId(event.target.value.slice(0, GAME_USER_ID_MAX_LENGTH));
                    setMessage(null);
                  }}
                  onBlur={() => setGameUserId(gameUserId.trim())}
                />

                <label className={styles.redeemCodeModalLabel} htmlFor="redeem-code-modal-code">
                  {t('redeemCode.giftCodeLabel')}
                </label>
                <input
                  id="redeem-code-modal-code"
                  className={styles.redeemCodeModalInput}
                  type="text"
                  ref={redeemCodeInputRef}
                  value={redeemCode}
                  placeholder={t('redeemCode.giftCodePlaceholder')}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={event => {
                    setRedeemCode(event.target.value);
                    setMessage(null);
                  }}
                  onBlur={() => setRedeemCode(redeemCode.trim())}
                />

                <label className={styles.redeemCodeModalLabel} htmlFor="redeem-code-captcha">
                  {t('redeemCode.captchaLabel')}
                </label>
                <div className={styles.redeemCodeCaptchaRow}>
                  <input
                    id="redeem-code-captcha"
                    className={styles.redeemCodeModalInput}
                    type="text"
                    inputMode="numeric"
                    ref={captchaInputRef}
                    maxLength={4}
                    value={captchaCode}
                    placeholder={t('redeemCode.captchaPlaceholder')}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={event => {
                      setCaptchaCode(event.target.value.slice(0, 4));
                      setMessage(null);
                    }}
                  />
                  <button
                    type="button"
                    className={styles.redeemCodeCaptchaImage}
                    onClick={() => void refreshCaptcha()}
                    disabled={captchaLoading}
                    aria-label={t('redeemCode.refreshCaptcha')}
                  >
                    {captchaLoading ? (
                      <span className={styles.redeemCodeCaptchaSpinner} aria-hidden />
                    ) : captchaImage ? (
                      <img src={captchaImage} alt="" />
                    ) : (
                      <span className={styles.redeemCodeCaptchaFallback}>
                        {t('redeemCode.messages.captchaLoadFailed')}
                      </span>
                    )}
                  </button>
                </div>

                {message && (
                  <div
                    className={`${styles.redeemCodeFormMessage} ${
                      message.type === 'error' ? styles.redeemCodeFormMessageError : ''
                    }`}
                    role={message.type === 'error' ? 'alert' : 'status'}
                  >
                    <img
                      src={payLoginTipsIcon}
                      alt=""
                      className={styles.redeemCodeFormMessageIcon}
                      aria-hidden
                    />
                    <span className={styles.redeemCodeFormMessageText}>{message.text}</span>
                  </div>
                )}

                <div className={styles.redeemCodeModalFooter}>
                  <button
                    type="submit"
                    className={styles.redeemCodeModalSubmit}
                    disabled={!canSubmit}
                  >
                    {submitting ? t('redeemCode.submitting') : t('redeemCode.submit')}
                  </button>
                  <p className={styles.redeemCodeRuleTip}>{t('redeemCode.rule')}</p>
                </div>
              </form>
            </div>
          </>
        )}

        {errorToast && (
          <div className={styles.redeemCodeErrorToast} role="alert" aria-live="assertive">
            <span className={styles.redeemCodeErrorToastIcon} aria-hidden>
              !
            </span>
            <span className={styles.redeemCodeErrorToastText}>{errorToast}</span>
          </div>
        )}
      </div>
    </div>
  );
};
