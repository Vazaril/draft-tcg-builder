'use client';

import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import * as React from 'react';
import { checkUpdateUser } from '@/app/auth/auth-service';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleToggleEditMode = (checked: boolean) => {
    setIsEditMode(checked);
    if (!checked) {
      setUsername('');
      setEmail('');
      setError(null);
      setSuccess(null);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEditMode) return;

    const supabase = createClient();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

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
        setIsEditMode(false);
        setUsername('');
        setEmail('');
        setError(null);
        setSuccess('Personal Info updated successfully!');
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted) {
    return (
      <div className={cn('flex flex-col gap-4', className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Update your Personal Info</CardTitle>
            <CardDescription>Loading settings...</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]" />
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Update your Personal Info</CardTitle>
          <CardDescription>
            When changing your E-Mail Address, a confirmation of the new E-Mail is required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateUser}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center space-x-4">
                <Switch
                  id="enable-edit"
                  checked={isEditMode}
                  onCheckedChange={handleToggleEditMode}
                />
                <Label htmlFor="confirm-update" className="text-base text-foreground leading-none">
                  Enable Edit-Mode
                </Label>
              </div>
              <div className="grid gap-2">
                <Input
                  id="username"
                  type="text"
                  disabled={!isEditMode}
                  placeholder={currentUsername}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Input
                  id="email"
                  type="email"
                  disabled={!isEditMode}
                  placeholder={currentEmail}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              {success && <p className="text-sm font-medium text-green-500">{success}</p>}
              <Button type="submit" className="w-full" disabled={isLoading || !isEditMode}>
                {isLoading ? 'Updating...' : 'Update Personal Info'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
