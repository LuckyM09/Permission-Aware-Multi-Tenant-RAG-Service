'use client';

import React from 'react';
import { cn } from '../../lib/utils';

export interface HamburgerMenuProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  /** Current opened/closed state. */
  isOpen: boolean;
  /** State change callback handler. */
  onChange: (isOpen: boolean) => void;
  /** Icon bounding box dimensions in pixels. Default is 24. */
  size?: number;
  /** Color of the menu stroke lines. Default is 'currentColor'. */
  color?: string;
  /** Accessible label. Default is 'Menu'. */
  label?: string;
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
  isOpen,
  onChange,
  size = 24,
  color = 'currentColor',
  label = 'Menu',
  disabled = false,
  className,
  ...props
}) => {
  const lineSpacing = size * 0.28;
  const strokeWidth = Math.max(2, size * 0.08);

  const handleClick = () => {
    if (disabled) return;
    onChange(!isOpen);
  };

  const strokeColor = color !== 'currentColor' ? color : '#0F172A';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-expanded={isOpen}
      aria-label={isOpen ? `Close ${label}` : `Open ${label}`}
      className={cn(
        'relative inline-flex items-center justify-center rounded-xl p-2 text-[#0F172A] hover:bg-[#F4F4F0] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer',
        className
      )}
      {...props}
    >
      <div
        style={{ width: size, height: size }}
        className="relative flex flex-col items-center justify-center pointer-events-none"
      >
        {/* Top Line */}
        <span
          style={{
            width: size,
            height: strokeWidth,
            backgroundColor: strokeColor,
            transform: isOpen ? `translateY(0) rotate(45deg)` : `translateY(-${lineSpacing}px) rotate(0deg)`,
          }}
          className="absolute rounded-full transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
        />

        {/* Middle Line */}
        <span
          style={{
            width: size,
            height: strokeWidth,
            backgroundColor: strokeColor,
            opacity: isOpen ? 0 : 1,
            transform: isOpen ? 'scaleX(0.2)' : 'scaleX(1)',
          }}
          className="absolute rounded-full transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
        />

        {/* Bottom Line */}
        <span
          style={{
            width: size,
            height: strokeWidth,
            backgroundColor: strokeColor,
            transform: isOpen ? `translateY(0) rotate(-45deg)` : `translateY(${lineSpacing}px) rotate(0deg)`,
          }}
          className="absolute rounded-full transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
        />
      </div>
    </button>
  );
};
