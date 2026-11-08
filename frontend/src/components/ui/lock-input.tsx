'use client';

import React, { forwardRef, useState, useId } from 'react';
import { cn } from '../../lib/utils';

export interface LockInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visible label rendered above the input */
  label?: string;
  /** Helper text below the input */
  description?: string;
  /** Error message; presence triggers danger styling */
  error?: string;
  /** Optional icon at the start of the input */
  leftIcon?: React.ReactNode;
  /** Optional icon at the end of the input */
  rightIcon?: React.ReactNode;
}

/**
 * LockInput — Focus state subtly "locks" into place with a snappy ring transition.
 */
export const LockInput = forwardRef<HTMLInputElement, LockInputProps>(
  (
    {
      label,
      description,
      error,
      leftIcon,
      rightIcon,
      disabled,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const [isFocused, setIsFocused] = useState(false);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold text-[#0F172A] tracking-tight select-none mb-1"
          >
            {label}
          </label>
        )}

        <div className="relative w-full flex items-center">
          {leftIcon && (
            <div
              className={cn(
                'absolute left-3.5 flex items-center justify-center transition-colors duration-200 pointer-events-none z-10',
                isFocused ? 'text-[#0F172A]' : 'text-[#64748B]'
              )}
            >
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            className={cn(
              'peer w-full h-11 px-3.5 text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-[#FAF9F6] rounded-xl outline-none',
              'border border-[#E6E6E1]',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error
                ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20'
                : 'hover:border-[#CBD5E1] focus:border-[#0F172A] focus:bg-white',
              disabled && 'opacity-40 cursor-not-allowed',
              'transition-all duration-200 shadow-2xs relative z-1',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={
              description ? `${inputId}-desc` : undefined
            }
            {...props}
          />

          {/* Focus lock ring: scales in on focus */}
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 rounded-xl transition-all duration-200 ease-out",
              isFocused
                ? (error ? "ring-3 ring-rose-500/20 scale-100 opacity-100" : "ring-3 ring-[#0F172A]/10 scale-100 opacity-100")
                : "ring-0 scale-98 opacity-0"
            )}
          />

          {rightIcon && (
            <div
              className={cn(
                'absolute right-3.5 flex items-center justify-center transition-colors duration-200 pointer-events-none z-10',
                isFocused ? 'text-[#0F172A]' : 'text-[#64748B]'
              )}
            >
              {rightIcon}
            </div>
          )}
        </div>

        {description && !error && (
          <p id={`${inputId}-desc`} className="text-[11px] text-[#64748B] pl-0.5">
            {description}
          </p>
        )}

        {error && (
          <p id={`${inputId}-desc`} className="text-[11px] text-rose-600 font-medium pl-0.5">
            {error}
          </p>
        )}
      </div>
    );
  }
);

LockInput.displayName = 'LockInput';
