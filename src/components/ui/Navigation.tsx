'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Home, Clock, BarChart2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/history', icon: Clock, label: 'History' },
  { href: '/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  // Don't show nav on onboarding/auth/setup flows
  const hidden = ['/onboarding', '/auth', '/setup'].some((p) => pathname.startsWith(p));
  if (hidden) return null;

  const activeIndex = TABS.findIndex((t) => t.href === pathname);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-[#1f1f2e]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16 px-2 relative">
        {/* Active pill indicator */}
        {activeIndex >= 0 && (
          <motion.div
            layoutId="nav-active"
            className="absolute top-2 h-12 w-[22%] rounded-2xl bg-[#f97316]/10 border border-[#f97316]/20"
            style={{ left: `${activeIndex * 25 + 1.5}%` }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          />
        )}

        {TABS.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <motion.button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full relative z-10"
            >
              <motion.div
                animate={{ scale: isActive ? 1.15 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <tab.icon
                  className={cn(
                    'w-5 h-5 transition-colors duration-200',
                    isActive ? 'text-[#f97316]' : 'text-[#6b7280]'
                  )}
                />
              </motion.div>
              <span
                className={cn(
                  'text-[10px] font-semibold transition-colors duration-200',
                  isActive ? 'text-[#f97316]' : 'text-[#6b7280]'
                )}
              >
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
