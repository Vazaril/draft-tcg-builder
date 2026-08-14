import { redirect } from 'next/navigation';
import { siteConfig } from '@/config/site';

export default function AuthPage() {
  redirect(siteConfig.logged_out_routing);
}
