'use client';

import { useState } from 'react';
import { Minus, Plus, Search } from 'lucide-react';

import { ActionDialog } from '@/components/ui/action-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { addDeckCard, type PokemonCardOption } from '@/lib/api/decks';

type AddedDeckCard = {
  id: string;
  card_id: string;
  quantity: number;
  position: number | null;
  reasoning: string | null;
  pokemon_cards: {
    id: string;
    name: string;
    card_type: string | null;
    subtype: string | null;
    regulation_mark: string | null;
  };
};

export function AddCardDialog({
  deckId,
  cardOptions,
  currentCardCount,
  onCardAdded,
}: {
  deckId: string;
  cardOptions: PokemonCardOption[];
  currentCardCount: number;
  onCardAdded: (card: AddedDeckCard) => void;
}) {
  const [cardSearch, setCardSearch] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reasoning, setReasoning] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const filteredCards = cardOptions.filter((card) =>
    card.name.toLowerCase().includes(cardSearch.toLowerCase())
  );

  async function handleAddCard() {
    if (!selectedCardId) {
      return;
    }

    try {
      setIsAdding(true);

      const addedCard = await addDeckCard(deckId, {
        card_id: selectedCardId,
        quantity,
        position: currentCardCount + 1,
        reasoning,
      });

      onCardAdded(addedCard);

      setCardSearch('');
      setSelectedCardId(null);
      setQuantity(1);
      setReasoning('');
    } catch (error) {
      console.error('Fehler beim Hinzufügen der Karte:', error);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <ActionDialog
      trigger={
        <Button type="button" variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          Karte hinzufügen
        </Button>
      }
      title="Karte hinzufügen"
      description="Wähle eine Karte aus und füge sie deinem Deck hinzu."
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="card-search">Karte</Label>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="card-search"
              value={cardSearch}
              onChange={(event) => {
                setCardSearch(event.target.value);
                setSelectedCardId(null);
              }}
              placeholder="Karte suchen..."
              className="pl-9"
            />
          </div>

          {cardSearch.trim() !== '' && (
            <div className="max-h-56 overflow-y-auto rounded-md border">
              {filteredCards.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Keine Karte gefunden.</p>
              ) : (
                filteredCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setSelectedCardId(card.id);
                      setCardSearch(card.name);
                    }}
                    className={`flex w-full items-center justify-between gap-4 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted ${
                      selectedCardId === card.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div>
                      <div className="font-medium">{card.name}</div>

                      {card.regulation_mark && (
                        <div className="text-xs text-muted-foreground">
                          Regulation {card.regulation_mark}
                        </div>
                      )}
                    </div>

                    <div className="text-right text-xs text-muted-foreground">
                      <div>{card.card_type ?? 'Unbekannt'}</div>

                      {card.subtype && <div>{card.subtype}</div>}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {selectedCardId && (
            <p className="text-sm text-muted-foreground">Ausgewählt: {cardSearch}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Anzahl</Label>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={quantity <= 1}
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>

            <span className="min-w-10 text-center font-semibold">{quantity}x</span>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setQuantity((current) => current + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="card-reasoning">Begründung</Label>

          <Input
            id="card-reasoning"
            value={reasoning}
            onChange={(event) => setReasoning(event.target.value)}
            placeholder="Warum soll die Karte ins Deck?"
          />
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={!selectedCardId || isAdding}
          onClick={handleAddCard}
        >
          <Plus className="h-4 w-4" />

          {isAdding ? 'Wird hinzugefügt...' : 'Karte hinzufügen'}
        </Button>
      </div>
    </ActionDialog>
  );
}
