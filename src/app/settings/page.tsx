'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { LogOut, Download, RefreshCw, Moon, Sun, ChevronRight, User } from 'lucide-react';
import { Navigation } from '@/components/ui/Navigation';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/lib/store';
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

  async function handleSignOut() {
    setLoggingOut(true);
    await signOut();
    router.push('/auth');
  }

  function handleExport() {
    const rows = [
      ['Date', 'Category', 'Amount', 'Comment'],
      ...transactions.map((t) => [
        new Date(t.created_at).toLocaleDateString(),
        t.category,
        t.amount.toString(),
        t.comment ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firefleet-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-24">
      <div className="pt-safe px-5 pt-4 pb-4">
        <h1 className="text-xl font-black text-white">Settings</h1>
      </div>

      <div className="px-5 flex flex-col gap-4">
        {/* Profile */}
        <div className="bg-[#13131a] border border-[#1f1f2e] rounded-3xl p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center">
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
            <SettingsRow
              label="Total budget"
              value={formatCurrency(budget.amount, budget.currency)}
            />
            <SettingsRow label="Currency" value={budget.currency} />
            <SettingsRow
              label="Period"
              value={budget.periodType.charAt(0).toUpperCase() + budget.periodType.slice(1)}
            />
            <SettingsRow
              label="Transactions"
              value={`${transactions.length}`}
            />
          </SettingsSection>
        )}

        {/* Preferences */}
        <SettingsSection title="Preferences">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-[#9ca3af]" /> : <Sun className="w-4 h-4 text-[#9ca3af]" />}
              <span className="text-white font-medium">Dark mode</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`w-12 h-6 rounded-full transition-colors ${theme === 'dark' ? 'bg-[#f97316]' : 'bg-[#1f1f2e]'}`}
            >
              <motion.div
                animate={{ x: theme === 'dark' ? 24 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-5 h-5 bg-white rounded-full shadow"
              />
            </motion.button>
          </div>
        </SettingsSection>

        {/* Actions */}
        <SettingsSection title="Data">
          <ActionRow
            icon={<Download className="w-4 h-4" />}
            label="Export to CSV"
            onClick={handleExport}
          />
          <ActionRow
            icon={<RefreshCw className="w-4 h-4" />}
            label="Reset budget"
            onClick={() => {
              if (confirm('Reset all data? This cannot be undone.')) {
                reset();
                router.push('/setup');
              }
            }}
            danger
          />
        </SettingsSection>

        {/* Sign out */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSignOut}
          disabled={loggingOut}
          className="w-full h-14 rounded-2xl bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {loggingOut ? 'Signing out...' : 'Sign Out'}
        </motion.button>

        <p className="text-center text-[#4b5563] text-xs pb-2">FireFleet v1.0.0</p>
      </div>

      <Navigation />
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#13131a] border border-[#1f1f2e] rounded-2xl overflow-hidden">
      <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider px-4 pt-4 pb-2">{title}</p>
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

function ActionRow({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center justify-between py-3"
    >
      <div className="flex items-center gap-3">
        <span className={danger ? 'text-[#ef4444]' : 'text-[#9ca3af]'}>{icon}</span>
        <span className={`font-medium ${danger ? 'text-[#ef4444]' : 'text-white'}`}>{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-[#4b5563]" />
    </motion.button>
  );
}
