'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import * as React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { verifyAndUpdatePassword } from '@/app/auth/auth-service';

export function ChangePasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleToggleEditMode = (checked: boolean) => {
    setIsEditMode(checked);
    if (!checked) {
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      setError(null);
      setSuccess(null);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEditMode) return;

    if (newPassword !== repeatPassword) {
      return setError('New passwords do not match.');
    }
    if (currentPassword === newPassword) {
      return setError('New password cannot be the same as the current password.');
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await verifyAndUpdatePassword(currentPassword, newPassword);

      if (result.error) {
        throw new Error(result.error);
      }

      setIsEditMode(false);
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      setSuccess('Password updated successfully!');
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : 'An error occurred while updating the password.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted) {
    return (
      <div className={cn('flex flex-col gap-4', className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Security Settings</CardTitle>
            <CardDescription>Loading security settings...</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]" />
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Security Settings</CardTitle>
          <CardDescription>
            Update your password. Ensure you use a strong, unique password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} autoComplete="off">
            <div className="flex flex-col gap-4">
              <div className="flex items-center space-x-4">
                <Switch
                  id="enable-password-edit"
                  checked={isEditMode}
                  onCheckedChange={handleToggleEditMode}
                />
                <Label
                  htmlFor="enable-password-edit"
                  className="text-base text-foreground leading-none cursor-pointer"
                >
                  Change Password
                </Label>
              </div>
              <div className="grid gap-2">
                <div className="grid gap-2">
                  <Input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Current Password"
                    disabled={!isEditMode}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="New Password"
                    disabled={!isEditMode}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Input
                    id="repeatPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat New Password"
                    disabled={!isEditMode}
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && <p className="text-sm font-medium text-destructive">{error}</p>}
              {success && <p className="text-sm font-medium text-green-500">{success}</p>}

              <Button type="submit" className="w-full" disabled={isLoading || !isEditMode}>
                {isLoading ? 'Updating Password...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
