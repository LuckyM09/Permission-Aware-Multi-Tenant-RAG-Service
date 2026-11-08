'use client';

import React, { useState, useRef } from 'react';
import { Search, X, Command } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ExpandableSearchProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
  variant?: 'light' | 'dark';
}

export const ExpandableSearch: React.FC<ExpandableSearchProps> = ({
  placeholder = 'Search documents, logs, users...',
  onSearch,
  className,
  variant = 'light',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isLight = variant === 'light';

  const handleOpen = () => {
    setIsExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleClose = () => {
    setIsExpanded(false);
    setValue('');
    onSearch?.('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    onSearch?.(e.target.value);
  };

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <div
        className={cn(
          "flex items-center h-9 px-3 rounded-xl border shadow-2xs cursor-text transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isExpanded ? "w-64 sm:w-72" : "w-40 sm:w-48",
          isLight
            ? (isExpanded ? "border-[#0F172A] bg-white ring-2 ring-[#0F172A]/5" : "border-[#E6E6E1] bg-white hover:border-[#CBD5E1]")
            : (isExpanded ? "border-[#4A4A4A] bg-[#141414]" : "border-[#1F1F1F] bg-[#0E0E0E]")
        )}
        onClick={handleOpen}
      >
        <Search className={cn("w-3.5 h-3.5 shrink-0 mr-2", isLight ? "text-[#64748B]" : "text-[#525252]")} />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => setIsExpanded(true)}
          onBlur={() => !value && setIsExpanded(false)}
          placeholder={isExpanded ? placeholder : 'Filter items...'}
          className={cn(
            "w-full bg-transparent text-xs font-medium focus:outline-none",
            isLight ? "text-[#0F172A] placeholder:text-[#94A3B8]" : "text-[#FAFAFA] placeholder:text-[#6B6B6B]"
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className={cn("p-0.5 rounded transition-colors cursor-pointer shrink-0 ml-1", isLight ? "text-[#64748B] hover:text-[#0F172A]" : "text-[#525252] hover:text-[#FAFAFA]")}
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div
            className={cn(
              "hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 select-none border ml-1",
              isLight ? "bg-[#F4F4F0] border-[#E6E6E1] text-[#64748B]" : "bg-[#141414] border-[#1F1F1F] text-[#6B6B6B]"
            )}
          >
            <Command className="w-2.5 h-2.5" />
            <span>F</span>
          </div>
        )}
      </div>
    </div>
  );
};
