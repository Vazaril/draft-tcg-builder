import { AuthButton } from '@/components/auth-button';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Suspense } from 'react';
import { SidebarShell } from '@/components/sidebar-shell';
import { SidebarNav } from '@/components/sidebar-nav';
import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import { siteConfig } from '@/config/site';
import { JudgeChatShell } from '@/components/judge-chat-shell';
import { Logo } from '@/components/ui/logo';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const sidebarContent = (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Logo className="w-8 h-8" />
          <h2 className="font-pixel text-2xl font-bold text-primary">{siteConfig.title}</h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav />
      </SidebarContent>
      <SidebarFooter>{/* Footer Left */}</SidebarFooter>
    </Sidebar>
  );

  const headerActions = (
    <>
      <ThemeSwitcher />
      <Suspense fallback={<div className="h-9 w-24 animate-pulse rounded bg-muted" />}>
        <AuthButton />
        <JudgeChatShell />
      </Suspense>
    </>
  );

  return (
    <>
      <SidebarShell sidebar={sidebarContent} headerActions={headerActions}>
        {children}
      </SidebarShell>
    </>
  );
}
