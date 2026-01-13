import React from 'react';
import gameListIconImg from '@/assets/imgs/touka_home_ic_gamelist.png';

export const EyeIcon: React.FC<{ size?: number }> = ({ size = 20 }) => {
  return (
    <img
      src={gameListIconImg}
      alt="游戏列表"
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
      }}
    />
  );
};

