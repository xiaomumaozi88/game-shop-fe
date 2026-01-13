import React from 'react';
import switchIconImg from '@/assets/imgs/touka_home_ic_switch.png';

export const SwitchIcon: React.FC<{ size?: number }> = ({ size = 16 }) => {
  return (
    <img
      src={switchIconImg}
      alt="切换游戏区组"
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
      }}
      aria-label="切换游戏区组"
    />
  );
};

