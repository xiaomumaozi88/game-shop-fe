import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useUser } from '@/hooks/useUser';
import { settleIOSViewportAfterKeyboardClose } from '@/hooks/useViewportHeightFix';
import { AccountGuideModal } from '../AccountGuideModal/AccountGuideModal';
import { authApi, setAuthToken } from '@/utils/api';
import { gameRoleStore } from '@/store/gameRoleStore';
import { getErrorMessage, isCaptchaRelatedError, showErrorToast } from '@/utils/errorHandler';
import { CodeExpired, EmailInvalid, EmailCouldNotBeEmpty } from '@/utils/bizCodes';
import loginModalBg from '@/assets/img2/login_modal_bg.png';
import loginModalLogo from '@/assets/img2/login_modal_logo.png';
import loginModalLogoText from '@/assets/img2/login_modal_logotext.png';
import loginModalClose from '@/assets/img2/login_modal_close.png';
import payLoginTipsIcon from '@/assets/img2/pay_login_tips.png';
import styles from './LoginModal.module.less';

const ALL_APP_KEYS = [
  'f6594168ce3a9cc57ab7ed74426e25e1',
  '45a56d38bbdd60353438aa25d1ccff20',
];

const IOS_DEVICE_PATTERN = /iP(ad|hone|od)/;

