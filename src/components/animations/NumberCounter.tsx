'use client';

import { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform, useMotionValue } from 'motion/react';

interface NumberCounterProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}

export function NumberCounter({
  value,
  className = '',
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1.2,
}: NumberCounterProps) {
  const motionValue = useMotionValue(value);
  const springValue = useSpring(motionValue, {
    stiffness: 80,
    damping: 20,
    duration,
  });

  const displayValue = useTransform(springValue, (v) => {
    const formatted = v.toFixed(decimals);
    const num = parseFloat(formatted);
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  });

  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      motionValue.set(value);
      prevValue.current = value;
    }
  }, [value, motionValue]);

  return (
    <span className={className}>
      {prefix}
      <motion.span>{displayValue}</motion.span>
      {suffix}
    </span>
  );
}
