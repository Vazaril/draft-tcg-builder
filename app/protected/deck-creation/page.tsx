'use client';

import { useState } from 'react';
import {
  PageShell,
  PageHeader,
  PageTitle,
  PageDescription,
  PageContent,
} from '@/components/ui/page-shell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { streamSse } from '@/lib/sse';

type DeckCard = {
  card_id: string;
  name: string;
  quantity: number;
  reasoning: string;
};

type DeckProposal = {
  name: string;
  archetype?: string;
  colors?: string[];
  cards: DeckCard[];
  warnings: string[];
  deck_id?: string | null;
};

export default function DeckCreationPage() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [stageMessage, setStageMessage] = useState<string | null>(null);
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setCards([]);
    setWarnings([]);
    setDeckId(null);
    setStageMessage('Starte...');

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError('Du musst eingeloggt sein, um ein Deck zu generieren.');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/decks/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt, game: 'mtg' }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? `Anfrage fehlgeschlagen (${response.status}).`);
        return;
      }

      for await (const event of streamSse(response)) {
        if (event.type === 'status') {
          setStageMessage(event.message as string);
        } else if (event.type === 'partial') {
          const newCards = (event.cards as DeckCard[]) ?? [];
          setCards((prev) => [...prev, ...newCards]);
        } else if (event.type === 'done') {
          const proposal = event.proposal as DeckProposal;
          setCards(proposal.cards ?? []);
          setWarnings(proposal.warnings ?? []);
          setDeckId(proposal.deck_id ?? null);
          setStageMessage('Fertig!');
        } else if (event.type === 'error') {
          setError((event.message as string) ?? 'Unbekannter Fehler.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
    } finally {
      setIsGenerating(false);
    }
  }

  const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0);

  return (
    <PageShell>
      <PageHeader>
        <PageTitle>Deck Creation</PageTitle>
        <PageDescription>
          Beschreibe, welches Deck du bauen willst - eine lokale KI-Pipeline sucht passende
          Karten aus dem Katalog und schlaegt dir ein Deck vor.
        </PageDescription>
      </PageHeader>

      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle>Was fuer ein Deck soll es werden?</CardTitle>
            <CardDescription>
              Zum Beispiel: &quot;Ein aggressives rotes Deck mit vielen kleinen, guenstigen
              Kreaturen&quot;
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Beschreibe dein Wunsch-Deck..."
              disabled={isGenerating}
              rows={3}
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}>
                {isGenerating ? 'Generiere...' : 'Deck generieren'}
              </Button>
              {isGenerating && stageMessage && (
                <span className="text-sm text-muted-foreground">{stageMessage}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Laeuft komplett lokal ohne GPU - ein Durchlauf dauert typischerweise 5-10 Minuten.
              Bitte die Seite waehrenddessen nicht schliessen.
            </p>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        {cards.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {deckId ? 'Gespeichertes Deck' : 'Deck-Vorschlag'} ({totalCards} Karten)
              </CardTitle>
              {deckId && <CardDescription>Deck-ID: {deckId}</CardDescription>}
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {cards.map((card) => (
                  <li
                    key={card.card_id}
                    className="flex flex-col gap-1 rounded-lg border border-border p-3"
                  >
                    <span className="font-semibold">
                      {card.quantity}x {card.name}
                    </span>
                    <p className="text-sm text-muted-foreground">{card.reasoning}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {warnings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Hinweise</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {warnings.map((warning, index) => (
                  <li key={index}>- {warning}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </PageContent>
    </PageShell>
  );
}
