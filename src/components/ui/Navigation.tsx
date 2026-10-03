'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Clock, BarChart2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/history', icon: Clock, label: 'History' },
  { href: '/analytics', icon: BarChart2, label: 'Charts' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const hidden = ['/onboarding', '/auth', '/setup'].some((p) => pathname.startsWith(p));
  if (hidden) return null;

  return (
    /* nav-bar class: solid bg, no backdrop-blur, own GPU layer */
    <nav className="nav-bar">
      <div className="flex items-center h-16 px-2">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              /* Pure CSS active state — no motion.button overhead per tap */
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 h-full',
                'active:opacity-70 transition-opacity duration-100',
              )}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={cn(
                  'w-10 h-8 rounded-xl flex items-center justify-center transition-colors duration-200',
                  isActive ? 'bg-[#f97316]/12' : 'bg-transparent',
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 transition-colors duration-200',
                    isActive ? 'text-[#f97316]' : 'text-[#6b7280]',
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-semibold transition-colors duration-200',
                  isActive ? 'text-[#f97316]' : 'text-[#6b7280]',
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