function isIOSLikeBrowser(): boolean {
  const { userAgent, platform, maxTouchPoints } = window.navigator;
  return IOS_DEVICE_PATTERN.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

function shouldRestoreScrollAfterFocus(): boolean {
  return isIOSLikeBrowser();
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { t, locale } = useLanguage();
  const instructionSentenceEnd = locale === 'zh-CN' || locale === 'zh-TW' ? '。' : '.';
  const { setUser } = useUser();
  const [email, setEmail] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [keepLogin, setKeepLogin] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const [loading, setLoading] = useState(false);
  const [accountGuideVariant, setAccountGuideVariant] = useState<'default' | 'bindGuide' | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [codes, setCodes] = useState<string[]>(['', '', '', '', '', '']);
  const [verificationError, setVerificationError] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [verificationKeyboardOffset, setVerificationKeyboardOffset] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const verificationSubmittingRef = useRef(false);
  const verificationKeyboardOffsetRef = useRef(0);

  useEffect(() => {
    [loginModalBg, loginModalLogo, loginModalLogoText, loginModalClose].forEach((src) => {
      const img = new Image();
      img.src = src;
      void img.decode?.().catch(() => undefined);
    });
  }, []);

  const focusVerificationInput = (index: number) => {
    const input = inputRefs.current[index];
    if (!input) return;

    const pageScrollX = window.scrollX;
    const pageScrollY = window.scrollY;
    const overlayScrollTop = overlayRef.current?.scrollTop ?? 0;

    if (shouldRestoreScrollAfterFocus()) {
      input.focus({ preventScroll: true });

      const restoreScroll = () => {
        window.scrollTo(pageScrollX, pageScrollY);
        if (overlayRef.current) {
          overlayRef.current.scrollTop = overlayScrollTop;
        }
      };

      window.requestAnimationFrame(restoreScroll);
      window.setTimeout(restoreScroll, 80);
    } else {
      input.focus();
    }
  };

  const handleClose = () => {
    settleIOSViewportAfterKeyboardClose();
    onClose();
  };

  const fetchCaptcha = async () => {
    setError('');
    const res = await authApi.getCaptcha();
    if (res.success && res.data) {
      setCaptchaId(res.data.captcha_id);
      setCaptchaImage(res.data.captcha_img);
    } else {
      setError(res.error || t('login.captchaPlaceholder'));
      setCaptchaId('');
      setCaptchaImage('');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setCaptcha('');
      setKeepLogin(false);
      setAgreeTerms(false);
      setError('');
      setEmailError('');
      setCaptchaError('');
      setLoading(false);
      setShowVerification(false);
      setCodes(['', '', '', '', '', '']);
      setVerificationError('');
      setVerificationLoading(false);
      verificationSubmittingRef.current = false;
      setCaptcha('');
      setCaptchaId('');
      setCaptchaImage('');
      setAccountGuideVariant(null);
    } else {
      const frameId = window.requestAnimationFrame(() => {
        void fetchCaptcha();
      });
      return () => window.cancelAnimationFrame(frameId);
    }
  }, [isOpen]);

  useScrollLock(isOpen);

  useEffect(() => {
    verificationKeyboardOffsetRef.current = verificationKeyboardOffset;
  }, [verificationKeyboardOffset]);

  useEffect(() => {
    if (!isOpen || !showVerification) {
      setVerificationKeyboardOffset(0);
      return;
    }

    const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!isTouchDevice) {
      setVerificationKeyboardOffset(0);
      return;
    }

    if (isIOSLikeBrowser()) {
      setVerificationKeyboardOffset(0);
      return;
    }

    const visualViewport = window.visualViewport;
    let frameId: number | null = null;

    const syncVerificationKeyboardOffset = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;

        const activeElement = document.activeElement;
        if (
          !(activeElement instanceof HTMLInputElement) ||
          !inputRefs.current.includes(activeElement)
        ) {
          setVerificationKeyboardOffset(0);
          return;
        }

        const viewportBottom = visualViewport
          ? visualViewport.offsetTop + visualViewport.height
          : window.innerHeight;

        const inputRect = activeElement.getBoundingClientRect();
        const safeGap = 20;
        const inputBottomWithoutCurrentOffset =
          inputRect.bottom + verificationKeyboardOffsetRef.current;
        const nextOffset = Math.min(
          Math.max(0, inputBottomWithoutCurrentOffset + safeGap - viewportBottom),
          180
        );

        setVerificationKeyboardOffset(nextOffset);
      });
    };

    syncVerificationKeyboardOffset();
    visualViewport?.addEventListener('resize', syncVerificationKeyboardOffset);
    visualViewport?.addEventListener('scroll', syncVerificationKeyboardOffset);
    window.addEventListener('resize', syncVerificationKeyboardOffset);
    document.addEventListener('focusin', syncVerificationKeyboardOffset, true);
    document.addEventListener('focusout', syncVerificationKeyboardOffset, true);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      visualViewport?.removeEventListener('resize', syncVerificationKeyboardOffset);
      visualViewport?.removeEventListener('scroll', syncVerificationKeyboardOffset);
      window.removeEventListener('resize', syncVerificationKeyboardOffset);
      document.removeEventListener('focusin', syncVerificationKeyboardOffset, true);
      document.removeEventListener('focusout', syncVerificationKeyboardOffset, true);
    };
  }, [isOpen, showVerification]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');
    setCaptchaError('');
    setLoading(true);

    if (!captcha) {
      setCaptchaError(t('login.captchaRequired') || t('login.invalidCaptcha') || '请输入验证码');
      setLoading(false);
      return;
    }

    if (captcha.length !== 4 || !/^\d{4}$/.test(captcha)) {
      setCaptchaError(t('login.invalidCaptcha') || '请输入4位数字验证码');
      setLoading(false);
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(t('login.invalidEmail') || '请输入有效的邮箱地址');
      setLoading(false);
      return;
    }

    if (!captchaId) {
      setCaptchaError(t('login.captchaPlaceholder') || '请先获取图形验证码');
      setLoading(false);
      fetchCaptcha();
      return;
    }

    try {
      const sendCodeRes = await authApi.sendCode({
        email,
        type: 'login',
        captcha_id: captchaId,
        captcha_code: captcha,
      });

      if (!sendCodeRes.success) {
        const bizCode = sendCodeRes.bizCode;
        if (bizCode && isCaptchaRelatedError(bizCode)) {
          const errorMessage = getErrorMessage(bizCode);
          if (bizCode === EmailInvalid || bizCode === EmailCouldNotBeEmpty) {
            setEmailError(errorMessage);
          } else {
            setCaptchaError(errorMessage);
          }
          fetchCaptcha();
          setCaptcha('');
        } else {
          const errorMessage = bizCode
            ? getErrorMessage(bizCode)
            : sendCodeRes.error || t('login.sendCodeFailed') || '发送验证码失败';
          setError(errorMessage);
        }
        setLoading(false);
        return;
      }

      setShowVerification(true);
      setCodes(['', '', '', '', '', '']);
      setVerificationError('');
      setLoading(false);
      setTimeout(() => {
        focusVerificationInput(0);
      }, 100);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('login.sendCodeFailed') || '发送验证码失败';
      setError(errorMessage);
      fetchCaptcha();
      setCaptcha('');
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '').split('');

    if (value && digits.length === 0) {
      return;
    }

    const newCodes = [...codes];
    if (digits.length <= 1) {
      newCodes[index] = digits[0] || '';
    } else {
      digits.slice(0, 6 - index).forEach((digit, offset) => {
        newCodes[index + offset] = digit;
      });
    }

    setCodes(newCodes);
    setVerificationError('');

    const nextCode = newCodes.join('');
    if (nextCode.length === 6) {
      window.setTimeout(() => {
        void handleVerifySubmit(nextCode);
      }, 0);
      return;
    }

    if (digits.length > 0 && index < 5) {
      const nextIndex = Math.min(index + digits.length, 5);
      focusVerificationInput(nextIndex);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codes[index] && index > 0) {
      focusVerificationInput(index - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('');

    const newCodes = ['', '', '', '', '', ''];
    digits.forEach((digit, index) => {
      if (index < 6) {
        newCodes[index] = digit;
      }
    });

    setCodes(newCodes);
    setVerificationError('');

    if (digits.length === 6) {
      window.setTimeout(() => {
        void handleVerifySubmit(newCodes.join(''));
      }, 0);
      return;
    }

    const lastIndex = Math.min(digits.length - 1, 5);
    focusVerificationInput(lastIndex);
  };

  const handleVerifySubmit = async (codeOverride?: string) => {
    if (verificationSubmittingRef.current) return;

    const code = codeOverride ?? codes.join('');
    if (code.length !== 6) {
      setVerificationError(t('verification.invalidCode'));
      return;
    }

    setVerificationError('');
    verificationSubmittingRef.current = true;
    setVerificationLoading(true);

    try {
      const res = await authApi.login(email, code, ALL_APP_KEYS, keepLogin);
      if (!res.success || !res.data?.token) {
        const bizCode = res.bizCode;
        if (bizCode === CodeExpired) {
          const errorMessage = getErrorMessage(bizCode);
          showErrorToast(errorMessage);
          setVerificationError(errorMessage);
          setCodes(['', '', '', '', '', '']);
          setShowVerification(false);
          setCaptcha('');
          setCaptchaId('');
          setCaptchaImage('');
          void fetchCaptcha();
          return;
        } else if (bizCode && isCaptchaRelatedError(bizCode)) {
          const errorMessage = getErrorMessage(bizCode);
          setVerificationError(errorMessage);
        } else {
          const errorMessage = bizCode
            ? getErrorMessage(bizCode)
            : res.error || t('verification.incorrectCode');
          showErrorToast(errorMessage);
          setVerificationError(errorMessage);
        }
        throw new Error(res.error || t('verification.incorrectCode'));
      }

      if (res.data.items && res.data.items.length > 0) {
        gameRoleStore.setRoles(res.data.items);
      }

      const loginEmail = res.data.email || email;
      setUser({
        id: loginEmail,
        username: loginEmail,
        email: loginEmail,
        gameAccount: loginEmail,
        token: res.data.token,
      });
      setAuthToken(res.data.token);
      setEmail('');
      setShowVerification(false);
      handleClose();
    } catch {
      setVerificationError(t('verification.incorrectCode'));
      setCodes(['', '', '', '', '', '']);
      focusVerificationInput(0);
    } finally {
      verificationSubmittingRef.current = false;
      setVerificationLoading(false);
    }
  };

  const handleEmailInvalid = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const requiredMessage = t('login.emailPlaceholder');
    const invalidMessage = t('login.invalidEmail');

    if (input.validity.valueMissing) {
      input.setCustomValidity(requiredMessage);
      setEmailError(requiredMessage);
      return;
    }

    if (input.validity.typeMismatch) {
      input.setCustomValidity(invalidMessage);
      setEmailError(invalidMessage);
      return;
    }

    input.setCustomValidity('');
  };

  const isFormValid = email.trim() !== '' && agreeTerms;
  const formInlineError = captchaError || error;
  const verificationCode = codes.join('');
  const verificationCodeLength = verificationCode.length;
  const isVerificationComplete = verificationCodeLength === 6;

  const renderModalShell = (content: React.ReactNode) => (
    <div ref={overlayRef} className={styles.overlay} data-scroll-lock-overlay>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        style={
          showVerification
            ? ({ '--verification-keyboard-offset': `${verificationKeyboardOffset}px` } as React.CSSProperties)
            : undefined
        }
      >
        <button type="button" className={styles.closeButton} onClick={handleClose} aria-label="关闭">
          <img src={loginModalClose} alt="" className={styles.closeButtonImg} />
        </button>

        <div className={styles.logoWrap}>
          <img src={loginModalLogo} alt="Touka" className={styles.logoIcon} />
        </div>

        <div className={styles.modalBody}>
          <img src={loginModalLogoText} alt="TOUKA" className={styles.logoTextImg} />
          {!showVerification && (
            <p className={styles.subtitle}>{t('login.loginToStore')}</p>
          )}
          {content}
        </div>
      </div>
    </div>
  );

  const modalContent = (
    <>
      {!showVerification
        ? renderModalShell(
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.inputGroup}>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  className={styles.input}
                  placeholder={t('login.emailPlaceholder')}
                  value={email}
                  onChange={(e) => {
                    e.currentTarget.setCustomValidity('');
                    setEmail(e.target.value);
                    setEmailError('');
                    setError('');
                  }}
                  onInvalid={handleEmailInvalid}
                  required
                />
                {emailError && <span className={styles.fieldError}>{emailError}</span>}
              </div>

              <div className={styles.inputGroup}>
                <div className={styles.captchaWrapper}>
                  <input
                    type="text"
                    className={styles.captchaInput}
                    placeholder={t('login.captchaPlaceholder')}
                    value={captcha}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setCaptcha(value);
                      setCaptchaError('');
                      setError('');
                    }}
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                  />
                  <div className={styles.captchaImage}>
                    {captchaImage ? (
                      <img src={captchaImage} alt="captcha" onClick={fetchCaptcha} />
                    ) : (
                      <div className={styles.captchaSpinner} onClick={fetchCaptcha} />
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.checkboxes}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={keepLogin}
                    onChange={(e) => setKeepLogin(e.target.checked)}
                    className={styles.checkbox}
                  />
                  <span className={styles.checkboxText}>{t('login.keepLogin')}</span>
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => {
                      setAgreeTerms(e.target.checked);
                      setError('');
                    }}
                    className={styles.checkbox}
                  />
                  <span className={styles.checkboxText}>
                    {t('login.agreeTerms.prefix')}{' '}
                    <a href="/PrivacyPolicy.html" className={styles.link} target="_blank" rel="noreferrer">
                      {t('login.agreeTerms.privacy')}
                    </a>{' '}
                    {t('login.agreeTerms.and')}{' '}
                    <a href="/TermsOfService.html" className={styles.link} target="_blank" rel="noreferrer">
                      {t('login.agreeTerms.terms')}
                    </a>
                  </span>
                </label>
              </div>

              {formInlineError && (
                <div className={styles.verificationErrorMessage}>
                  <img
                    src={payLoginTipsIcon}
                    alt=""
                    className={styles.verificationErrorIcon}
                    aria-hidden
                  />
                  <span className={styles.verificationErrorText}>{formInlineError}</span>
                </div>
              )}

              <div className={styles.actions}>
                <button
                  type="submit"
                  className={`${styles.loginButton} ${isFormValid && !loading ? styles.loginButtonEnabled : ''}`}
                  disabled={!isFormValid || loading}
                >
                  <span className={styles.loginButtonText}>
                    {loading ? t('login.loading') : t('login.submit')}
                  </span>
                </button>
              </div>

              <div className={styles.noAccountLink}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => setAccountGuideVariant('default')}
                >
                  {t('login.noAccount')}
                </button>
              </div>
            </form>
          )
        : renderModalShell(
            <div className={styles.verificationBody}>
              <div className={styles.instructions}>
                <p className={styles.instructionText}>
                  {t('verification.sentTo')}{' '}
                  <span className={styles.emailText}>{email}</span>
                  {instructionSentenceEnd}
                </p>
                <p className={styles.instructionText}>
                  {t('verification.enterCode')}
                  {instructionSentenceEnd}
                </p>
              </div>

              <div className={styles.codeInputs}>
                {codes.map((code, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={code}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    className={`${styles.codeInput} ${code ? styles.codeInputFilled : ''} ${
                      verificationError ? styles.codeInputError : ''
                    }`}
                  />
                ))}
              </div>

              {verificationError && (
                <div className={styles.verificationErrorMessage}>
                  <img
                    src={payLoginTipsIcon}
                    alt=""
                    className={styles.verificationErrorIcon}
                    aria-hidden
                  />
                  <span className={styles.verificationErrorText}>{verificationError}</span>
                </div>
              )}

              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.submitButton} ${
                    isVerificationComplete
                      ? styles.submitButtonEnabled
                      : styles.submitButtonTyping
                  }`}
                  onClick={handleVerifySubmit}
                  disabled={!isVerificationComplete || verificationLoading}
                >
                  <span className={styles.loginButtonText}>
                    {verificationLoading ? t('verification.submitting') : t('verification.submit')}
                  </span>
                </button>
              </div>
            </div>
          )}

      <AccountGuideModal
        isOpen={accountGuideVariant !== null}
        variant={accountGuideVariant === 'bindGuide' ? 'bindGuide' : 'default'}
        onClose={() => setAccountGuideVariant(null)}
      />
    </>
  );

  return createPortal(modalContent, document.body);
};
