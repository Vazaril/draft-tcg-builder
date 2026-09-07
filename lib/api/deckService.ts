'use server';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type DeckAccent = 'primary' | 'secondary' | 'accent' | 'muted';

export type DeckGameType = 'pokemon' | 'magic';

export type Deck = {
  id: string;
  name: string;
  game: string;
  gameType: DeckGameType;
  format: string;
  tags: string[];
  accent: DeckAccent;
};

export type PokemonCard = {
  id: string;
  name: string;
  card_type: string | null;
  subtype: string | null;
  regulation_mark: string | null;
};

export type MagicCard = {
  id: string;
  name: string;
  mana_cost: string | null;
  cmc: number | null;
  type_line: string | null;
  oracle_text: string | null;
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  colors: string[] | null;
  color_identity: string[] | null;
  keywords: string[] | null;
  image_uri: string | null;
  set_code: string | null;
  set_name: string | null;
  rarity: string | null;
  legalities: Record<string, string> | null;
};

export type PokemonDeckCardEntry = {
  id: string;
  card_id: string;
  quantity: number;
  position: number | null;
  reasoning: string | null;
  pokemon_cards: PokemonCard;
};

export type MagicDeckCardEntry = {
  card_id: string;
  quantity: number;
  zone: string;
  mtg_cards: MagicCard;
};

export type DeckCardEntry = PokemonDeckCardEntry | MagicDeckCardEntry;

export type DeckDetailData = Deck & {
  description: string | null;
  created_at: string;
  updated_at: string;
  cards: DeckCardEntry[];
};

export type PokemonCardOption = {
  id: string;
  name: string;
  card_type: string | null;
  subtype: string | null;
  regulation_mark: string | null;
};

export type MagicCardOption = {
  id: string;
  name: string;
  mana_cost: string | null;
  type_line: string | null;
  rarity: string | null;
  image_uri: string | null;
};

export type CardOption = PokemonCardOption | MagicCardOption;

// ==========================================================
// Interner Helper: Decktyp bestimmen ('pokemon' | 'magic' | null)
// Entspricht _get_deck_type() aus dem alten Flask-Backend.
// ==========================================================

async function getDeckType(
  supabase: SupabaseServerClient,
  deckId: string
): Promise<DeckGameType | null> {
  const { data: pokemonRows } = await supabase.from('decks').select('id').eq('id', deckId).limit(1);

  if (pokemonRows && pokemonRows.length > 0) {
    return 'pokemon';
  }

  const { data: magicRows } = await supabase
    .from('mtg_decks')
    .select('id')
    .eq('id', deckId)
    .limit(1);

  if (magicRows && magicRows.length > 0) {
    return 'magic';
  }

  return null;
}

// ==========================================================
// Interner Helper: Karte löschen / Menge reduzieren
// Entspricht _delete_or_reduce_card() aus dem alten Flask-Backend.
// Gibt ein Ergebnis-Objekt zurück, wirft NICHT — wird für Bulk-Operationen
// gebraucht, bei denen einzelne Karten fehlschlagen dürfen, ohne dass die
// ganze Operation abbricht.
// ==========================================================

type DeleteCardResult =
  | {
      card_id: string;
      game_type: DeckGameType;
      zone?: string;
      deleted: boolean;
      remaining_quantity: number;
    }
  | { card_id: string | null; error: string; status: number };

