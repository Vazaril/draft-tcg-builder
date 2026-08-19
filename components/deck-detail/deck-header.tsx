'use client';

import { Check, Pencil, Share2 } from 'lucide-react';

import { GoalChips } from '@/components/deck-detail/goal-chips';
import { Button } from '@/components/ui/button';
import type { DeckDetail } from '@/lib/deck-detail';
import type { Deck } from '@/lib/mock-decks';

export function DeckHeader({
  deck,
  detail,
  isEditing,
  onEditChange,
}: {
  deck: Deck;
  detail: DeckDetail;
  isEditing: boolean;
  onEditChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-pixel text-2xl font-bold text-foreground sm:text-3xl">{deck.name}</h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {deck.game} &middot; {deck.format} &middot; zuletzt bearbeitet vor 2 Std.
          </p>
        </div>

        <div className="flex shrink-0 gap-3">
          <Button
            type="button"
            variant={isEditing ? 'default' : 'outline'}
            size="sm"
            onClick={() => onEditChange(!isEditing)}
          >
            {isEditing ? <Check /> : <Pencil />}
            {isEditing ? 'Fertig' : 'Bearbeiten'}
          </Button>

          <Button type="button" variant="outline" size="sm">
            <Share2 />
            Teilen
          </Button>
        </div>
      </div>

      <GoalChips goals={detail.goals} />
    </div>
  );
}
