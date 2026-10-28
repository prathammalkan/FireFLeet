#!/usr/bin/env node
// scripts/verify-lint.mjs — runs eslint and reports result
import { execSync } from 'node:child_process';
try {
  execSync('npx eslint .', { stdio: 'inherit', cwd: process.cwd() });
  console.log('lint passed');
  process.exit(0);
} catch {
  console.error('lint failed');
  process.exit(1);
}
