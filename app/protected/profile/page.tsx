import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Suspense } from 'react';
import {
  PageShell,
  PageHeader,
  PageTitle,
  PageDescription,
  PageContent,
} from '@/components/ui/page-shell';
import { ProfileAvatar } from '@/components/profile-avatar';

async function UserProfileData() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect('/auth/login');
  }

  const username = data.claims.user_metadata?.username || 'Unknown';

  return (
    <div className="grid max-w-2xl gap-8">
      <ProfileAvatar username={username} />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <PageShell>
      <PageHeader>
        <PageTitle>Profile</PageTitle>
        <PageDescription>
          Manage your account settings, update your username, and secure your account.
        </PageDescription>
      </PageHeader>

      <PageContent>
        <Suspense fallback={<div className="h-32 w-32 animate-pulse rounded-2xl bg-muted" />}>
          <UserProfileData />
        </Suspense>
      </PageContent>
    </PageShell>
  );
}
