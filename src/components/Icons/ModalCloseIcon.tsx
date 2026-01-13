import React from 'react';

interface ModalCloseIconProps {
  className?: string;
  size?: number;
}

export const ModalCloseIcon: React.FC<ModalCloseIconProps> = ({
  className,
  size = 24,
}) => {
  return (
    <svg
      className={className}
      viewBox="0 0 1024 1024"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
    >
      <path
        d="M821.24 935.991c31.687 31.688 83.063 31.688 114.751 0 31.688-31.688 31.688-83.064 0-114.752L202.518 87.766c-31.688-31.688-83.064-31.688-114.752 0-31.688 31.688-31.688 83.064 0 114.752L821.239 935.99z"
        fill="currentColor"
      />
      <path
        d="M202.518 935.991c-31.688 31.688-83.064 31.688-114.752 0-31.688-31.688-31.688-83.064 0-114.752L821.239 87.766c31.688-31.688 83.064-31.688 114.752 0 31.688 31.688 31.688 83.064 0 114.752L202.518 935.99z"
        fill="currentColor"
      />
    </svg>
  );
};

