import React, { useMemo, useRef } from 'react';
import { SwitchIcon } from '@/components/Icons/SwitchIcon';
import { useFitTextGroup } from '@/hooks/useFitText';
import { useResponsive } from '@/hooks/useResponsive';
import styles from './ProductsUserPanel.module.less';

interface ProductsUserPanelRoleRowProps {
  roleName: string;
  serverText: string;
  switchServerLabel: string;
  onSwitchServer: () => void;
}

const ROLE_ROW_MIN_FONT_SIZE: Record<'mobile' | 'tablet' | 'desktop', number> = {
  mobile: 7,
  tablet: 8,
  desktop: 9,
};

export const ProductsUserPanelRoleRow: React.FC<ProductsUserPanelRoleRowProps> = ({
  roleName,
  serverText,
  switchServerLabel,
  onSwitchServer,
}) => {
  const roleNameRef = useRef<HTMLSpanElement>(null);
  const serverTextRef = useRef<HTMLSpanElement>(null);
  const { breakpoint } = useResponsive();
  const textRefs = useMemo(() => [roleNameRef, serverTextRef], []);

  useFitTextGroup(textRefs, [roleName, serverText], {
    minFontSize: ROLE_ROW_MIN_FONT_SIZE[breakpoint],
  });

  return (
    <div className={styles.roleRow}>
      <div className={styles.roleRowTextGroup}>
        <button type="button" className={styles.roleName} onClick={onSwitchServer}>
          <span ref={roleNameRef} className={styles.roleNameText}>
            {roleName}
          </span>
        </button>
        <span className={styles.serverTextWrap}>
          <span ref={serverTextRef} className={styles.serverText}>
            {serverText}
          </span>
        </span>
      </div>
      <button
        type="button"
        className={styles.switchButton}
        onClick={onSwitchServer}
        aria-label={switchServerLabel}
      >
        <SwitchIcon size={16} />
      </button>
    </div>
  );
};
