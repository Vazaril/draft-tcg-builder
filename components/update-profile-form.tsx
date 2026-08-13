'use client';

import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { siteConfig } from '@/config/site';
import * as React from 'react';
import { checkUpdateUser } from '@/app/auth/auth-service';

interface UpdateProfileProps extends React.ComponentPropsWithoutRef<'div'> {
  currentUsername: string;
  currentEmail: string;
}

export function UpdateProfileForm({
  currentUsername,
  currentEmail,
  className,
  ...props
}: UpdateProfileProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { checkError, userAttributes } = await checkUpdateUser(
        currentUsername,
        currentEmail,
        username,
        email
      );
      if (checkError) throw checkError;
      if (userAttributes) {
        const { error } = await supabase.auth.updateUser(userAttributes);
        if (error) throw error;
        // Update this route to redirect to an authenticated route. The user already has an active session.
        router.push(siteConfig.logged_in_routing);
      }
    } catch (error: unknown) {
      //TODO FIX ERROR DISPLAY
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className={cn('flex flex-col gap-4', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Update your Personal Info</CardTitle>
          <CardDescription>
            When changing your E-Mail Address, a confirmation of the new E-Mail is required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateUser}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Input
                  id="username"
                  type="text"
                  placeholder={currentUsername}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Input
                  id="email"
                  type="email"
                  placeholder={currentEmail}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
