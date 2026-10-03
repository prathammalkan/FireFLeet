'use client';

import { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform, useMotionValue } from 'motion/react';

interface NumberCounterProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export function NumberCounter({
  value,
  className = '',
  prefix = '',
  suffix = '',
  decimals = 0,
}: NumberCounterProps) {
  // Guard: never animate NaN/Infinity — show 0 instead
  const safeValue = isFinite(value) && !isNaN(value) ? value : 0;

  const motionValue = useMotionValue(safeValue);
  const springValue = useSpring(motionValue, {
    stiffness: 60,   // softer spring = less CPU per frame
    damping: 22,
  });

  const displayValue = useTransform(springValue, (v) => {
    const safeV = isFinite(v) ? v : 0;
    return safeV.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  });

  const prevValue = useRef(safeValue);

  useEffect(() => {
    if (prevValue.current !== safeValue) {
      motionValue.set(safeValue);
      prevValue.current = safeValue;
    }
  }, [safeValue, motionValue]);

  return (
    <span className={className}>
      {prefix}
      <motion.span>{displayValue}</motion.span>
      {suffix}
    </span>
  );
}
