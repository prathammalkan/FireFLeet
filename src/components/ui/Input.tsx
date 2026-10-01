'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const shakeAnimation = {
  x: [0, -10, 10, -10, 10, -6, 6, 0],
  transition: { duration: 0.5 },
};

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  className,
  id,
  value,
  defaultValue,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [hasValue, setHasValue] = useState(
    Boolean(value || defaultValue || props.placeholder)
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = id || `input-${label.toLowerCase().replace(/\s/g, '-')}`;

  useEffect(() => {
    setHasValue(Boolean(value || inputRef.current?.value));
  }, [value]);

  const isFloated = focused || hasValue || Boolean(value);

  return (
    <div className="w-full">
      <motion.div
        animate={error ? shakeAnimation : {}}
        className="relative"
      >
        {/* Left icon */}
        {leftIcon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af] z-10">
            {leftIcon}
          </div>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          id={inputId}
          value={value}
          className={cn(
            'w-full bg-[#13131a] border rounded-2xl',
            'text-white text-base font-medium',
            'transition-all duration-200 outline-none',
            'pt-6 pb-2 px-4',
            leftIcon && 'pl-11',
            rightIcon && 'pr-11',
            focused
              ? 'border-[#f97316] shadow-[0_0_0_3px_rgba(249,115,22,0.15)]'
              : 'border-[#1f1f2e]',
            error && 'border-[#ef4444] shadow-[0_0_0_3px_rgba(239,68,68,0.15)]',
            className
          )}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            setHasValue(Boolean(e.target.value));
          }}
          onChange={(e) => {
            setHasValue(Boolean(e.target.value));
            props.onChange?.(e);
          }}
          {...props}
        />

        {/* Floating label */}
        <motion.label
          htmlFor={inputId}
          animate={{
            y: isFloated ? -8 : 0,
            scale: isFloated ? 0.78 : 1,
            color: focused ? '#f97316' : error ? '#ef4444' : '#9ca3af',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={cn(
            'absolute left-4 top-4 origin-left pointer-events-none',
            'text-base font-medium',
            leftIcon && 'left-11'
          )}
        >
          {label}
        </motion.label>

        {/* Right icon */}
        {rightIcon && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af]">
            {rightIcon}
          </div>
        )}
      </motion.div>

      {/* Error / hint */}
      <AnimatePresence>
        {(error || hint) && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={cn(
              'mt-1.5 ml-1 text-sm',
              error ? 'text-[#ef4444]' : 'text-[#9ca3af]'
            )}
          >
            {error || hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
