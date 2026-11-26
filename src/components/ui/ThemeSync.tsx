'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';

/**
 * Synchronizes the user's persisted theme preference (`dark` | `light`) onto
 * `document.documentElement[data-theme]` so CSS theme rules take effect
 * immediately on load and whenever toggled in Settings.
 */
export function ThemeSync() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) {
      meta.content = theme === 'light' ? '#f8fafc' : '#f97316';
    }
  }, [theme]);

  return null;
}
