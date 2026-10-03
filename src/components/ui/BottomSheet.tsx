'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo, useMotionValue } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  className,
}: BottomSheetProps) {
  const y = useMotionValue(0);

  // Lock body scroll (iOS needs this to prevent background scroll)
  useEffect(() => {
    if (isOpen) {
      // Save scroll position & lock
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
    } else {
      // Restore scroll position
      const top = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      if (top) window.scrollTo(0, -parseInt(top, 10));
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
    };
  }, [isOpen]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 80 || info.velocity.y > 400) {
      onClose();
    } else {
      // Snap back with spring
      y.set(0);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — simple opacity, no blur (expensive) */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Sheet — GPU layer via bottom-sheet class */}
          <motion.div
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50 bottom-sheet',
              'bg-[#13131a] rounded-t-3xl',
              'border-t border-[#1f1f2e]',
              'max-h-[92svh] flex flex-col', // svh = small viewport height, correct on iOS
              className
            )}
            style={{ y }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            // Faster spring = less perceived lag
            transition={{ type: 'spring', stiffness: 500, damping: 42, mass: 0.8 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={handleDragEnd}
          >
            {/* Drag handle */}
            <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#2a2a3a]" />
            </div>

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-[#1f1f2e]">
                <h2 className="text-base font-bold text-white">{title}</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-[#1a1a24] flex items-center justify-center text-[#9ca3af] active:bg-[#252535] transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Content — scroll-container: native momentum scroll */}
            <div
              className="flex-1 overflow-y-auto scroll-container"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
