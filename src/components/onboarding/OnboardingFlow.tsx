'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight } from 'lucide-react';

import { useStore } from '@/lib/store';

const SLIDES = [
  {
    emoji: '🔥',
    title: 'Plan Your Wealth',
    subtitle: 'Set a budget for any period — weekly or monthly. Stay in control every day.',
    color: '#f97316',
  },
  {
    emoji: '📊',
    title: 'Track Every Expense',
    subtitle: 'Log spending in seconds with our custom numpad. Add categories and notes instantly.',
    color: '#3b82f6',
  },
  {
    emoji: '💡',
    title: 'Smart Insights',
    subtitle: 'See where your money goes with clear charts. Make smarter decisions every day.',
    color: '#22c55e',
  },
];

export function OnboardingFlow() {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1); // 1 = forward, -1 = back
  const router = useRouter();
  const setIsOnboarded = useStore((s) => s.setIsOnboarded);

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  function next() {
    if (isLast) {
      localStorage.setItem('ff-onboarded', '1');
      setIsOnboarded(true);
      router.replace('/auth');
    } else {
      setDir(1);
      setIndex((i) => i + 1);
    }
  }

  function skip() {
    localStorage.setItem('ff-onboarded', '1');
    setIsOnboarded(true);
    router.replace('/auth');
  }

  return (
    <div className="page-root flex flex-col overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Skip */}
      <div className="flex justify-end px-5 pt-4">
        <button
          onClick={skip}
          className="text-[#9ca3af] text-sm font-medium px-3 py-1.5 active:opacity-60 transition-opacity"
        >
          Skip
        </button>
      </div>

      {/* Slide */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={index}
            custom={dir}
            initial={{ opacity: 0, x: dir * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -50 }}
            transition={{ duration: 0.26, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex flex-col items-center text-center"
          >
            {/* Icon card */}
            <div
              className="w-44 h-44 rounded-[36px] flex items-center justify-center mb-10"
              style={{
                background: `radial-gradient(circle at 40% 40%, ${slide.color}30, ${slide.color}10)`,
                border: `1px solid ${slide.color}30`,
              }}
            >
              <span className="text-8xl leading-none">{slide.emoji}</span>
            </div>

            <h1 className="text-3xl font-black text-white mb-4 leading-tight">
              {slide.title}
            </h1>
            <p className="text-[#9ca3af] text-base leading-relaxed max-w-[280px]">
              {slide.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="px-8 pb-8" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))' }}>
        {/* Dots */}
        <div className="flex justify-center gap-2 mb-8">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === index ? 24 : 8,
                background: i === index ? '#f97316' : '#1f1f2e',
              }}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white font-bold text-lg flex items-center justify-center gap-2 active:opacity-85 transition-opacity"
        >
          {isLast ? 'Get Started' : 'Next'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
