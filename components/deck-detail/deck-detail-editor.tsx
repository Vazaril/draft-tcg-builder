'use client';

import { useState } from 'react';

import { DeckAnalysisCard } from '@/components/deck-detail/deck-analysis-card';
import { DeckHeader } from '@/components/deck-detail/deck-header';
import { DeckListCard } from '@/components/deck-detail/deck-list-card';
import { SynergyScoreCard } from '@/components/deck-detail/synergy-score-card';

import type { DeckDetail } from '@/lib/deck-detail';
import type { Deck } from '@/lib/mock-decks';

export function DeckDetailEditor({ deck, detail }: { deck: Deck; detail: DeckDetail }) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      <DeckHeader deck={deck} detail={detail} isEditing={isEditing} onEditChange={setIsEditing} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DeckListCard
            entries={detail.cardlist}
            extraCardsCount={detail.extraCardsCount}
            isEditing={isEditing}
          />
        </div>

        <div className="space-y-6">
          <DeckAnalysisCard stats={detail.stats} />
          <SynergyScoreCard synergy={detail.synergy} />
        </div>
      </div>
    </>
  );
}
