'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export function UndoToast({
  message,
  onUndo,
  onDismiss,
  durationMs = 5000,
}: UndoToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismissRef.current(), durationMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [durationMs]);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18 }}
      className="fixed left-4 right-4 z-[60] flex items-center justify-between gap-3 bg-[#1a1a24] border border-[#1f1f2e] rounded-2xl px-4 py-3 shadow-xl"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
    >
      <span className="text-white text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="text-[#f97316] text-sm font-bold shrink-0 active:opacity-70"
      >
        Undo
      </button>
    </motion.div>
  );
}
