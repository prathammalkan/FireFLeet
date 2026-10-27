import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/002_security_remediation.sql'),
  'utf8',
);
const deleteSemanticsMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/003_budget_delete_semantics.sql'),
  'utf8',
);

describe('Supabase security remediation migration', () => {
  it('fails closed before changing privileges when required invariants are absent', () => {
    expect(migration).toContain("rolname = 'service_role'");
    expect(migration).toContain("'supabase_admin'");
    expect(migration).toContain("Required column public.%.% with nullable=% is missing or incompatible");
    expect(migration).toContain("public.rls_auto_enable()'::regprocedure");
    expect(migration).toContain("evtname = 'ensure_rls'");
    expect(migration).toContain("tgname = 'update_budgets_updated_at'");
    expect(migration).toContain("tgname = 'update_transactions_updated_at'");
    expect(migration).toContain('Unexpected policy exists on a FireFleet table');
    expect(migration).toContain('RAISE EXCEPTION');
    expect(migration).toContain('NOT VALID');
    expect(migration).toContain('VALIDATE CONSTRAINT');
  });

  it('closes API-role grants and keeps ownership checks on authenticated policies', () => {
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO authenticated');
    expect(migration).toContain('TO service_role');
    expect(migration).toContain('SET search_path = pg_catalog, public');
    expect(migration).toContain('pg_default_acl');
    expect(migration).toContain('d.defaclnamespace = 0');
    expect(migration).toContain('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public');
    expect(migration).toContain('cannot alter % default privileges');
    expect(migration).toContain("pg_has_role(current_user, creator_role, 'MEMBER')");
    expect(migration).toContain('idx_categories_user_id');
    expect(migration).toContain('(SELECT auth.uid())');
    expect(migration).toContain('b.user_id = (SELECT auth.uid())');
  });

  it('recognizes equivalent inline checks before adding named remediation checks', () => {
    expect(migration).toContain('pg_get_constraintdef(oid) ILIKE');
    expect(migration).toContain('Existing budgets_amount_range_check is incompatible');
    expect(migration).toContain('Existing categories_color_format_check is incompatible');
    expect(migration).toContain('ADD CONSTRAINT budgets_amount_range_check');
    expect(migration).toContain('ADD CONSTRAINT categories_color_format_check');
  });

  it('contains no destructive row or table operations', () => {
    expect(migration).not.toMatch(/\b(DROP\s+TABLE|DROP\s+SCHEMA|TRUNCATE|DELETE\s+FROM|UPDATE\s+public\.)\b/i);
  });

  it('repairs only the known budget foreign-key drift without rewriting rows', () => {
    expect(deleteSemanticsMigration).toContain("fk.confdeltype = 'c'");
    expect(deleteSemanticsMigration).toContain("fk.confdeltype <> 'n'");
    expect(deleteSemanticsMigration).toContain('ON DELETE CASCADE');
    expect(deleteSemanticsMigration).toContain('DROP CONSTRAINT %I');
    expect(deleteSemanticsMigration).toContain('Expected exactly one transactions.budget_id');
    expect(deleteSemanticsMigration).not.toMatch(/\b(TRUNCATE|DELETE\s+FROM|UPDATE\s+public\.)\b/i);
  });
});
