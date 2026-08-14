'use client';

import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import * as React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { deleteCurrentUserAccount } from '@/app/auth/auth-service';

export function DeleteAccountForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [deleteText, setDeleteText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleToggleEditMode = (checked: boolean) => {
    setIsEditMode(checked);
    if (!checked) {
      setDeleteText('');
      setError(null);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditMode || deleteText !== 'DELETE') return;

    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const result = await deleteCurrentUserAccount();

      if (result.error) {
        throw new Error(result.error);
      }

      await supabase.auth.signOut();

      router.push('/auth/login');
      setIsEditMode(false);
      setDeleteText('');
      setError(null);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to delete account');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted) {
    return (
      <div className={cn('flex flex-col gap-4', className)} {...props}>
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive">Danger Zone</CardTitle>
            <CardDescription>Loading security settings...</CardDescription>
          </CardHeader>
          <CardContent className="h-[200px]" />
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-2xl text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated decks. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDelete} autoComplete="off">
            <div className="flex flex-col gap-4">
              <div className="flex items-center space-x-4">
                <Switch
                  id="enable-delete"
                  checked={isEditMode}
                  onCheckedChange={handleToggleEditMode}
                />
                <Label
                  htmlFor="enable-delete"
                  className="text-foreground text-base leading-none cursor-pointer"
                >
                  I understand the consequences, unlock{' '}
                  <strong className={'text-destructive'}>DELETION</strong>.
                </Label>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="delete-confirm" className="text-base text-foreground">
                  Type <strong className={'text-destructive'}>DELETE</strong> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  name="delete-confirm"
                  type="text"
                  disabled={!isEditMode}
                  placeholder="DELETE"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  className="border-destructive/50 focus-visible:ring-destructive"
                />
              </div>

              {error && <p className="text-sm font-medium text-destructive">{error}</p>}

              <Button
                type="submit"
                variant="destructive"
                className="w-full sm:w-auto self-start"
                disabled={isLoading || !isEditMode || deleteText !== 'DELETE'}
              >
                {isLoading ? 'Purging data...' : 'Delete Account'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
