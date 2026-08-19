'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { DeckListEntry } from '@/lib/deck-detail';

export function DeckListCard({
  entries,
  extraCardsCount,
}: {
  entries: DeckListEntry[];
  extraCardsCount: number;
}) {
  const [order, setOrder] = useState(entries.map((entry) => entry.id));
  const [kept, setKept] = useState<Record<string, boolean>>(
    Object.fromEntries(entries.map((entry) => [entry.id, true]))
  );
  const [showExtraNote, setShowExtraNote] = useState(false);

  const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry]));

  function move(id: string, direction: -1 | 1) {
    setOrder((current) => {
      const index = current.indexOf(id);
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deckliste &mdash; mit Begründung (Explainable AI)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.map((id, index) => {
          const entry = byId[id];
          return (
            <div key={id} className="rounded-xl border border-border/60 bg-background/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Badge variant="secondary" className="mt-0.5 shrink-0">
                    {entry.quantity}x
                  </Badge>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{entry.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {entry.category}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{entry.reasoning}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={kept[id] ? 'secondary' : 'outline'}
                    onClick={() => setKept((current) => ({ ...current, [id]: !current[id] }))}
                  >
                    {kept[id] ? 'Behalten' : 'Entfernt'}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={index === 0}
                    onClick={() => move(id, -1)}
                    aria-label="Nach oben verschieben"
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
                    aria-label="Nach unten verschieben"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
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
            Die restlichen Karten werden angezeigt, sobald das Deck an die Datenbank angebunden ist.
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
  );
}
