import { redirect } from 'next/navigation';
import { siteConfig } from '@/config/site';

export default function ProtectedRootPage() {
  redirect(siteConfig.logged_in_routing);
}
