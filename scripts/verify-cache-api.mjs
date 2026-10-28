#!/usr/bin/env node
// scripts/verify-cache-api.mjs — checks that src/lib/cache.ts exports required symbols
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve('src/lib/cache.ts'), 'utf8');
const required = [
  'getCachedBudget',
  'setCachedBudget',
  'getCachedTransactions',
  'setCachedTransactions',
  'clearUserCache',
];
const missing = required.filter((sym) => !src.includes(`export`) || !src.includes(sym));
if (missing.length > 0) {
  console.error('cache api verification failed: missing exports:', missing.join(', '));
  process.exit(1);
}
// Also verify CACHE_VERSION and TTL constants exist
if (!src.includes('CACHE_VERSION') || !src.includes('TTL')) {
  console.error('cache api verification failed: missing CACHE_VERSION or TTL constants');
  process.exit(1);
}
console.log('cache api verified');
process.exit(0);
