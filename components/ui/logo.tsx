import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-8 h-8 shrink-0', className)}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g className="stroke-primary fill-background" strokeWidth="2" strokeLinejoin="round">
        <rect x="12" y="22" width="22" height="32" rx="2.5" transform="rotate(-18 23 38)" />
        <rect x="30" y="22" width="22" height="32" rx="2.5" transform="rotate(18 41 38)" />
      </g>

      <g filter="url(#draft-logo-shadow)">
        <rect
          x="20"
          y="10"
          width="24"
          height="36"
          rx="3"
          className="fill-primary stroke-background"
          strokeWidth="1.5"
        />

        <path
          d="M32 17 L33.5 24.5 L41 26 L33.5 27.5 L32 35 L30.5 27.5 L23 26 L30.5 24.5 Z"
          className="fill-background"
        />

        <rect
          x="25"
          y="38"
          width="14"
          height="1.5"
          rx="0.75"
          className="fill-background opacity-90"
        />
        <rect
          x="25"
          y="41.5"
          width="8"
          height="1.5"
          rx="0.75"
          className="fill-background opacity-90"
        />
      </g>

      <defs>
        <filter
          id="draft-logo-shadow"
          x="0"
          y="0"
          width="64"
          height="64"
          filterUnits="userSpaceOnUse"
        >
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" floodColor="#000000" />
        </filter>
      </defs>
    </svg>
  );
}
