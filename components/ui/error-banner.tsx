import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorBannerProps {
  message: string | null;
  className?: string;
}

export function ErrorBanner({ message, className }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20 animate-in fade-in duration-200',
        className
      )}
    >
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span className="flex-1 leading-normal">{message}</span>
    </div>
  );
}
