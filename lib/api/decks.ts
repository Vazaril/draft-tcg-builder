import { createClient } from '@/lib/supabase/server';

const API_URL = 'http://127.0.0.1:5001';

export type DeckAccent = 'primary' | 'secondary' | 'accent' | 'muted';

export type Deck = {
  id: string;
  name: string;
  game: string;
  format: string;
  tags: string[];
  accent: DeckAccent;
};

export type DeckSummary = {
  id: string;
  user_id: string;
  game_id: string;
  name: string;
  description: string | null;
  format: string | null;
  tags: string[];
  accent: DeckAccent;

  games: {
    id: string;
    name: string;
  };

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

export type DeckCardEntry = {
  id: string;
  card_id: string;
  quantity: number;
  position: number | null;
  reasoning: string | null;
  pokemon_cards: PokemonCard;
};

type BackendDeckDetail = DeckSummary & {
  cards: DeckCardEntry[];
};

export type DeckDetailData = Deck & {
  description: string | null;
  created_at: string;
  updated_at: string;
  cards: DeckCardEntry[];
};

// getUserDecks ######################################

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
    game: deck.games.name,
    format: deck.format ?? '',
    tags: deck.tags ?? [],
    accent: deck.accent,
  }));
}

// getDeckById ######################################
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

    game: deck.games.name,

    format: deck.format ?? '',
    tags: deck.tags ?? [],
    accent: deck.accent,

    description: deck.description,
    created_at: deck.created_at,
    updated_at: deck.updated_at,

    cards: deck.cards ?? [],
  };
}