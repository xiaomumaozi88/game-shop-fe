import React from 'react';
import csIconImg from '@/assets/img2/touka_home_ic_cs.png';

export const MessageIcon: React.FC<{ size?: number }> = ({ size = 20 }) => {
  return (
    <img
      src={csIconImg}
      alt="联系客服"
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
      }}
    />
  );
};