async function deleteOrReduceCard(
  supabase: SupabaseServerClient,
  deckId: string,
  cardId: string,
  amount?: number | null,
  zone?: string | null
): Promise<DeleteCardResult> {
  const deckType = await getDeckType(supabase, deckId);

  if (!deckType) {
    return { card_id: cardId, error: 'Deck nicht gefunden.', status: 404 };
  }

  if (deckType === 'pokemon') {
    const { data: rows } = await supabase
      .from('pokemon_deck_cards')
      .select('id, quantity')
      .eq('id', cardId)
      .eq('deck_id', deckId)
      .limit(1);

    if (!rows || rows.length === 0) {
      return { card_id: cardId, error: 'Karte nicht gefunden.', status: 404 };
    }

    const currentQuantity: number = rows[0].quantity;
    const amountToRemove = amount ?? currentQuantity;

    if (amountToRemove <= 0) {
      return { card_id: cardId, error: 'amount muss größer als 0 sein.', status: 400 };
    }

    if (amountToRemove >= currentQuantity) {
      await supabase.from('pokemon_deck_cards').delete().eq('id', cardId).eq('deck_id', deckId);

      return { card_id: cardId, game_type: 'pokemon', deleted: true, remaining_quantity: 0 };
    }

    const newQuantity = currentQuantity - amountToRemove;

    await supabase
      .from('pokemon_deck_cards')
      .update({ quantity: newQuantity })
      .eq('id', cardId)
      .eq('deck_id', deckId);

    return {
      card_id: cardId,
      game_type: 'pokemon',
      deleted: false,
      remaining_quantity: newQuantity,
    };
  }

  // Magic
  let query = supabase
    .from('mtg_deck_cards')
    .select('card_id, quantity, zone')
    .eq('deck_id', deckId)
    .eq('card_id', cardId);

  if (zone) {
    query = query.eq('zone', zone);
  }

  const { data: rows } = await query.limit(1);

  if (!rows || rows.length === 0) {
    return { card_id: cardId, error: 'Karte nicht gefunden.', status: 404 };
  }

  const card = rows[0];
  const currentQuantity: number = card.quantity;
  const cardZone: string = card.zone;
  const amountToRemove = amount ?? currentQuantity;

  if (amountToRemove <= 0) {
    return { card_id: cardId, error: 'amount muss größer als 0 sein.', status: 400 };
  }

  if (amountToRemove >= currentQuantity) {
    await supabase
      .from('mtg_deck_cards')
      .delete()
      .eq('deck_id', deckId)
      .eq('card_id', cardId)
      .eq('zone', cardZone);

    return {
      card_id: cardId,
      game_type: 'magic',
      zone: cardZone,
      deleted: true,
      remaining_quantity: 0,
    };
  }

  const newQuantity = currentQuantity - amountToRemove;

  await supabase
    .from('mtg_deck_cards')
    .update({ quantity: newQuantity })
    .eq('deck_id', deckId)
    .eq('card_id', cardId)
    .eq('zone', cardZone);

  return {
    card_id: cardId,
    game_type: 'magic',
    zone: cardZone,
    deleted: false,
    remaining_quantity: newQuantity,
  };
}

// ==========================================================
// getUserDecks — reine Lesefunktion, KEIN Server Action.
// Nur aus Server Components aufrufen.
// ==========================================================

export async function getUserDecks(): Promise<Deck[]> {
  const supabase = await createClient();

  const [pokemonResult, magicResult] = await Promise.all([
    supabase.from('decks').select('*, games(id, name)').order('updated_at', { ascending: false }),
    supabase.from('mtg_decks').select('*').order('updated_at', { ascending: false }),
  ]);

  if (pokemonResult.error) {
    throw new Error('Pokémon-Decks konnten nicht geladen werden.');
  }

  if (magicResult.error) {
    throw new Error('Magic-Decks konnten nicht geladen werden.');
  }

  const pokemonDecks = (pokemonResult.data ?? []).map((deck) => ({
    id: deck.id as string,
    name: deck.name as string,
    game: (deck.games?.name as string | undefined) ?? 'Pokémon TCG',
    gameType: 'pokemon' as const,
    format: (deck.format as string | null) ?? '',
    tags: (deck.tags as string[] | null) ?? [],
    accent: ((deck.accent as DeckAccent | null) ?? 'primary') as DeckAccent,
    updatedAt: (deck.updated_at as string | null) ?? '',
  }));

  // Magic-Format-Namen nachladen (mtg_decks.format_id -> mtg_formats.name)
  const magicDecks = await Promise.all(
    (magicResult.data ?? []).map(async (deck) => {
      let formatName = '';

      if (deck.format_id) {
        const { data: formatRows } = await supabase
          .from('mtg_formats')
          .select('name')
          .eq('id', deck.format_id)
          .limit(1);

        formatName = formatRows?.[0]?.name ?? '';
      }

      return {
        id: deck.id as string,
        name: deck.name as string,
        game: 'Magic: The Gathering',
        gameType: 'magic' as const,
        format: formatName,
        tags: [] as string[],
        accent: 'secondary' as DeckAccent,
        updatedAt: (deck.updated_at as string | null) ?? '',
      };
    })
  );

  return [...pokemonDecks, ...magicDecks]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ updatedAt: _updatedAt, ...deck }) => deck);
}

