import { notFound } from 'next/navigation';

import { DeckDetailEditor } from '@/components/deck-detail/deck-detail-editor';
import { PageContent, PageShell } from '@/components/ui/page-shell';
import {
  getCardOptions,
  getDeckById,
  type MagicDeckCardEntry,
  type PokemonDeckCardEntry,
} from '@/lib/api/decks';
import { getDeckDetail } from '@/lib/deck-detail';

export default async function DeckDetailPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;

  const deck = await getDeckById(deckId);

  if (!deck) {
    notFound();
  }

  // Karten passend zum Spiel laden
  const cardOptions = await getCardOptions(deck.gameType);

  // Dummy-Daten für Analyse und Synergie
  const dummyDetail = getDeckDetail(deck.id, deck.name);

  const cardlist =
    deck.gameType === 'pokemon'
      ? deck.cards.map((entry) => {
          const pokemonEntry = entry as PokemonDeckCardEntry;

          return {
            id: pokemonEntry.id,
            name: pokemonEntry.pokemon_cards.name,
            quantity: pokemonEntry.quantity,
            category: pokemonEntry.pokemon_cards.card_type ?? 'Unbekannt',
            reasoning: pokemonEntry.reasoning ?? '',
          };
        })
      : deck.cards.map((entry) => {
          const magicEntry = entry as MagicDeckCardEntry;

          return {
            // Magic hat keine eigene mtg_deck_cards.id
            id: magicEntry.card_id,
            name: magicEntry.mtg_cards.name,
            quantity: magicEntry.quantity,
            category: magicEntry.mtg_cards.type_line ?? 'Unbekannt',
            reasoning: '',
            zone: magicEntry.zone,
          };
        });

  const detail = {
    ...dummyDetail,

    goals: deck.tags,

    cardlist,

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
