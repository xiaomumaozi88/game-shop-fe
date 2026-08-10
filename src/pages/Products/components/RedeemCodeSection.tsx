import React from 'react';
import styles from '../Products.module.less';

interface RedeemCodeSectionProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  t: (key: string) => string;
}

export const RedeemCodeSection: React.FC<RedeemCodeSectionProps> = ({
  value,
  onChange,
  onSubmit,
  t,
}) => {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim()) return;
    onSubmit();
  };

  return (
    <form className={styles.redeemCodeSectionCard} onSubmit={handleSubmit}>
      <label className={styles.redeemCodeSectionLabel} htmlFor="redeem-code-entry">
        {t('redeemCode.giftCodeLabel')}
      </label>
      <input
        id="redeem-code-entry"
        className={styles.redeemCodeSectionInput}
        type="text"
        value={value}
        placeholder={t('redeemCode.giftCodePlaceholder')}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onChange(value.trim())}
      />
      <button
        type="submit"
        className={styles.redeemCodeSectionSubmit}
        disabled={!value.trim()}
      >
        {t('redeemCode.submit')}
      </button>
    </form>
  );
};
