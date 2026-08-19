import { notFound } from 'next/navigation';

import { DeckDetailEditor } from '@/components/deck-detail/deck-detail-editor';
import { PageContent, PageShell } from '@/components/ui/page-shell';
import { getDeckDetail } from '@/lib/deck-detail';
import { mockDecks } from '@/lib/mock-decks';

export default async function DeckDetailPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;

  const deck = mockDecks.find((entry) => entry.id === deckId);

  if (!deck) {
    notFound();
  }

  const detail = getDeckDetail(deck.id, deck.name);

  return (
    <PageShell>
      <PageContent className="space-y-6">
        <DeckDetailEditor deck={deck} detail={detail} />
      </PageContent>
    </PageShell>
  );
}
