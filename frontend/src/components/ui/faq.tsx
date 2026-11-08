'use client';

import React, { useState, useId } from 'react';
import { ChevronDown, Plus, Minus, Search, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FAQItem {
  id: string;
  question: string;
  answer: React.ReactNode;
  category?: string;
  badge?: string;
  icon?: React.ReactNode;
}

export interface FAQProps {
  /** List of FAQ items */
  items: FAQItem[];
  /** Allow multiple items to be expanded simultaneously */
  allowMultiple?: boolean;
  /** Initial open item IDs (uncontrolled) */
  defaultOpen?: string[] | string;
  /** Explicit open item IDs (controlled) */
  openIds?: string[];
  /** Callback fired when open items change */
  onOpenChange?: (ids: string[]) => void;
  /** Visual indicator icon style: chevron or plus-minus */
  iconStyle?: 'chevron' | 'plus-minus' | 'custom';
  /** Custom open/closed icon renderer */
  renderIcon?: (isOpen: boolean) => React.ReactNode;
  /** Enable search filter bar */
  searchable?: boolean;
  /** Placeholder text for search bar */
  searchPlaceholder?: string;
  /** Enable category filter tabs */
  showCategories?: boolean;
  /** Card visual layout presentation: single card container or separated individual cards */
  variant?: 'unified' | 'separated';
  /** Additional container styling */
  className?: string;
}

export const FAQ: React.FC<FAQProps> = ({
  items = [],
  allowMultiple = false,
  defaultOpen,
  openIds: controlledOpenIds,
  onOpenChange,
  iconStyle = 'chevron',
  renderIcon,
  searchable = false,
  searchPlaceholder = 'Search questions...',
  showCategories = false,
  variant = 'unified',
  className,
}) => {
  const defaultInitial = defaultOpen
    ? Array.isArray(defaultOpen)
      ? defaultOpen
      : [defaultOpen]
    : [];

  const [internalOpenIds, setInternalOpenIds] = useState<string[]>(defaultInitial);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const baseId = useId();

  const isControlled = controlledOpenIds !== undefined;
  const activeOpenIds = isControlled ? controlledOpenIds : internalOpenIds;

  // Extract unique categories if requested
  const categories = React.useMemo(() => {
    if (!showCategories) return [];
    const cats = new Set<string>();
    items.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return cats.size > 0 ? ['All', ...Array.from(cats)] : [];
  }, [items, showCategories]);

  // Filter items based on search and category
  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      const matchCategory =
        selectedCategory === 'All' || item.category === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (typeof item.answer === 'string' &&
          item.answer.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  const toggleItem = (id: string) => {
    let nextIds: string[];
    if (allowMultiple) {
      nextIds = activeOpenIds.includes(id)
        ? activeOpenIds.filter((item) => item !== id)
        : [...activeOpenIds, id];
    } else {
      nextIds = activeOpenIds.includes(id) ? [] : [id];
    }

    if (!isControlled) {
      setInternalOpenIds(nextIds);
    }
    if (onOpenChange) {
      onOpenChange(nextIds);
    }
  };

  const renderItemIndicator = (isOpen: boolean) => {
    if (renderIcon) {
      return renderIcon(isOpen);
    }

    if (iconStyle === 'plus-minus') {
      return (
        <span className="relative flex items-center justify-center w-5 h-5 shrink-0 text-[#64748B] group-hover:text-[#0F172A] transition-colors">
          <Plus
            className={cn(
              "w-4 h-4 transition-all duration-200",
              isOpen ? "rotate-90 opacity-0 scale-50" : "rotate-0 opacity-100 scale-100"
            )}
          />
          <Minus
            className={cn(
              "w-4 h-4 absolute transition-all duration-200",
              isOpen ? "rotate-0 opacity-100 scale-100" : "-rotate-90 opacity-0 scale-50"
            )}
          />
        </span>
      );
    }

    return (
      <ChevronDown
        className={cn(
          "w-4 h-4 text-[#64748B] group-hover:text-[#0F172A] transition-transform duration-200 shrink-0",
          isOpen && "rotate-180 text-[#0F172A]"
        )}
      />
    );
  };

  return (
    <div className={cn('w-full max-w-3xl mx-auto space-y-4', className)}>
      {/* Optional Search Bar */}
      {searchable && (
        <div className="relative">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-10 pl-10 pr-4 text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-[#FAF9F6] border border-[#E6E6E1] rounded-xl focus:border-[#0F172A] focus:outline-none transition-colors"
          />
        </div>
      )}

      {/* Optional Category Filter Pills */}
      {showCategories && categories.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer',
                selectedCategory === cat
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F4F4F0] border border-transparent'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* FAQ Items List */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center rounded-xl border border-[#E6E6E1] bg-[#FAF9F6]">
          <HelpCircle className="w-6 h-6 text-[#94A3B8] mx-auto mb-2 opacity-60" />
          <p className="text-xs text-[#64748B]">No matching questions found.</p>
        </div>
      ) : variant === 'separated' ? (
        /* Separated Cards Mode */
        <div className="space-y-2.5">
          {filteredItems.map((item) => {
            const isOpen = activeOpenIds.includes(item.id);
            const contentId = `${baseId}-content-${item.id}`;
            const headerId = `${baseId}-header-${item.id}`;

            return (
              <div
                key={item.id}
                className={cn(
                  'rounded-xl border transition-all duration-200 overflow-hidden',
                  isOpen
                    ? 'border-[#CBD5E1] bg-white shadow-card'
                    : 'border-[#E6E6E1] bg-white hover:border-[#CBD5E1]'
                )}
              >
                <button
                  id={headerId}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  className="group flex w-full items-center justify-between p-4 sm:p-5 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 pr-4">
                    {item.icon && (
                      <span className="text-[#64748B] group-hover:text-[#0F172A] transition-colors shrink-0">
                        {item.icon}
                      </span>
                    )}
                    <div>
                      <div className="text-xs sm:text-sm font-semibold text-[#0F172A] group-hover:text-black transition-colors">
                        {item.question}
                      </div>
                      {item.badge && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono leading-none bg-[#F4F4F0] border border-[#E6E6E1] text-[#64748B]">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                  {renderItemIndicator(isOpen)}
                </button>

                <div
                  id={contentId}
                  role="region"
                  aria-labelledby={headerId}
                  className={cn(
                    "grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-xs sm:text-sm text-[#52525B] leading-relaxed border-t border-[#E6E6E1] pt-3">
                      {item.answer}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Unified Accordion Card Mode */
        <div className="flex flex-col divide-y divide-[#E6E6E1] rounded-xl border border-[#E6E6E1] bg-white overflow-hidden shadow-xs">
          {filteredItems.map((item) => {
            const isOpen = activeOpenIds.includes(item.id);
            const contentId = `${baseId}-content-${item.id}`;
            const headerId = `${baseId}-header-${item.id}`;

            return (
              <div key={item.id} className="transition-colors">
                <button
                  id={headerId}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  className="group flex w-full items-center justify-between p-4 sm:p-5 text-left text-[#0F172A] hover:bg-[#FAF9F6] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 pr-4">
                    {item.icon && (
                      <span className="text-[#64748B] group-hover:text-[#0F172A] transition-colors shrink-0">
                        {item.icon}
                      </span>
                    )}
                    <div>
                      <div className="text-xs sm:text-sm font-semibold text-[#0F172A] group-hover:text-black transition-colors">
                        {item.question}
                      </div>
                      {item.badge && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono leading-none bg-[#F4F4F0] border border-[#E6E6E1] text-[#64748B]">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                  {renderItemIndicator(isOpen)}
                </button>

                <div
                  id={contentId}
                  role="region"
                  aria-labelledby={headerId}
                  className={cn(
                    "grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 text-xs sm:text-sm text-[#52525B] leading-relaxed">
                      {item.answer}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};