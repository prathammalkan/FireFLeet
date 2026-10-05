'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Share2 } from 'lucide-react';

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void } | null>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem('ff-install-dismissed');
    if (dismissed) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) return; // Already installed

    setIsIOS(ios);

    if (ios) {
      // Show after 4s on iOS
      const timer = setTimeout(() => setShow(true), 4000);
      return () => clearTimeout(timer);
    }

    // Android/Chrome: listen for beforeinstallprompt
    function handlePrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt: () => void });
      const timer = setTimeout(() => setShow(true), 4000);
      return () => clearTimeout(timer);
    }

    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  function dismiss() {
    localStorage.setItem('ff-install-dismissed', '1');
    setShow(false);
  }

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      setShow(false);
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed bottom-24 left-4 right-4 z-50"
        >
          <div className="bg-[#13131a]/97 border border-[#1f1f2e] rounded-3xl p-5 shadow-2xl shadow-orange-500/10">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center text-2xl shadow-lg shadow-orange-500/30">
                  🔥
                </div>
                <div>
                  <p className="font-bold text-white">Install FireFleet</p>
                  <p className="text-[#9ca3af] text-xs">Works offline · No app store needed</p>
                </div>
              </div>
              <button
                onClick={dismiss}
                className="w-7 h-7 rounded-full bg-[#1a1a24] flex items-center justify-center text-[#9ca3af] active:scale-90 transition-transform"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="bg-[#1a1a24] rounded-2xl p-3 text-sm text-[#9ca3af]">
                <p className="mb-2 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-[#f97316]" />
                  Tap <strong className="text-white">Share</strong> in Safari
                </p>
                <p className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#f97316]" />
                  Then <strong className="text-white">Add to Home Screen</strong>
                </p>
              </div>
            ) : (
              <button
                onClick={handleInstall}
                className="w-full h-11 rounded-2xl bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white font-bold shadow-lg shadow-orange-500/25 active:scale-90 transition-transform"
              >
                Install App
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
