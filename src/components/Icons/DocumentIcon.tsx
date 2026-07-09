import React from 'react';
import orderIconImg from '@/assets/img2/touka_home_ic_order.png';

export const DocumentIcon: React.FC<{ size?: number }> = ({ size = 20 }) => {
  return (
    <img
      src={orderIconImg}
      alt="我的订单"
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
      }}
    />
  );
};

