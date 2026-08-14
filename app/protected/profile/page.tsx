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
import { siteConfig } from '@/config/site';
import { UpdateProfileForm } from '@/components/update-profile-form';
import { DeleteAccountForm } from '@/components/delete-account-form';

async function UserProfileData() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect(siteConfig.logged_out_routing);
  }

  const username = data.claims.user_metadata?.username || 'Unknown';
  const email = data.claims.user_metadata?.email || 'Unknown';

  return (
    <div>
      <div className="grid max-w-2xl gap-8">
        <ProfileAvatar username={username} />
      </div>
      <UpdateProfileForm currentUsername={username} currentEmail={email} />
      <DeleteAccountForm />
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
