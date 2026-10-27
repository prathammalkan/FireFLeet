import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/002_security_remediation.sql'),
  'utf8',
);

describe('Supabase security remediation migration', () => {
  it('fails closed before changing privileges when required invariants are absent', () => {
    expect(migration).toContain("rolname = 'service_role'");
    expect(migration).toContain("public.rls_auto_enable()'::regprocedure");
    expect(migration).toContain("evtname = 'ensure_rls'");
    expect(migration).toContain('RAISE EXCEPTION');
    expect(migration).toContain('NOT VALID');
    expect(migration).toContain('VALIDATE CONSTRAINT');
  });

  it('closes API-role grants and keeps ownership checks on authenticated policies', () => {
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO authenticated');
    expect(migration).toContain('TO service_role');
    expect(migration).toContain('SET search_path = pg_catalog, public');
    expect(migration).toContain('idx_categories_user_id');
    expect(migration).toContain('(SELECT auth.uid())');
    expect(migration).toContain('b.user_id = (SELECT auth.uid())');
  });

  it('contains no destructive row or table operations', () => {
    expect(migration).not.toMatch(/\b(DROP\s+TABLE|DROP\s+SCHEMA|TRUNCATE|DELETE\s+FROM|UPDATE\s+public\.)\b/i);
  });
});
