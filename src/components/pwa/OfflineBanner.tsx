'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Wifi } from 'lucide-react';

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function getServerSnapshot() {
  return true;
}

export function OfflineBanner() {
  const isOnline = useSyncExternalStore(subscribeOnline, getSnapshot, getServerSnapshot);
  const [showReconnected, setShowReconnected] = useState(false);
  const prevOnlineRef = useRef(true);

  useEffect(() => {
    if (!prevOnlineRef.current && isOnline) {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

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
                No connection — changes may not save
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
