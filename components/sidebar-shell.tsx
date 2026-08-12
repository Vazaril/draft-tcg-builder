'use client';

import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarShellProps {
  sidebar: React.ReactNode;
  headerActions: React.ReactNode;
  children: React.ReactNode;
}

export function SidebarShell({ sidebar, headerActions, children }: SidebarShellProps) {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');

    const handleResize = (e: MediaQueryListEvent | MediaQueryList) => {
      if (!e.matches) {
        setIsOpen(false);
      } else {
        setIsOpen(true);
      }
    };

    handleResize(mediaQuery);

    mediaQuery.addEventListener('change', handleResize);

    return () => mediaQuery.removeEventListener('change', handleResize);
  }, []);

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-background">
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out md:relative md:z-0',
          isOpen ? 'translate-x-0 md:ml-0' : '-translate-x-full md:-ml-64'
        )}
      >
        {sidebar}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            className="shrink-0"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>

          <div className="flex items-center gap-4">{headerActions}</div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
