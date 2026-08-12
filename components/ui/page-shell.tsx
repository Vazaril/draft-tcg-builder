import * as React from 'react';
import { cn } from '@/lib/utils';

const PageShell = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-8', className)} {...props} />
  )
);
PageShell.displayName = 'PageShell';

const PageHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-2', className)} {...props} />
  )
);
PageHeader.displayName = 'PageHeader';

const PageTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h1
      ref={ref}
      className={cn(
        'font-pixel text-3xl font-bold tracking-tight text-secondary-foreground',
        className
      )}
      {...props}
    />
  )
);
PageTitle.displayName = 'PageTitle';

const PageDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-base', className)} {...props} />
));
PageDescription.displayName = 'PageDescription';

const PageContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-6', className)} {...props} />
  )
);
PageContent.displayName = 'PageContent';

export { PageShell, PageHeader, PageTitle, PageDescription, PageContent };
