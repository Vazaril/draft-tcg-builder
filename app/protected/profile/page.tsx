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
import { ChangePasswordForm } from '@/components/change-password-form';

async function UserProfileData() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect(siteConfig.logged_out_routing);
  }

  const username = data.claims.user_metadata?.username || 'Unknown';
  const email = data.claims.user_metadata?.email || 'Unknown';

  return (
    <div className="flex w-full max-w-6xl flex-col gap-10">
      <div>
        <ProfileAvatar username={username} />
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        <UpdateProfileForm currentUsername={username} currentEmail={email} />
        <ChangePasswordForm />
      </div>

      <div className="mt-4 border-t pt-8">
        <div className="max-w-2xl">
          <DeleteAccountForm />
        </div>
      </div>
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
