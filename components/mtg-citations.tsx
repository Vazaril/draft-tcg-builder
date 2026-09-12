'use client';

import { ChevronDown } from 'lucide-react';
import { Citation } from '@/hooks/use-chat-stream';

interface MTGCitationsProps {
  citations: Citation[];
}

export function MTGCitations({ citations }: MTGCitationsProps) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-1.5 w-[85%]">
      <details className="text-[11px] w-full group">
        <summary className="cursor-pointer font-medium select-none list-none inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <span className="bg-background border border-border px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
            {citations.length} sources consulted
            <ChevronDown className="w-3 h-3 transition-transform duration-200 group-open:rotate-180" />
          </span>
        </summary>

        <div className="mt-2 p-1.5 rounded-lg bg-background border border-border shadow-inner space-y-1">
          {citations.map((ctx, cIdx) => {
            const name = ctx.name || ctx.card_name || 'Unknown Source';
            const type =
              ctx.type === 'ruling' ? 'Ruling' : ctx.type === 'card' ? 'Oracle Text' : 'Reference';

            return (
              <div
                key={cIdx}
                className="flex justify-between items-center bg-muted/50 px-2 py-1.5 rounded border border-border/40"
              >
                <span className="font-medium text-foreground truncate pr-2">{name}</span>
                <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground bg-background px-1.5 py-0.5 rounded shrink-0 shadow-sm">
                  {type}
                </span>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
