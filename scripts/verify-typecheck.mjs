#!/usr/bin/env node
// scripts/verify-typecheck.mjs — runs tsc --noEmit and reports result
import { execSync } from 'node:child_process';
try {
  execSync('npx tsc --noEmit', { stdio: 'inherit', cwd: process.cwd() });
  console.log('typecheck passed');
  process.exit(0);
} catch {
  console.error('typecheck failed');
  process.exit(1);
}
