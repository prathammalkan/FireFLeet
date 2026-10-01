'use client';

import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export const CATEGORIES = [
  { id: 'food', name: 'Food', emoji: '🍔', color: '#f97316' },
  { id: 'transport', name: 'Transport', emoji: '🚗', color: '#3b82f6' },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️', color: '#a855f7' },
  { id: 'entertainment', name: 'Entertainment', emoji: '🎬', color: '#ec4899' },
  { id: 'health', name: 'Health', emoji: '💊', color: '#22c55e' },
  { id: 'bills', name: 'Bills', emoji: '🧾', color: '#eab308' },
  { id: 'travel', name: 'Travel', emoji: '✈️', color: '#06b6d4' },
  { id: 'education', name: 'Education', emoji: '📚', color: '#8b5cf6' },
  { id: 'other', name: 'Other', emoji: '💸', color: '#9ca3af' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

interface CategoryPickerProps {
  selected: string;
  onSelect: (id: string) => void;
}

export function CategoryPicker({ selected, onSelect }: CategoryPickerProps) {
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
      {CATEGORIES.map((cat, i) => {
        const isSelected = selected === cat.id;
        return (
          <motion.button
            key={cat.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 25 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onSelect(cat.id)}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div
              className={cn(
                'relative w-14 h-14 rounded-2xl flex items-center justify-center',
                'text-2xl transition-all duration-200',
                isSelected
                  ? 'scale-110 shadow-lg'
                  : 'bg-[#1a1a24] border border-[#1f1f2e]'
              )}
              style={
                isSelected
                  ? {
                      background: `${cat.color}25`,
                      border: `2px solid ${cat.color}`,
                      boxShadow: `0 4px 20px ${cat.color}30`,
                    }
                  : {}
              }
            >
              {cat.emoji}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: cat.color }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    <span className="text-[8px] text-white font-bold">✓</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span
              className={cn(
                'text-[11px] font-medium transition-colors',
                isSelected ? 'text-white' : 'text-[#9ca3af]'
              )}
            >
              {cat.name}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function getCategoryById(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
