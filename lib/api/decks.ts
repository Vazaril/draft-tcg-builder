'use server';

import { createClient } from '@/lib/supabase/server';

const API_URL = 'http://127.0.0.1:5001';

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

export type DeckSummary = {
  id: string;
  name: string;
  description: string | null;
  format: string | null;
  tags: string[];
  accent: DeckAccent;

  game: string;
  game_type: DeckGameType;

  created_at: string;
  updated_at: string;
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

type BackendDeckDetail = DeckSummary & {
  cards: DeckCardEntry[];
};

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
// getUserDecks
// ==========================================================

export async function getUserDecks(): Promise<Deck[]> {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Kein Access Token vorhanden');
  }

  const response = await fetch(`${API_URL}/api/decks`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Decks konnten nicht geladen werden');
  }

  const decks: DeckSummary[] = await response.json();

  return decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    game: deck.game,
    gameType: deck.game_type,
    format: deck.format ?? '',
    tags: deck.tags ?? [],
    accent: deck.accent,
  }));
}

// ==========================================================
// getDeckById
// ==========================================================

export async function getDeckById(deckId: string): Promise<DeckDetailData | null> {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Kein Access Token vorhanden');
  }

  const response = await fetch(`${API_URL}/api/decks/${deckId}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Deck konnte nicht geladen werden');
  }

  const deck: BackendDeckDetail = await response.json();

  return {
    id: deck.id,
    name: deck.name,
    game: deck.game,
    gameType: deck.game_type,
    format: deck.format ?? '',
    tags: deck.tags ?? [],
    accent: deck.accent,

    description: deck.description,
    created_at: deck.created_at,
    updated_at: deck.updated_at,

    cards: deck.cards ?? [],
  };
}

// ==========================================================
// deleteDeckCards
// ==========================================================

export async function deleteDeckCards(
  deckId: string,
  cards: {
    card_id: string;
    amount: number;
    zone?: string;
  }[]
) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Nicht angemeldet.');
  }

  const response = await fetch(`${API_URL}/api/decks/${deckId}/cards/bulk-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      cards,
    }),
    cache: 'no-store',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Karten konnten nicht gelöscht werden.');
  }

  return data;
}

// ==========================================================
// getCardOptions
// ==========================================================

export async function getCardOptions(gameType: DeckGameType): Promise<CardOption[]> {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Kein Access Token vorhanden');
  }

  const response = await fetch(`${API_URL}/api/decks/card-options?game_type=${gameType}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Karten konnten nicht geladen werden.');
  }

  return response.json();
}

// ==========================================================
// optional: Pokémon-spezifischer Wrapper
// Damit dein bestehender Code erstmal weiter funktioniert
// ==========================================================

export async function getPokemonCardOptions(): Promise<PokemonCardOption[]> {
  return getCardOptions('pokemon') as Promise<PokemonCardOption[]>;
}

// ==========================================================
// optional: Magic-spezifischer Wrapper
// ==========================================================

export async function getMagicCardOptions(): Promise<MagicCardOption[]> {
  return getCardOptions('magic') as Promise<MagicCardOption[]>;
}

// ==========================================================
// addDeckCard
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
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Nicht angemeldet.');
  }

  const response = await fetch(`${API_URL}/api/decks/${deckId}/cards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(card),
    cache: 'no-store',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Karte konnte nicht hinzugefügt werden.');
  }

  return data;
}

// ==========================================================
// deleteDeck
// ==========================================================

export async function deleteDeck(deckId: string) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Nicht angemeldet.');
  }

  const response = await fetch(`${API_URL}/api/decks/${deckId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: 'no-store',
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message ?? 'Deck konnte nicht gelöscht werden.');
  }

  return data;
}
