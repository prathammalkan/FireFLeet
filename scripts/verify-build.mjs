#!/usr/bin/env node
// scripts/verify-build.mjs — runs next build and reports result
import { execSync } from 'node:child_process';
try {
  execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });
  console.log('build passed');
  process.exit(0);
} catch {
  console.error('build failed');
  process.exit(1);
}