// ==========================================================
// getDeckById — reine Lesefunktion, KEIN Server Action.
// ==========================================================

export async function getDeckById(deckId: string): Promise<DeckDetailData | null> {
  const supabase = await createClient();

  const { data: pokemonRows, error: pokemonError } = await supabase
    .from('decks')
    .select('*, games(id, name)')
    .eq('id', deckId)
    .limit(1);

  if (pokemonError) {
    throw new Error('Deck konnte nicht geladen werden.');
  }

  if (pokemonRows && pokemonRows.length > 0) {
    const deck = pokemonRows[0];

    const { data: cards, error: cardsError } = await supabase
      .from('pokemon_deck_cards')
      .select(
        `id, card_id, quantity, position, reasoning,
         pokemon_cards ( id, name, card_type, subtype, regulation_mark )`
      )
      .eq('deck_id', deckId)
      .order('position');

    if (cardsError) {
      throw new Error('Karten konnten nicht geladen werden.');
    }

    return {
      id: deck.id,
      name: deck.name,
      game: deck.games?.name ?? 'Pokémon TCG',
      gameType: 'pokemon',
      format: deck.format ?? '',
      tags: deck.tags ?? [],
      accent: deck.accent ?? 'primary',
      description: deck.description ?? null,
      created_at: deck.created_at,
      updated_at: deck.updated_at,
      cards: (cards ?? []) as unknown as PokemonDeckCardEntry[],
    };
  }

  const { data: magicRows, error: magicError } = await supabase
    .from('mtg_decks')
    .select('*')
    .eq('id', deckId)
    .limit(1);

  if (magicError) {
    throw new Error('Deck konnte nicht geladen werden.');
  }

  if (!magicRows || magicRows.length === 0) {
    return null;
  }

  const deck = magicRows[0];

  let formatName = '';

  if (deck.format_id) {
    const { data: formatRows } = await supabase
      .from('mtg_formats')
      .select('name')
      .eq('id', deck.format_id)
      .limit(1);

    formatName = formatRows?.[0]?.name ?? '';
  }

  const { data: deckCards, error: deckCardsError } = await supabase
    .from('mtg_deck_cards')
    .select('card_id, quantity, zone')
    .eq('deck_id', deckId);

  if (deckCardsError) {
    throw new Error('Karten konnten nicht geladen werden.');
  }

  const cards: MagicDeckCardEntry[] = [];

  for (const entry of deckCards ?? []) {
    const { data: cardRows } = await supabase
      .from('mtg_cards')
      .select(
        `id, name, mana_cost, cmc, type_line, oracle_text, power, toughness,
         loyalty, colors, color_identity, keywords, image_uri, set_code,
         set_name, rarity, legalities`
      )
      .eq('id', entry.card_id)
      .limit(1);

    if (!cardRows || cardRows.length === 0) {
      continue;
    }

    cards.push({
      card_id: entry.card_id,
      quantity: entry.quantity,
      zone: entry.zone,
      mtg_cards: cardRows[0] as unknown as MagicCard,
    });
  }

  return {
    id: deck.id,
    name: deck.name,
    game: 'Magic: The Gathering',
    gameType: 'magic',
    format: formatName,
    tags: [],
    accent: 'secondary',
    description: deck.description ?? null,
    created_at: deck.created_at,
    updated_at: deck.updated_at,
    cards,
  };
}

// ==========================================================
// getCardOptions — reine Lesefunktion, KEIN Server Action.
// ==========================================================

export async function getCardOptions(gameType: DeckGameType): Promise<CardOption[]> {
  const supabase = await createClient();

  if (gameType === 'magic') {
    const { data, error } = await supabase
      .from('mtg_cards')
      .select('id, name, mana_cost, type_line, rarity, image_uri')
      .order('name');

    if (error) {
      throw new Error('Karten konnten nicht geladen werden.');
    }

    return (data ?? []) as MagicCardOption[];
  }

  const { data, error } = await supabase
    .from('pokemon_cards')
    .select('id, name, card_type, subtype, regulation_mark')
    .order('name');

  if (error) {
    throw new Error('Karten konnten nicht geladen werden.');
  }

  return (data ?? []) as PokemonCardOption[];
}

