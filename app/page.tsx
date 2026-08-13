import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { siteConfig } from '@/config/site';

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect(siteConfig.logged_out_routing);
  }
  redirect(siteConfig.logged_in_routing);
}
