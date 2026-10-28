#!/usr/bin/env node
// scripts/verify-tests.mjs — runs jest and reports result
import { execSync } from 'node:child_process';
try {
  execSync('npm test -- --ci', { stdio: 'inherit', cwd: process.cwd() });
  console.log('tests passed');
  process.exit(0);
} catch {
  console.error('tests failed');
  process.exit(1);
}
