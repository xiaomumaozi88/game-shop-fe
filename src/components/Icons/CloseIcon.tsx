import React from 'react';
import closeIconImg from '@/assets/imgs/touka_home_ic_close.png';

export const CloseIcon: React.FC<{ size?: number }> = ({ size = 24 }) => {
  return (
    <img
      src={closeIconImg}
      alt="关闭"
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
      }}
    />
  );
};

