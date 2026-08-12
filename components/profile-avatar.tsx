import * as React from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface ProfileAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  username: string;
  avatarUrl?: string;
}

export function ProfileAvatar({ username, avatarUrl, className, ...props }: ProfileAvatarProps) {
  const initials = username ? username.substring(0, 2).toUpperCase() : '??';

  return (
    <div className={cn('flex flex-col gap-4', className)} {...props}>
      <div
        className={cn(
          'flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden',
          'rounded-2xl border-2 border-primary bg-primary/10 text-primary',
          'shadow-[0_0_15px_hsl(var(--primary)/0.2)]'
        )}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={`${username}'s avatar`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-pixel text-4xl tracking-widest">{initials}</span>
        )}
      </div>

      <div className="flex flex-col">
        <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
          Username
        </span>
        <h2 className="font-pixel text-2xl font-bold text-foreground">{username}</h2>
      </div>
    </div>
  );
}
