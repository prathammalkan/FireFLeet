#!/usr/bin/env node
// scripts/verify-no-polling.mjs — verifies useBudget.ts has no setInterval call (not in comments)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve('src/hooks/useBudget.ts'), 'utf8');

// Check for setInterval outside of comments (lines that are not pure comment lines)
const linesWithSetInterval = src.split('\n').filter((line) => {
  const trimmed = line.trimStart();
  // Skip comment-only lines (// or *)
  if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
  return line.includes('setInterval');
});

if (linesWithSetInterval.length > 0) {
  console.error('no polling verification failed: setInterval found in useBudget.ts code:');
  linesWithSetInterval.forEach((l) => console.error(' ', l.trim()));
  process.exit(1);
}
// Verify visibilitychange or focus listener is present instead
if (!src.includes('visibilitychange') && !src.includes('focus')) {
  console.error('no polling verification failed: no focus/visibility revalidation found');
  process.exit(1);
}
console.log('no polling verified');
process.exit(0);