export async function getPokemonCardOptions(): Promise<PokemonCardOption[]> {
  return getCardOptions('pokemon') as Promise<PokemonCardOption[]>;
}

export async function getMagicCardOptions(): Promise<MagicCardOption[]> {
  return getCardOptions('magic') as Promise<MagicCardOption[]>;
}

// ==========================================================
// deleteDeckCards — Server Action (Mutation).
// Bulk-Löschen/Reduzieren mehrerer Karten. Wirft NUR, wenn die Eingabe
// selbst ungültig ist ('cards' fehlt/leer) — einzelne Karten, die fehlschlagen
// (z.B. nicht gefunden), landen als {error: ...} in results, analog zum
// alten 207-Verhalten des Flask-Endpoints.
// ==========================================================

export async function deleteDeckCards(
  deckId: string,
  cards: { card_id: string; amount?: number; zone?: string }[]
) {


  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error("'cards' muss eine nicht-leere Liste sein.");
  }

  const supabase = await createClient();

  const results = await Promise.all(
    cards.map((entry): Promise<DeleteCardResult> => {
      if (!entry.card_id) {
        return Promise.resolve({ card_id: null, error: 'card_id fehlt.', status: 400 });
      }

      if (entry.amount !== undefined && (!Number.isInteger(entry.amount) || entry.amount <= 0)) {
        return Promise.resolve({
          card_id: entry.card_id,
          error: 'amount muss eine ganze Zahl größer als 0 sein.',
          status: 400,
        });
      }

      return deleteOrReduceCard(supabase, deckId, entry.card_id, entry.amount, entry.zone);
    })
  );

  revalidatePath(`/protected/decks/${deckId}`);

  return { results };
}

// ==========================================================
// addDeckCard — Server Action (Mutation).
// ==========================================================

