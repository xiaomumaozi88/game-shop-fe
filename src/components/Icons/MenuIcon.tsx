import React from 'react';
import expandIconImg from '@/assets/img2/touka_home_ic_expand.png';

export const MenuIcon: React.FC<{ size?: number }> = ({ size = 24 }) => {
  return (
    <img
      src={expandIconImg}
      alt="菜单"
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
      }}
    />
  );
};

