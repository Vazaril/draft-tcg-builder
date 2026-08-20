import { notFound } from 'next/navigation';

import { DeckDetailEditor } from '@/components/deck-detail/deck-detail-editor';
import { PageContent, PageShell } from '@/components/ui/page-shell';
import { getDeckById } from '@/lib/api/decks';
import { getDeckDetail } from '@/lib/deck-detail';

export default async function DeckDetailPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;

  const deck = await getDeckById(deckId);

  if (!deck) {
    notFound();
  }

  // Dummy-Daten für Analyse und Synergie
  const dummyDetail = getDeckDetail(deck.id, deck.name);

  // Echte Deckdaten einsetzen
  const detail = {
    ...dummyDetail,

    goals: deck.tags,

    cardlist: deck.cards.map((entry) => ({
      id: entry.id,
      name: entry.pokemon_cards.name,
      quantity: entry.quantity,
      category: entry.pokemon_cards.card_type ?? 'Unbekannt',
      reasoning: entry.reasoning ?? '',
    })),

    extraCardsCount: 0,
  };

  return (
    <PageShell>
      <PageContent className="space-y-6">
        <DeckDetailEditor deck={deck} detail={detail} />
      </PageContent>
    </PageShell>
  );
}
