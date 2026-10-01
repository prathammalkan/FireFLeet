'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Wifi } from 'lucide-react';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    }

    function handleOffline() {
      setIsOnline(false);
      setWasOffline(true);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return (
    <AnimatePresence>
      {(!isOnline || showReconnected) && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[100] flex justify-center"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div
            className={`
              flex items-center gap-2 px-4 py-2 rounded-b-2xl text-sm font-semibold
              ${isOnline
                ? 'bg-[#22c55e] text-white'
                : 'bg-[#ef4444] text-white'}
            `}
          >
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4" />
                Back online
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                You&apos;re offline — data saved locally
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
