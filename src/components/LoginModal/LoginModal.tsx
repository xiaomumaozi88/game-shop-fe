import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useUser } from '@/hooks/useUser';
import { CloseIcon } from '../Icons/CloseIcon';
import { AccountGuideModal } from '../AccountGuideModal/AccountGuideModal';
import { authApi, setAuthToken } from '@/utils/api';
import { gameRoleStore } from '@/store/gameRoleStore';
import { getErrorMessage, isCaptchaRelatedError, showErrorToast } from '@/utils/errorHandler';
import { EmailInvalid, EmailCouldNotBeEmpty } from '@/utils/bizCodes';
import idIcon from '@/assets/imgs/touka_login_ID_WH.png';
import goIcon from '@/assets/imgs/touka_login_ic_go.png';
import mailIcon from '@/assets/imgs/touka_login_ic_mail.png';
import styles from './LoginModal.module.less';

// 所有游戏的 app_key 列表
const ALL_APP_KEYS = [
  'f6594168ce3a9cc57ab7ed74426e25e1', // BamBamSquad
  '45a56d38bbdd60353438aa25d1ccff20', // Oopsie Croco
];

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const { setUser } = useUser();
  const [email, setEmail] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [keepLogin, setKeepLogin] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState(''); // 邮箱错误信息（显示在输入框下）
  const [captchaError, setCaptchaError] = useState(''); // 验证码错误信息（显示在输入框下）
  const [loading, setLoading] = useState(false);
  const [accountGuideOpen, setAccountGuideOpen] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  // 验证码相关状态
  const [codes, setCodes] = useState<string[]>(['', '', '', '', '', '']);
  const [verificationError, setVerificationError] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  // 当弹窗关闭时，重置所有状态
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setCaptcha('');
      setKeepLogin(false);
      setAgreeTerms(true);
      setError('');
      setEmailError('');
      setCaptchaError('');
      setLoading(false);
      setShowVerification(false);
      setCodes(['', '', '', '', '', '']);
      setVerificationError('');
      setVerificationLoading(false);
      setCaptcha('');
      setCaptchaId('');
      setCaptchaImage('');
    } else {
      fetchCaptcha();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');
    setCaptchaError('');
    setLoading(true);

    // 验证图形验证码：必须是4位数字
    if (!captcha || captcha.length !== 4 || !/^\d{4}$/.test(captcha)) {
      setCaptchaError(t('login.invalidCaptcha') || '请输入4位数字验证码');
      setLoading(false);
      return;
    }

    // 验证邮箱格式
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(t('login.invalidEmail') || '请输入有效的邮箱地址');
      setLoading(false);
      return;
    }

    // 验证是否有图形验证码ID
    if (!captchaId) {
      setCaptchaError(t('login.captchaPlaceholder') || '请先获取图形验证码');
      setLoading(false);
      fetchCaptcha(); // 重新获取验证码
      return;
    }

    try {
      // 调用发送邮箱验证码接口，同时校验图形验证码
      const sendCodeRes = await authApi.sendCode({
        email,
        type: 'login',
        captcha_id: captchaId,
        captcha_code: captcha,
      });

      if (!sendCodeRes.success) {
        // 发送失败，根据 biz_code 判断错误类型
        const bizCode = sendCodeRes.bizCode;
        if (bizCode && isCaptchaRelatedError(bizCode)) {
          // 验证码相关错误，显示在输入框下
          const errorMessage = getErrorMessage(bizCode);
          // 判断是邮箱错误还是验证码错误
          if (bizCode === EmailInvalid || bizCode === EmailCouldNotBeEmpty) {
            // EmailInvalid 或 EmailCouldNotBeEmpty
            setEmailError(errorMessage);
          } else {
            // 其他验证码相关错误
            setCaptchaError(errorMessage);
          }
          fetchCaptcha(); // 刷新图形验证码
          setCaptcha(''); // 清空验证码输入
        } else {
          // 非验证码相关错误，使用 toast 显示
          const errorMessage = bizCode ? getErrorMessage(bizCode) : (sendCodeRes.error || t('login.sendCodeFailed') || '发送验证码失败');
          showErrorToast(errorMessage);
        }
        setLoading(false);
        return;
      }

      // 发送成功，进入邮箱验证码输入步骤
      setShowVerification(true);
      setCodes(['', '', '', '', '', '']);
      setVerificationError('');
      setLoading(false);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      // 网络错误等异常
      const errorMessage = err instanceof Error ? err.message : (t('login.sendCodeFailed') || '发送验证码失败');
      showErrorToast(errorMessage);
      fetchCaptcha(); // 刷新图形验证码
      setCaptcha(''); // 清空验证码输入
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // 只允许数字
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newCodes = [...codes];
    newCodes[index] = value;
    setCodes(newCodes);
    setVerificationError('');

    // 自动聚焦下一个输入框
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // 处理退格键
    if (e.key === 'Backspace' && !codes[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
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

    // 聚焦到最后一个有值的输入框，或最后一个输入框
    const lastIndex = Math.min(digits.length - 1, 5);
    inputRefs.current[lastIndex]?.focus();
  };

  const handleVerifySubmit = async () => {
    const code = codes.join('');
    if (code.length !== 6) {
      setVerificationError(t('verification.invalidCode'));
      return;
    }

    setVerificationError('');
    setVerificationLoading(true);

    try {
      const res = await authApi.login(email, code, ALL_APP_KEYS, keepLogin);
      if (!res.success || !res.data?.token) {
        // 处理登录错误
        const bizCode = res.bizCode;
        if (bizCode && isCaptchaRelatedError(bizCode)) {
          // 验证码相关错误，显示在输入框下
          const errorMessage = getErrorMessage(bizCode);
          setVerificationError(errorMessage);
        } else {
          // 非验证码相关错误，使用 toast 显示
          const errorMessage = bizCode ? getErrorMessage(bizCode) : (res.error || t('verification.incorrectCode'));
          showErrorToast(errorMessage);
          setVerificationError(errorMessage); // 同时也在输入框下显示
        }
        throw new Error(res.error || t('verification.incorrectCode'));
      }

      // 保存角色列表到 gameRoleStore
      if (res.data.items && res.data.items.length > 0) {
        gameRoleStore.setRoles(res.data.items);
      }

      const loginEmail = res.data.email || email; // 优先使用接口返回的 email
      setUser({
        id: loginEmail, // 后端未返回用户ID，暂以邮箱占位
        username: loginEmail,
        email: loginEmail, // 保存登录邮箱
        gameAccount: loginEmail,
        token: res.data.token,
      });
      setAuthToken(res.data.token);
      setShowVerification(false);
      onClose();
    } catch (err) {
      setVerificationError(t('verification.incorrectCode'));
      // 清空输入框
      setCodes(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleResendCode = async () => {
    setVerificationError('');
    setLoading(true);
    
    // 重新获取图形验证码
    await fetchCaptcha();
    setCaptcha('');
    
    // 调用发送邮箱验证码接口
    if (!captchaId) {
      setVerificationError(t('login.captchaPlaceholder') || '请先获取图形验证码');
      setLoading(false);
      return;
    }

    try {
      // 需要重新输入图形验证码才能重发邮箱验证码
      // 这里我们返回登录界面让用户重新输入图形验证码
      setShowVerification(false);
      setLoading(false);
      setError(t('login.resendCodePrompt') || '请重新输入图形验证码以重新发送邮箱验证码');
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : (t('login.sendCodeFailed') || '发送验证码失败'));
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowVerification(false);
    setCodes(['', '', '', '', '', '']);
    setVerificationError('');
  };

  const isFormValid = email.trim() !== '' && agreeTerms;

  return (
    <>
      <div className={styles.overlay} onClick={handleBackdropClick}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

          {/* TOUKA ID 头部 */}
          <div className={styles.header}>
            <div className={styles.logoSection}>
              <span className={styles.logoText}>TOUKA</span>
              <img src={idIcon} alt="ID" className={styles.idBadge} />
            </div>
          </div>

          {!showVerification ? (
            <>
              {/* 登录提示 */}
              <div className={styles.loginPrompt}>
                <img src={goIcon} alt="go" className={styles.arrowIcon} />
                <span className={styles.promptText}>{t('login.loginToStore')}</span>
              </div>

              <form className={styles.form} onSubmit={handleSubmit}>
            {/* 邮箱输入 */}
            <div className={styles.inputGroup}>
              <input
                type="email"
                className={styles.input}
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError('');
                }}
                required
              />
              {emailError && (
                <span className={styles.fieldError}>{emailError}</span>
              )}
            </div>

            {/* 验证码输入 */}
            <div className={styles.inputGroup}>
              <div className={styles.captchaWrapper}>
                <input
                  type="text"
                  className={styles.captchaInput}
                  placeholder={t('login.captchaPlaceholder')}
                  value={captcha}
                  onChange={(e) => {
                    // 只允许输入数字，最多4位
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setCaptcha(value);
                    // 清除错误提示
                    setCaptchaError('');
                  }}
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  required
                />
                <div className={styles.captchaImage}>
                  {captchaImage ? (
                    <img
                      src={captchaImage}
                      alt="captcha"
                      onClick={fetchCaptcha}
                    />
                  ) : (
                    <div className={styles.captchaSpinner} onClick={fetchCaptcha} />
                  )}
                </div>
              </div>
              {captchaError && (
                <span className={styles.fieldError}>{captchaError}</span>
              )}
            </div>

            {/* 复选框 */}
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
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxText}>
                  {t('login.agreeTerms.prefix')}
                  <a href="/PrivacyPolicy.html" className={styles.link}>{t('login.agreeTerms.privacy')}</a>
                  {t('login.agreeTerms.and')}
                  <a href="/TermsOfService.html" className={styles.link}>{t('login.agreeTerms.terms')}</a>
                
                </span>
              </label>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className={styles.errorMessage}>
                <span className={styles.errorIcon}>⚠</span>
                <span className={styles.errorText}>{error}</span>
              </div>
            )}

            {/* 按钮 */}
            <div className={styles.actions}>
              <button
                type="submit"
                className={`${styles.loginButton} ${isFormValid && !loading ? styles.loginButtonEnabled : ''}`}
                disabled={!isFormValid || loading}
                onClick={!isFormValid || loading ? (e) => e.preventDefault() : undefined}
              >
                {loading ? t('login.loading') : t('login.submit')}
              </button>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onClose}
              >
                {t('login.cancel')}
              </button>
            </div>

            {/* 还没有账号链接 */}
            {/* <div className={styles.noAccountLink}>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => setAccountGuideOpen(true)}
              >
                {t('login.noAccount')}
              </button>
            </div> */}
          </form>
            </>
          ) : (
            <>
              {/* 邮件图标 */}
              <div className={styles.emailIcon}>
                <img src={mailIcon} alt="mail" className={styles.mailIconImg} />
              </div>

              {/* 提示文字 */}
              <div className={styles.instructions}>
                <p className={styles.instructionText}>
                  {t('verification.sentTo')}{' '}
                  <span className={styles.emailText}>{email}</span>
                </p>
                <p className={styles.instructionText}>{t('verification.enterCode')}</p>
              </div>

              {/* 验证码输入框 */}
              <div className={styles.codeInputs}>
                {codes.map((code, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
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

              {/* 错误提示 */}
              {verificationError && (
                <div className={styles.errorMessage}>
                  <span className={styles.errorText}>{verificationError}</span>
                </div>
              )}

              {/* 按钮 */}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.submitButton} ${
                    codes.every((code) => code !== '') && codes.join('').length === 6
                      ? styles.submitButtonEnabled
                      : ''
                  }`}
                  onClick={handleVerifySubmit}
                  disabled={codes.join('').length !== 6 || verificationLoading}
                >
                  {verificationLoading ? t('verification.submitting') : t('verification.submit')}
                </button>
                <button type="button" className={styles.backButton} onClick={handleBackToLogin}>
                  {t('verification.back')}
                </button>
              </div>

              {/* 收不到验证码链接暂时隐藏 */}
              {/* <div className={styles.troubleshootLink}>
                <button type="button" className={styles.linkButton} onClick={handleResendCode}>
                  {t('verification.noCode')}
                </button>
              </div> */}
            </>
          )}
        </div>
      </div>

      <AccountGuideModal
        isOpen={accountGuideOpen}
        onClose={() => setAccountGuideOpen(false)}
      />
    </>
  );
};

