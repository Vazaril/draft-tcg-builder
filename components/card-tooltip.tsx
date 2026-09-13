'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

interface CardTooltipProps {
  cardName: string;
}

export function CardTooltip({ cardName }: CardTooltipProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const cleanName = cardName.trim();
  const searchUrl = `https://scryfall.com/search?q=!%22${encodeURIComponent(cleanName)}%22`;
  const imageUrl = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cleanName)}&format=image&version=normal`;

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary transition-colors inline-flex items-center gap-0.5"
        >
          {cleanName}
        </a>
      </HoverCardTrigger>

      <HoverCardContent
        side="top"
        align="center"
        sideOffset={8}
        avoidCollisions={true}
        className="z-50 w-52 p-1.5 rounded-xl bg-popover text-popover-foreground border border-border shadow-2xl flex flex-col items-center"
      >
        {!imageLoaded && !imageError && (
          <div className="w-full aspect-[2.5/3.5] bg-muted animate-pulse rounded-lg flex items-center justify-center text-xs text-muted-foreground">
            Loading preview...
          </div>
        )}

        {imageError ? (
          <div className="w-full aspect-[2.5/3.5] bg-muted rounded-lg flex flex-col items-center justify-center p-3 text-center">
            <span className="text-xs font-semibold text-muted-foreground">
              Card preview unavailable
            </span>
            <span className="text-[10px] text-muted-foreground/70 mt-1">
              Click to search on Scryfall
            </span>
          </div>
        ) : (
          <Image
            src={imageUrl}
            alt={cleanName}
            width={208}
            height={291}
            unoptimized
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-auto rounded-lg shadow-sm transition-opacity duration-150 ${
              imageLoaded ? 'opacity-100' : 'opacity-0 absolute'
            }`}
          />
        )}

        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          View on Scryfall <ExternalLink className="w-3 h-3" />
        </a>
      </HoverCardContent>
    </HoverCard>
  );
}
