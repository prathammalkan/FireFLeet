#!/usr/bin/env node
// scripts/verify-pushed.mjs — verifies feat/device-first-cache exists on origin
import { execSync } from 'node:child_process';
try {
  const out = execSync('git ls-remote --heads origin feat/device-first-cache', {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  if (!out.includes('refs/heads/feat/device-first-cache')) {
    console.error('branch pushed verification failed: branch not found on origin');
    process.exit(1);
  }
  console.log('branch pushed verified');
  process.exit(0);
} catch (e) {
  console.error('branch pushed verification failed:', e.message);
  process.exit(1);
}
