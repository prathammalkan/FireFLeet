'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Download, RefreshCw, Moon, Sun, ChevronRight, User } from 'lucide-react';
import { Navigation } from '@/components/ui/Navigation';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/lib/store';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const budget = useStore((s) => s.budget);
  const transactions = useStore((s) => s.transactions);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const reset = useStore((s) => s.reset);
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [resetting, setResetting] = useState(false);
  const supabase = getSupabaseBrowserClient();

  async function handleSignOut() {
    setLoggingOut(true);
    await signOut(); // signOut already calls reset() + clears localStorage
    router.replace('/auth');
  }

  async function handleReset() {
    if (!confirm('Reset all data? This permanently deletes your budget and all transactions from the server. This cannot be undone.')) return;
    if (!user) return;
    setResetting(true);
    try {
      // EDGE-05 FIX: Delete server data first, then clear local state
      // Deleting the budget cascades to transactions via ON DELETE CASCADE
      if (budget?.id) {
        const { error } = await supabase
          .from('budgets')
          .delete()
          .eq('id', budget.id)
          .eq('user_id', user.id); // belt-and-suspenders
        if (error) {
          console.error('[Reset] Failed to delete budget:', error.message);
          alert('Failed to reset data. Please try again.');
          setResetting(false);
          return;
        }
      }
      reset();
      router.replace('/setup');
    } catch {
      alert('Failed to reset data. Please try again.');
      setResetting(false);
    }
  }


  function handleExport() {
    if (transactions.length === 0) { alert('No transactions to export.'); return; }
    const rows = [
      ['Date', 'Category', 'Amount', 'Currency', 'Comment'],
      ...transactions.map((t) => [
        new Date(t.created_at).toLocaleDateString(),
        t.category,
        t.amount.toString(),
        budget?.currency ?? 'INR',
        t.comment ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firefleet-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const navBottom = 'calc(64px + env(safe-area-inset-bottom, 0px))';

  return (
    <div
      className="page-root overflow-y-auto scroll-container"
      style={{ paddingBottom: `calc(${navBottom} + 16px)` }}
    >
      <div className="px-5 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <h1 className="text-xl font-black text-white">Settings</h1>
      </div>

      <div className="px-5 flex flex-col gap-4">
        {/* Profile */}
        <div className="bg-[#13131a] border border-[#1f1f2e] rounded-3xl p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center shrink-0">
            <User className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{user?.email?.split('@')[0]}</p>
            <p className="text-sm text-[#9ca3af] truncate">{user?.email}</p>
          </div>
        </div>

        {/* Budget info */}
        {budget && (
          <SettingsSection title="Budget">
            <SettingsRow label="Total budget" value={formatCurrency(budget.amount, budget.currency)} />
            <SettingsRow label="Currency" value={budget.currency} />
            <SettingsRow label="Period" value={budget.periodType.charAt(0).toUpperCase() + budget.periodType.slice(1)} />
            <SettingsRow label="Transactions" value={`${transactions.length}`} />
          </SettingsSection>
        )}

        {/* Theme toggle */}
        <SettingsSection title="Appearance">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-[#9ca3af]" /> : <Sun className="w-4 h-4 text-[#9ca3af]" />}
              <span className="text-white font-medium">Dark mode</span>
            </div>
            {/* CSS toggle — no JS animation overhead */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="relative w-12 h-6 rounded-full transition-colors duration-300"
              style={{ background: theme === 'dark' ? '#f97316' : '#1f1f2e' }}
              aria-label="Toggle dark mode"
            >
              <div
                className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300"
                style={{ transform: theme === 'dark' ? 'translateX(26px)' : 'translateX(2px)' }}
              />
            </button>
          </div>
        </SettingsSection>

        {/* Data */}
        <SettingsSection title="Data">
          <ActionRow icon={<Download className="w-4 h-4" />} label="Export to CSV" onClick={handleExport} />
          <ActionRow
            icon={
              resetting
                ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin-slow" />
                : <RefreshCw className="w-4 h-4" />
            }
            label={resetting ? 'Resetting…' : 'Reset all data'}
            onClick={handleReset}
            danger
          />
        </SettingsSection>


        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={loggingOut}
          className="w-full h-14 rounded-2xl bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] font-bold flex items-center justify-center gap-2 active:opacity-70 transition-opacity disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {loggingOut ? 'Signing out…' : 'Sign Out'}
        </button>

        <p className="text-center text-[#4b5563] text-xs pb-2">FireFleet v1.0.0</p>
      </div>

      <Navigation />
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl overflow-hidden">
      <p className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider px-4 pt-4 pb-2">{title}</p>
      <div className="px-4 pb-2 divide-y divide-[#1f1f2e]">{children}</div>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[#9ca3af] text-sm">{label}</span>
      <span className="text-white font-semibold text-sm">{value}</span>
    </div>
  );
}

function ActionRow({
  icon, label, onClick, danger,
}: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-3 active:opacity-70 transition-opacity"
    >
      <div className="flex items-center gap-3">
        <span className={danger ? 'text-[#ef4444]' : 'text-[#9ca3af]'}>{icon}</span>
        <span className={`font-medium ${danger ? 'text-[#ef4444]' : 'text-white'}`}>{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-[#4b5563]" />
    </button>
  );
}
