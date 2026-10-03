'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';

export const CATEGORIES = [
  { id: 'food',          name: 'Food',          emoji: '🍔', color: '#f97316' },
  { id: 'transport',     name: 'Transport',     emoji: '🚗', color: '#3b82f6' },
  { id: 'shopping',      name: 'Shopping',      emoji: '🛍️', color: '#a855f7' },
  { id: 'entertainment', name: 'Entertainment', emoji: '🎬', color: '#ec4899' },
  { id: 'health',        name: 'Health',        emoji: '💊', color: '#22c55e' },
  { id: 'bills',         name: 'Bills',         emoji: '🧾', color: '#eab308' },
  { id: 'travel',        name: 'Travel',        emoji: '✈️', color: '#06b6d4' },
  { id: 'education',     name: 'Education',     emoji: '📚', color: '#8b5cf6' },
  { id: 'other',         name: 'Other',         emoji: '💸', color: '#9ca3af' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

interface CategoryPickerProps {
  selected: string;
  onSelect: (id: string) => void;
}

// memo: only re-renders when selected or onSelect changes
export const CategoryPicker = memo(function CategoryPicker({
  selected,
  onSelect,
}: CategoryPickerProps) {
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
      {CATEGORIES.map((cat) => {
        const isSelected = selected === cat.id;
        return (
          // Pure button — no motion overhead for 9 buttons tapped once
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className="flex flex-col items-center gap-1.5 shrink-0 active:scale-90 transition-transform duration-100"
          >
            <div
              className={cn(
                'relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl',
                'transition-all duration-200',
                !isSelected && 'bg-[#1a1a24] border border-[#1f1f2e]',
              )}
              style={
                isSelected
                  ? {
                      background: `${cat.color}22`,
                      border: `2px solid ${cat.color}`,
                      boxShadow: `0 2px 12px ${cat.color}30`,
                    }
                  : {}
              }
            >
              {cat.emoji}
              {isSelected && (
                <div
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: cat.color }}
                >
                  <span className="text-[8px] text-white font-bold">✓</span>
                </div>
              )}
            </div>
            <span
              className={cn(
                'text-[11px] font-medium transition-colors duration-150',
                isSelected ? 'text-white' : 'text-[#9ca3af]',
              )}
            >
              {cat.name}
            </span>
          </button>
        );
      })}
    </div>
  );
});

export function getCategoryById(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
