'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Minus, Plus, Trash2 } from 'lucide-react';

import { AddCardDialog, type AddedDeckCard } from '@/components/ui/add-card-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { TimedMessage } from '@/components/ui/timed-message';

import { deleteDeckCards, type CardOption, type DeckGameType } from '@/lib/api/decks';
import type { DeckListEntry } from '@/lib/deck-detail';

export function DeckListCard({
  deckId,
  gameType,
  entries,
  extraCardsCount,
  isEditing,
  cardOptions,
}: {
  deckId: string;
  gameType: DeckGameType;
  entries: DeckListEntry[];
  extraCardsCount: number;
  isEditing: boolean;
  cardOptions: CardOption[];
}) {
  const [cards, setCards] = useState<DeckListEntry[]>(entries);

  const [order, setOrder] = useState(entries.map((entry) => entry.id));

  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  const [deleteAmounts, setDeleteAmounts] = useState<Record<string, number>>({});

  const [showExtraNote, setShowExtraNote] = useState(false);

  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);

  const [deletedCardsCount, setDeletedCardsCount] = useState(0);

  const byId = Object.fromEntries(cards.map((entry) => [entry.id, entry]));

  function toggleCard(id: string) {
    setSelectedCards((current) => {
      const isSelected = current.includes(id);

      if (isSelected) {
        setDeleteAmounts((currentAmounts) => {
          const next = {
            ...currentAmounts,
          };

          delete next[id];

          return next;
        });

        return current.filter((cardId) => cardId !== id);
      }

      setDeleteAmounts((current) => ({
        ...current,
        [id]: 1,
      }));

      return [...current, id];
    });
  }

  function increaseDeleteAmount(id: string) {
    const entry = byId[id];

    if (!entry) {
      return;
    }

    setDeleteAmounts((current) => ({
      ...current,
      [id]: Math.min((current[id] ?? 1) + 1, entry.quantity),
    }));
  }

  function decreaseDeleteAmount(id: string) {
    setDeleteAmounts((current) => ({
      ...current,
      [id]: Math.max((current[id] ?? 1) - 1, 1),
    }));
  }

  async function deleteSelectedCards() {
    const selectedCount = selectedCards.length;

    try {
      const cardsToDelete = selectedCards.map((id) => {
        const card = byId[id];

        return {
          card_id: gameType === 'magic' ? id.split(':')[0] : id,

          amount: deleteAmounts[id] ?? 1,

          ...(gameType === 'magic' && card?.zone
            ? {
                zone: card.zone,
              }
            : {}),
        };
      });

      const data = await deleteDeckCards(deckId, cardsToDelete);

      const results = data.results;

      setCards((current) =>
        current.flatMap((card) => {
          const backendCardId = gameType === 'magic' ? card.id.split(':')[0] : card.id;

          const result = results.find(
            (result: {
              card_id: string;
              zone?: string;
              deleted?: boolean;
              remaining_quantity?: number;
              error?: string;
            }) =>
              result.card_id === backendCardId &&
              (gameType === 'pokemon' || !result.zone || result.zone === card.zone)
          );

          if (!result || result.error) {
            return [card];
          }

          if (result.deleted) {
            return [];
          }

          if (result.remaining_quantity === undefined) {
            return [card];
          }

          return [
            {
              ...card,
              quantity: result.remaining_quantity,
            },
          ];
        })
      );

      const deletedResults = results.filter(
        (result: { deleted?: boolean; error?: string }) => result.deleted === true && !result.error
      );

      setOrder((current) =>
        current.filter((id) => {
          const card = byId[id];

          const backendCardId = gameType === 'magic' ? id.split(':')[0] : id;

          return !deletedResults.some(
            (result: { card_id: string; zone?: string }) =>
              result.card_id === backendCardId &&
              (gameType === 'pokemon' || !result.zone || result.zone === card?.zone)
          );
        })
      );

      setSelectedCards([]);
      setDeleteAmounts({});

      setDeletedCardsCount(selectedCount);
      setShowDeleteSuccess(true);
    } catch {
      setSelectedCards([]);
      setDeleteAmounts({});
    }
  }

  function handleCardAdded(addedCard: AddedDeckCard) {
    if ('pokemon_cards' in addedCard) {
      const existingCard = cards.find((card) => card.id === addedCard.id);

      if (existingCard) {
        setCards((current) =>
          current.map((card) =>
            card.id === addedCard.id
              ? {
                  ...card,
                  quantity: addedCard.quantity,
                  reasoning: addedCard.reasoning ?? '',
                }
              : card
          )
        );

        return;
      }

      const newCard: DeckListEntry = {
        id: addedCard.id,
        name: addedCard.pokemon_cards.name,
        quantity: addedCard.quantity,
        category: addedCard.pokemon_cards.card_type ?? 'Unbekannt',
        reasoning: addedCard.reasoning ?? '',
      };

      setCards((current) => [...current, newCard]);

      setOrder((current) => [...current, newCard.id]);

      return;
    }

    const magicId = `${addedCard.card_id}:${addedCard.zone}`;

    const existingCard = cards.find((card) => card.id === magicId);

    if (existingCard) {
      setCards((current) =>
        current.map((card) =>
          card.id === magicId
            ? {
                ...card,
                quantity: addedCard.quantity,
              }
            : card
        )
      );

      return;
    }

    const newCard: DeckListEntry = {
      id: magicId,
      name: addedCard.mtg_cards.name,
      quantity: addedCard.quantity,
      category: addedCard.mtg_cards.type_line ?? 'Unbekannt',
      reasoning: '',
      zone: addedCard.zone,
    };

    setCards((current) => [...current, newCard]);

    setOrder((current) => [...current, newCard.id]);
  }

  function move(id: string, direction: -1 | 1) {
    setOrder((current) => {
      const index = current.indexOf(id);

      const target = index + direction;

      if (target < 0 || target >= current.length) {
        return current;
      }

      const next = [...current];

      [next[index], next[target]] = [next[target], next[index]];

      return next;
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Deckliste &mdash; mit Begründung (Explainable AI)</CardTitle>

            {isEditing && (
              <div className="flex items-center gap-2">
                <AddCardDialog
                  deckId={deckId}
                  gameType={gameType}
                  cardOptions={cardOptions}
                  currentCardCount={cards.length}
                  onCardAdded={handleCardAdded}
                />

                {selectedCards.length > 0 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={deleteSelectedCards}
                  >
                    <Trash2 className="h-4 w-4" />
                    Löschen ({selectedCards.length})
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {order.map((id, index) => {
            const entry = byId[id];

            if (!entry) {
              return null;
            }

            const selected = selectedCards.includes(id);

            const deleteAmount = deleteAmounts[id] ?? 1;

            return (
              <div
                key={id}
                className={`rounded-xl border p-4 transition-colors ${
                  selected
                    ? 'border-destructive bg-destructive/10'
                    : 'border-border/60 bg-background/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {isEditing && (
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCard(id)}
                        aria-label={`${entry.name} auswählen`}
                        className="mt-1 h-4 w-4"
                      />
                    )}

                    <Badge variant="secondary" className="mt-0.5 shrink-0">
                      {entry.quantity}x
                    </Badge>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{entry.name}</span>

                        <Badge variant="outline" className="text-[10px]">
                          {entry.category}
                        </Badge>

                        {gameType === 'magic' && entry.zone && (
                          <Badge variant="outline" className="text-[10px]">
                            {entry.zone}
                          </Badge>
                        )}
                      </div>

                      {entry.reasoning && (
                        <p className="mt-1 text-sm text-muted-foreground">{entry.reasoning}</p>
                      )}

                      {isEditing && selected && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-sm text-muted-foreground">Anzahl löschen:</span>

                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            disabled={deleteAmount <= 1}
                            onClick={() => decreaseDeleteAmount(id)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>

                          <span className="min-w-8 text-center text-sm font-semibold">
                            {deleteAmount}x
                          </span>

                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            disabled={deleteAmount >= entry.quantity}
                            onClick={() => increaseDeleteAmount(id)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>

                          {deleteAmount < entry.quantity && (
                            <span className="text-sm text-muted-foreground">
                              Danach verbleiben {entry.quantity - deleteAmount}x
                            </span>
                          )}

                          {deleteAmount === entry.quantity && (
                            <span className="text-sm text-destructive">
                              Karte wird vollständig entfernt
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={index === 0}
                        onClick={() => move(id, -1)}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={index === order.length - 1}
                        onClick={() => move(id, 1)}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {extraCardsCount > 0 && (
            <button
              type="button"
              onClick={() => setShowExtraNote((value) => !value)}
              className="w-full text-left text-sm text-primary hover:underline"
            >
              {showExtraNote ? 'Weniger anzeigen' : `+ ${extraCardsCount} weitere Karten`}
            </button>
          )}

          {showExtraNote && (
            <p className="text-sm text-muted-foreground">
              Die restlichen Karten werden angezeigt, sobald das Deck an die Datenbank angebunden
              ist.
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2 border-t border-border pt-6">
          <Button type="button" variant="outline" size="sm">
            Plain-Text
          </Button>

          <Button type="button" variant="outline" size="sm">
            Kaufliste
          </Button>

          <Button type="button" variant="outline" size="sm">
            Drucken
          </Button>
        </CardFooter>
      </Card>

      {showDeleteSuccess && (
        <TimedMessage
          message={deletedCardsCount === 1 ? 'Karte gelöscht' : 'Karten gelöscht'}
          onClose={() => setShowDeleteSuccess(false)}
        />
      )}
    </>
  );
}
