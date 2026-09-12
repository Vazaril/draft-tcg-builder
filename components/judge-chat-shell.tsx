import { createClient } from '@/lib/supabase/server';
import { JudgeChat } from '@/components/judge-chat';

export async function JudgeChatShell() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;
  if (user && user.user_metadata) {
    return <JudgeChat />;
  }
  return null;
}
