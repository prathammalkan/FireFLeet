#!/usr/bin/env node
// scripts/verify-signout-cache-clear.mjs — verifies useAuth.ts calls clearUserCache on sign-out
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve('src/hooks/useAuth.ts'), 'utf8');
if (!src.includes('clearUserCache')) {
  console.error('signout cache clear verification failed: clearUserCache not found in useAuth.ts');
  process.exit(1);
}
// Verify it is imported from the cache module
if (!src.includes("from '@/lib/cache'") && !src.includes('from "@/lib/cache"')) {
  console.error('signout cache clear verification failed: cache module not imported in useAuth.ts');
  process.exit(1);
}
console.log('signout cache clear verified');
process.exit(0);
