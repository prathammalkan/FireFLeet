#!/usr/bin/env node
// scripts/verify-gitignore.mjs — checks .gitignore covers key untracked directories
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve('.gitignore'), 'utf8');
const required = ['.unlazy/', 'skills-lock.json'];
const missing = required.filter((entry) => !src.includes(entry));
if (missing.length > 0) {
  console.error('gitignore verification failed: missing entries:', missing.join(', '));
  process.exit(1);
}
console.log('gitignore verified');
process.exit(0);
