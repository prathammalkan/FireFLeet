'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  snapPoints?: number[];
  initialSnap?: number;
  className?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);
  const backdropOpacity = useTransform(y, [0, 300], [0.6, 0]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    } else {
      y.set(0);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black"
            style={{ opacity: backdropOpacity }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-[#13131a] rounded-t-[28px]',
              'border-t border-[#1f1f2e]',
              'max-h-[92vh] flex flex-col',
              'shadow-2xl shadow-black/60',
              className
            )}
            style={{ y }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={handleDragEnd}
          >
            {/* Drag handle */}
            <div className="flex items-center justify-center pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#1f1f2e]" />
            </div>

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-5 pb-4 shrink-0">
                <h2 className="text-lg font-bold text-white">{title}</h2>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-[#1a1a24] flex items-center justify-center text-[#9ca3af]"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            )}

            {/* Content */}
            <div
              className="flex-1 overflow-y-auto no-scrollbar"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
