/** Semantic theme token used for a deck's thumbnail gradient — never a raw Tailwind color. */
export type DeckAccent = 'primary' | 'secondary' | 'accent' | 'muted';

export type Deck = {
  id: string;
  name: string;
  game: string;
  format: string;
  tags: string[];
  accent: DeckAccent;
};

export const mockDecks: Deck[] = [
  {
    id: 'tidal-wyrm',
    name: 'Tidal Wyrm',
    game: 'Pokemon',
    format: 'Standard',
    tags: ['Turnier-legal', 'Aggro'],
    accent: 'primary',
  },
  {
    id: 'nekropolis-control',
    name: 'Nekropolis Control',
    game: 'Magic',
    format: 'Commander',
    tags: ['Turnier-legal', 'Graveyard'],
    accent: 'primary',
  },
  {
    id: 'solarforge-midrange',
    name: 'Solarforge Midrange',
    game: 'Pokemon',
    format: 'Expanded',
    tags: ['Entwurf', 'Budget'],
    accent: 'accent',
  },
  {
    id: 'goblin-sprint',
    name: 'Goblin Sprint',
    game: 'Magic',
    format: 'Pioneer',
    tags: ['Turnier-legal', 'Aggro'],
    accent: 'muted',
  },
];
