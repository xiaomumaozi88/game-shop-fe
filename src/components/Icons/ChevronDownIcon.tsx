import React from 'react';

interface ChevronDownIconProps {
  className?: string;
  color?: string;
}

export const ChevronDownIcon: React.FC<ChevronDownIconProps> = ({
  className,
  color = '#585858',
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
        d="M770.348624 368.553282c6.503881 0 13.007763 2.16796 18.066337 7.226535 10.117149 10.117149 10.117149 26.015526 0 35.410021l-231.971771 231.971771c-10.117149 10.117149-23.847565 15.898377-39.023289 15.898377s-28.183486-5.781228-39.023288-15.898377l-231.249118-231.249118c-10.117149-10.117149-10.117149-26.015526 0-35.410021 10.117149-10.117149 26.015526-10.117149 35.410021 0l231.249118 231.249118c2.16796 2.16796 4.335921 2.16796 5.781228 0l232.694425-231.249118c5.058574-5.058574 11.562456-7.949188 18.066337-7.949188z"
        fill={color}
        stroke={color}
        strokeWidth="40"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

