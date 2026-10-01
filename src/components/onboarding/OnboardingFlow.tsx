'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight } from 'lucide-react';

const SLIDES = [
  {
    emoji: '🔥',
    title: 'Plan Your Wealth',
    subtitle: 'Set a budget for any period — weekly, monthly, or custom. Stay in control of your finances.',
    bg: 'from-orange-500/20 to-red-500/10',
    accent: '#f97316',
  },
  {
    emoji: '📊',
    title: 'Track Every Expense',
    subtitle: 'Log spending in seconds with our beautiful numpad. Categorize and add notes instantly.',
    bg: 'from-blue-500/20 to-purple-500/10',
    accent: '#3b82f6',
  },
  {
    emoji: '💡',
    title: 'Smart Insights',
    subtitle: 'See where your money goes with beautiful charts. Make smarter decisions every day.',
    bg: 'from-green-500/20 to-emerald-500/10',
    accent: '#22c55e',
  },
];

export function OnboardingFlow() {
  const [index, setIndex] = useState(0);
  const router = useRouter();

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  function next() {
    if (isLast) {
      localStorage.setItem('ff-onboarded', '1');
      router.push('/auth');
    } else {
      setIndex((i) => i + 1);
    }
  }

  function skip() {
    localStorage.setItem('ff-onboarded', '1');
    router.push('/auth');
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">
      {/* Skip */}
      <div className="flex justify-end p-5 pt-safe">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={skip}
          className="text-[#9ca3af] text-sm font-medium px-3 py-1.5"
        >
          Skip
        </motion.button>
      </div>

      {/* Slide */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -60, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="flex flex-col items-center text-center"
          >
            {/* Illustration */}
            <motion.div
              className={`w-48 h-48 rounded-[40px] bg-gradient-to-br ${slide.bg} flex items-center justify-center mb-10`}
              style={{ boxShadow: `0 30px 80px ${slide.accent}25` }}
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="text-8xl animate-flame">{slide.emoji}</span>
            </motion.div>

            <h1 className="text-3xl font-black text-white mb-4 leading-tight">
              {slide.title}
            </h1>
            <p className="text-[#9ca3af] text-base leading-relaxed max-w-xs">
              {slide.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom */}
      <div className="px-8 pb-10 pb-safe">
        {/* Dots */}
        <div className="flex justify-center gap-2 mb-8">
          {SLIDES.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === index ? 24 : 8,
                backgroundColor: i === index ? '#f97316' : '#1f1f2e',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="h-2 rounded-full"
            />
          ))}
        </div>

        {/* CTA button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={next}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white font-bold text-lg shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2"
        >
          {isLast ? 'Get Started' : 'Next'}
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}
