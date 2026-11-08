'use client';

import React, { useState, useRef } from 'react';
import { Droplets } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface LiquidRippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'dark';
  showIcon?: boolean;
}

interface WaterDropRipple {
  id: number;
  x: number;
  y: number;
}

export const LiquidRippleButton: React.FC<LiquidRippleButtonProps> = ({
  children = 'Water Ripple',
  variant = 'secondary',
  showIcon = true,
  className,
  onPointerDown,
  ...props
}) => {
  const [ripples, setRipples] = useState<WaterDropRipple[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isPrimary = variant === 'primary';

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const newRippleId = Date.now() + Math.random();
    setRipples((prev) => [...prev.slice(-3), { id: newRippleId, x, y }]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRippleId));
    }, 750);

    onPointerDown?.(event);
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handlePointerDown}
      className={cn(
        'group relative inline-flex min-h-11 items-center justify-center overflow-hidden rounded-xl px-6 py-2.5 text-xs sm:text-sm font-semibold tracking-tight select-none cursor-pointer transition-all duration-200 active:scale-[0.98]',
        variant === 'dark'
          ? 'bg-[#0F172A] text-white hover:bg-[#1E293B] shadow-xs'
          : isPrimary
          ? 'bg-[#FAFAFA] text-[#050505] hover:bg-white shadow-xs'
          : 'border border-[#E6E6E1] bg-white text-[#0F172A] hover:bg-[#FAF9F6] shadow-2xs',
        className
      )}
      {...props}
    >
      <style>{`
        @keyframes easyui-wave-flow-1 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes easyui-wave-flow-2 {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        @keyframes easyui-liquid-ripple {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
        }
      `}</style>

      {/* Ripple Effects on click */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          aria-hidden="true"
          className="pointer-events-none absolute w-16 h-16 rounded-full border-2 border-cyan-400 bg-cyan-400/20"
          style={{
            left: ripple.x,
            top: ripple.y,
            animation: 'easyui-liquid-ripple 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        />
      ))}

      {/* Button Content */}
      <span className="relative z-10 inline-flex items-center gap-2 font-medium">
        {showIcon && (
          <Droplets
            className={cn(
              'h-4 w-4 transition-all duration-300',
              isHovered ? 'scale-110 text-[#00D2FF] rotate-12' : 'opacity-80 text-current'
            )}
          />
        )}
        <span>{children}</span>
      </span>
    </button>
  );
};

export default LiquidRippleButton;
