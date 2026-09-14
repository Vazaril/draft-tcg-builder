import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface DeckCard {
  id: string;
  name: string;
  quantity: number;
}

interface DeckLand {
  card_id: string;
  name: string;
  quantity: number;
}

interface DeckPayload {
  format: string;
  commander?: string | null;
  categories: Record<string, DeckCard[]>;
  lands?: DeckLand[];
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deck, name } = (await req.json()) as { deck: DeckPayload; name?: string };

    if (!deck) {
      return NextResponse.json({ error: 'No deck data provided' }, { status: 400 });
    }

    const { data: formatData, error: formatError } = await supabase
      .from('mtg_formats')
      .select('id')
      .ilike('name', deck.format)
      .single();

    if (formatError || !formatData) {
      return NextResponse.json({ error: 'Invalid or missing format in database' }, { status: 400 });
    }

    const oracleIdsToFetch = new Set<string>();
    const namesToFetch = new Set<string>();

    if (deck.commander) namesToFetch.add(deck.commander);

    deck.lands?.forEach((land) => namesToFetch.add(land.name));

    Object.values(deck.categories).forEach((categoryCards) => {
      categoryCards.forEach((card) => oracleIdsToFetch.add(card.id));
    });

    const { data: cardsData, error: cardsFetchError } = await supabase
      .from('mtg_cards')
      .select('id, oracle_id, name')
      .or(
        `oracle_id.in.(${Array.from(oracleIdsToFetch).join(',')}),name.in.(${Array.from(
          namesToFetch
        )
          .map((n) => `"${n}"`)
          .join(',')})`
      );

    if (cardsFetchError) {
      return NextResponse.json({ error: 'Failed to resolve card printings' }, { status: 500 });
    }

    const idByOracle = new Map<string, string>();
    const idByName = new Map<string, string>();

    cardsData?.forEach((card) => {
      if (!idByOracle.has(card.oracle_id)) idByOracle.set(card.oracle_id, card.id);
      if (!idByName.has(card.name.toLowerCase())) idByName.set(card.name.toLowerCase(), card.id);
    });

    const deckName =
      name || `Build ${deck.format.charAt(0).toUpperCase() + deck.format.slice(1)} Deck`;

    const { data: insertedDeck, error: deckError } = await supabase
      .from('mtg_decks')
      .insert({
        user_id: user.id,
        format_id: formatData.id,
        name: deckName,
        description: 'Build via Deck Builder AI',
      })
      .select('id')
      .single();

    if (deckError) throw deckError;
    const deckId = insertedDeck.id;

    const cardsMap = new Map<
      string,
      { deck_id: string; card_id: string; quantity: number; zone: string }
    >();

    const addCard = (cardId: string, quantity: number, zone: string) => {
      const key = `${cardId}-${zone}`;
      if (cardsMap.has(key)) {
        cardsMap.get(key)!.quantity += quantity;
      } else {
        cardsMap.set(key, { deck_id: deckId, card_id: cardId, quantity, zone });
      }
    };

    // Commander
    if (deck.commander) {
      const commanderId = idByName.get(deck.commander.toLowerCase());
      if (commanderId) {
        addCard(commanderId, 1, 'commander');
      }
    }

    // Mainboard (Categories)
    Object.values(deck.categories).forEach((categoryCards) => {
      categoryCards.forEach((card) => {
        const mappedId = idByOracle.get(card.id);
        if (mappedId) {
          addCard(mappedId, card.quantity, 'mainboard');
        }
      });
    });

    // Mainboard (Lands)
    deck.lands?.forEach((land) => {
      const mappedId = idByName.get(land.name.toLowerCase());
      if (mappedId) {
        addCard(mappedId, land.quantity, 'mainboard');
      }
    });

    const cardsToInsert = Array.from(cardsMap.values());

    // Batch Insert
    if (cardsToInsert.length > 0) {
      const { error: insertCardsError } = await supabase
        .from('mtg_deck_cards')
        .insert(cardsToInsert);

      if (insertCardsError) throw insertCardsError;
    }

    return NextResponse.json({ success: true, deckId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to save deck';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
