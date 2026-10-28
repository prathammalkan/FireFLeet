#!/usr/bin/env node
// scripts/verify-db-cleanup-sql.mjs — checks supabase/cleanup/test_data_reset.sql exists and is non-empty
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('supabase/cleanup/test_data_reset.sql');
if (!existsSync(path)) {
  console.error('db cleanup sql verification failed: file does not exist');
  process.exit(1);
}
const content = readFileSync(path, 'utf8');
// Must contain DELETE statements and verification queries
if (!content.includes('DELETE FROM') || !content.includes('transactions') || !content.includes('budgets')) {
  console.error('db cleanup sql verification failed: missing expected DELETE statements');
  process.exit(1);
}
// Must have a safety check against project ID
if (!content.includes('pcancrkntdvnlvgbuitl')) {
  console.error('db cleanup sql verification failed: missing project ID safety guard');
  process.exit(1);
}
console.log('db cleanup sql verified');
process.exit(0);
