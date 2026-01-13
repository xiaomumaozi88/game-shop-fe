import React from 'react';

interface ChevronRightIconProps {
  className?: string;
  color?: string;
}

export const ChevronRightIcon: React.FC<ChevronRightIconProps> = ({
  className,
  color = '#ffffff',
}) => {
  return (
    <svg
      className={className}
      viewBox="0 0 1024 1024"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
    >
      <path
        d="M368.553282 253.651376c0-6.503881 2.16796-13.007763 7.226535-18.066337 10.117149-10.117149 26.015526-10.117149 35.410021 0l231.971771 231.971771c10.117149 10.117149 15.898377 23.847565 15.898377 39.023289s-5.781228 28.183486-15.898377 39.023288l-231.249118 231.249118c-10.117149 10.117149-26.015526 10.117149-35.410021 0-10.117149-10.117149-10.117149-26.015526 0-35.410021l231.249118-231.249118c2.16796-2.16796 2.16796-4.335921 0-5.781228l-231.249118-232.694425c-5.058574-5.058574-7.949188-11.562456-7.949188-18.066337z"
        fill={color}
        stroke={color}
        strokeWidth="40"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

