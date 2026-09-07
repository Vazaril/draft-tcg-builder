'use client';

import { useEffect } from 'react';

export function TimedMessage({
  message,
  duration = 3000,
  onClose,
}: {
  message: string;
  duration?: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      window.clearTimeout(timer);
    };
  }, [duration, onClose]);

  return (
    <div className="fixed right-6 top-6 z-[100] rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground shadow-lg">
      {message}
    </div>
  );
}
