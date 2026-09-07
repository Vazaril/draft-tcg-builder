export type DeckListEntry = {
  id: string;
  quantity: number;
  name: string;
  category: string;
  reasoning: string;
  zone?: string;
};

export type StatRow = { label: string; value: string };

export type SynergyScore = { percent: number; headline: string; description: string };

export type DeckDetail = {
  goals: string[];
  cardlist: DeckListEntry[];
  extraCardsCount: number;
  stats: StatRow[];
  synergy: SynergyScore;
};

// Hand-written detail data for decks we've mocked up in full (currently just
// the one from the design). Every other deck falls back to
// buildPlaceholderDetail below until real deck data comes from the database.
const deckDetails: Record<string, DeckDetail> = {
  'tidal-wyrm': {
    goals: ['Meta-Overall', 'Budget-Version', 'Turnier-legal', 'Schnelles Tempo'],
    cardlist: [
      {
        id: 'kingdra-ex',
        quantity: 4,
        name: 'Kingdra ex – Wasser',
        category: 'Pokémon',
        reasoning:
          'Hauptsächlich hohe Schadenswerte und Synergie mit "Dratini"-Karten; füllt die Rolle des Late-Game-Abschlusses und passt zum Wasser/Drachen-Archetyp des Decks.',
      },
      {
        id: 'dragapult-v',
        quantity: 4,
        name: 'Dragapult V – Drache',
        category: 'Pokémon',
        reasoning: 'Solide Bedrohung mit hohem Tempo, die die Energiekurve des Decks beschleunigt.',
      },
      {
        id: 'rare-candy',
        quantity: 3,
        name: 'Rare Candy – Trainer',
        category: 'Trainer',
        reasoning:
          'Ermöglicht direktes Evolvieren zu Stufe-2-Karten und passt zum aggressiven Spieltempo.',
      },
      {
        id: 'basic-water-energy',
        quantity: 8,
        name: 'Basic Water Energy',
        category: 'Energie',
        reasoning: 'Energiebedarf basierend auf den durchschnittlichen Attackenkosten des Decks berechnet.',
      },
      {
        id: 'boss-orders',
        quantity: 2,
        name: "Boss's Orders – Trainer",
        category: 'Trainer',
        reasoning: 'Standard-Removal-Karte laut aktueller Meta-Analyse.',
      },
    ],
    extraCardsCount: 44,
    stats: [
      { label: 'Karten', value: '60' },
      { label: 'Energie-/Landanzahl', value: '13' },
      { label: 'Kartenverteilung', value: '92% Wasser · 8% Farblos' },
      { label: 'Kartentypen', value: '47% Pokémon · 33% Trainer · 20% Energie' },
    ],
    synergy: {
      percent: 92,
      headline: 'Starke Archetyp-Kohärenz',
      description: 'Schwachstelle: wenig zusätzlicher Draw-Support.',
    },
  },
};

function buildPlaceholderDetail(deckName: string): DeckDetail {
  return {
    goals: ['Meta-Overall', 'Turnier-legal'],
    cardlist: [
      {
        id: 'placeholder-1',
        quantity: 0,
        name: 'Noch keine Kartendaten',
        category: '—',
        reasoning: `Für "${deckName}" sind noch keine echten Deckdaten hinterlegt. Diese Ansicht füllt sich, sobald das Deck an die Datenbank angebunden ist.`,
      },
    ],
    extraCardsCount: 0,
    stats: [
      { label: 'Karten', value: '–' },
      { label: 'Energie-/Landanzahl', value: '–' },
    ],
    synergy: {
      percent: 0,
      headline: 'Noch keine Analyse',
      description: 'Wird berechnet, sobald echte Deckdaten vorliegen.',
    },
  };
}

export function getDeckDetail(deckId: string, deckName: string): DeckDetail {
  return deckDetails[deckId] ?? buildPlaceholderDetail(deckName);
}
