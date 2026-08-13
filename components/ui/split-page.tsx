import * as React from 'react';
import { cn } from '@/lib/utils';

const SplitPage = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('grid min-h-screen w-full lg:grid-cols-2', className)}
      {...props}
    />
  )
);
SplitPage.displayName = 'SplitPage';

const SplitPageFormPane = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex min-h-[75svh] flex-col justify-center p-8 sm:p-12 lg:min-h-0 lg:p-24',
        className
      )}
      {...props}
    />
  )
);
SplitPageFormPane.displayName = 'SplitPageFormPane';

const SplitPageShowcasePane = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex flex-col items-center justify-center border-t border-border bg-muted/20 p-8 sm:p-12 lg:border-l lg:border-t-0 lg:p-24',
      className
    )}
    {...props}
  />
));
SplitPageShowcasePane.displayName = 'SplitPageShowcasePane';

export { SplitPage, SplitPageFormPane, SplitPageShowcasePane };
