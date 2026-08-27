import { notFound } from 'next/navigation';

import { DeckDetailEditor } from '@/components/deck-detail/deck-detail-editor';
import { PageContent, PageShell } from '@/components/ui/page-shell';
import { getDeckById, getPokemonCardOptions } from '@/lib/api/decks';
import { getDeckDetail } from '@/lib/deck-detail';

export default async function DeckDetailPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;

  const [deck, cardOptions] = await Promise.all([getDeckById(deckId), getPokemonCardOptions()]);

  if (!deck) {
    notFound();
  }

  const dummyDetail = getDeckDetail(deck.id, deck.name);

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
        <DeckDetailEditor deck={deck} detail={detail} cardOptions={cardOptions} />
      </PageContent>
    </PageShell>
  );
}
