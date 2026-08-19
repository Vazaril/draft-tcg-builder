import { notFound } from 'next/navigation';

import { DeckAnalysisCard } from '@/components/deck-detail/deck-analysis-card';
import { DeckHeader } from '@/components/deck-detail/deck-header';
import { DeckListCard } from '@/components/deck-detail/deck-list-card';
import { SynergyScoreCard } from '@/components/deck-detail/synergy-score-card';
import { PageContent, PageShell } from '@/components/ui/page-shell';
import { getDeckDetail } from '@/lib/deck-detail';
import { mockDecks } from '@/lib/mock-decks';

export default async function DeckDetailPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const deck = mockDecks.find((entry) => entry.id === deckId);

  if (!deck) {
    notFound();
  }

  const detail = getDeckDetail(deck.id, deck.name);

  return (
    <PageShell>
      <PageContent className="space-y-6">
        <DeckHeader deck={deck} detail={detail} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DeckListCard entries={detail.cardlist} extraCardsCount={detail.extraCardsCount} />
          </div>
          <div className="space-y-6">
            <DeckAnalysisCard stats={detail.stats} />
            <SynergyScoreCard synergy={detail.synergy} />
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
