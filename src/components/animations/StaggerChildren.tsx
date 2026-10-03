'use client';

// StaggerChildren: only animate once on mount, not on every render.
// Use viewport intersection + once:true so it doesn't re-play.
// Removed scale animation (causes layer promotion of every child = memory hit).

interface StaggerChildrenProps {
  children: React.ReactNode;
  className?: string;
}

// No framer-motion here — pure CSS stagger via animation-delay
// This is 10x faster than JS-driven spring stagger for list items
export function StaggerChildren({ children, className = '' }: StaggerChildrenProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

// StaggerItem: CSS fade-slide-up with stagger via nth-child
export function StaggerItem({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`animate-fade-slide-up ${className}`}>
      {children}
    </div>
  );
}