export async function addDeckCard(
  deckId: string,
  card: {
    card_id: string;
    quantity: number;
    // Pokémon
    position?: number | null;
    reasoning?: string | null;
    // Magic
    zone?: string;
  }
) {

  if (!card.card_id) {
    throw new Error('card_id fehlt.');
  }

  if (!Number.isInteger(card.quantity) || card.quantity <= 0) {
    throw new Error('quantity muss eine ganze Zahl größer als 0 sein.');
  }

  const supabase = await createClient();
  const deckType = await getDeckType(supabase, deckId);

  if (!deckType) {
    throw new Error('Deck nicht gefunden.');
  }

  if (deckType === 'pokemon') {
    const { data: pokemonCardRows } = await supabase
      .from('pokemon_cards')
      .select('id, name, card_type, subtype, regulation_mark')
      .eq('id', card.card_id)
      .limit(1);

    if (!pokemonCardRows || pokemonCardRows.length === 0) {
      throw new Error('Pokémon-Karte nicht gefunden.');
    }

    const { data: existingRows } = await supabase
      .from('pokemon_deck_cards')
      .select('id, card_id, quantity, position, reasoning')
      .eq('deck_id', deckId)
      .eq('card_id', card.card_id)
      .limit(1);

    let deckCardId: string;

    if (existingRows && existingRows.length > 0) {
      const existing = existingRows[0];
      const newQuantity = existing.quantity + card.quantity;

      const updateData: Record<string, unknown> = { quantity: newQuantity };

      if (card.position !== undefined && card.position !== null) {
        updateData.position = card.position;
      }

      if (card.reasoning !== undefined && card.reasoning !== null) {
        updateData.reasoning = card.reasoning;
      }

      await supabase.from('pokemon_deck_cards').update(updateData).eq('id', existing.id);

      deckCardId = existing.id;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('pokemon_deck_cards')
        .insert({
          deck_id: deckId,
          card_id: card.card_id,
          quantity: card.quantity,
          position: card.position ?? null,
          reasoning: card.reasoning ?? null,
        })
        .select('id');

      if (insertError || !inserted || inserted.length === 0) {
        throw new Error('Karte konnte nicht hinzugefügt werden.');
      }

      deckCardId = inserted[0].id;
    }

    const { data: resultRows, error: resultError } = await supabase
      .from('pokemon_deck_cards')
      .select(
        `id, card_id, quantity, position, reasoning,
     pokemon_cards ( id, name, card_type, subtype, regulation_mark )`
      )
      .eq('id', deckCardId)
      .limit(1);

    if (resultError) {
      throw new Error('Karte konnte nach dem Speichern nicht geladen werden.');
    }

    if (!resultRows || resultRows.length === 0) {
      throw new Error('Karte konnte nach dem Speichern nicht geladen werden.');
    }

    const result = resultRows[0];

    const pokemonCard = Array.isArray(result.pokemon_cards)
      ? result.pokemon_cards[0]
      : result.pokemon_cards;

    if (!pokemonCard) {
      throw new Error('Pokémon-Kartendaten konnten nicht geladen werden.');
    }

    revalidatePath(`/protected/decks/${deckId}`);

    return {
      id: result.id,
      card_id: result.card_id,
      quantity: result.quantity,
      position: result.position,
      reasoning: result.reasoning,
      pokemon_cards: {
        id: pokemonCard.id,
        name: pokemonCard.name,
        card_type: pokemonCard.card_type,
        subtype: pokemonCard.subtype,
        regulation_mark: pokemonCard.regulation_mark,
      },
    };
  }

  // Magic
  const zone = card.zone ?? 'mainboard';
  const validZones = new Set(['mainboard', 'sideboard', 'commander', 'maybeboard']);

  if (!validZones.has(zone)) {
    throw new Error('Ungültige zone.');
  }

  const { data: magicCardRows } = await supabase
    .from('mtg_cards')
    .select('id, name, mana_cost, type_line, rarity, image_uri')
    .eq('id', card.card_id)
    .limit(1);

  if (!magicCardRows || magicCardRows.length === 0) {
    throw new Error('Magic-Karte nicht gefunden.');
  }

  const { data: existingRows } = await supabase
    .from('mtg_deck_cards')
    .select('card_id, quantity, zone')
    .eq('deck_id', deckId)
    .eq('card_id', card.card_id)
    .eq('zone', zone)
    .limit(1);

  let newQuantity: number;

  if (existingRows && existingRows.length > 0) {
    newQuantity = existingRows[0].quantity + card.quantity;

    await supabase
      .from('mtg_deck_cards')
      .update({ quantity: newQuantity })
      .eq('deck_id', deckId)
      .eq('card_id', card.card_id)
      .eq('zone', zone);
  } else {
    newQuantity = card.quantity;

    await supabase.from('mtg_deck_cards').insert({
      deck_id: deckId,
      card_id: card.card_id,
      quantity: newQuantity,
      zone,
    });
  }

  revalidatePath(`/protected/decks/${deckId}`);

  return {
    card_id: card.card_id,
    quantity: newQuantity,
    zone,
    mtg_cards: magicCardRows[0],
  };
}

// ==========================================================
// deleteDeck — Server Action (Mutation).
// ==========================================================

export async function deleteDeck(deckId: string) {

  const supabase = await createClient();
  const deckType = await getDeckType(supabase, deckId);

  if (!deckType) {
    throw new Error('Deck nicht gefunden.');
  }

  if (deckType === 'pokemon') {
    await supabase.from('pokemon_deck_cards').delete().eq('deck_id', deckId);
    await supabase.from('pokemon_decks').delete().eq('deck_id', deckId);
    await supabase.from('deck_tags').delete().eq('deck_id', deckId);
    await supabase.from('decks').delete().eq('id', deckId);
  } else {
    await supabase.from('mtg_deck_cards').delete().eq('deck_id', deckId);
    await supabase.from('mtg_decks').delete().eq('id', deckId);
  }

  revalidatePath('/protected/decks');

  return { deck_id: deckId, game_type: deckType };
}

// ==========================================================
// createDeck — noch nicht implementiert (wie im alten Flask-Backend).
// ==========================================================

export async function createDeck(): Promise<never> {

  throw new Error('createDeck ist noch nicht implementiert.');
}
