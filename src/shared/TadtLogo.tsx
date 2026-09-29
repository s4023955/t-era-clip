import React from 'react';

export function TadtLogo({ className = 'h-12 w-auto' }: { className?: string }) {
  return (
    <img
      alt="Tập đoàn Tân Á Đại Thành"
      className={className}
      src="/tadt-logo.png"
    />
  );
}
