import { Plus, Upload } from 'lucide-react';

import { AddDeckCard } from '@/components/add-deck-card';
import { DeckCard } from '@/components/deck-card';
import { Button } from '@/components/ui/button';
import {
  PageContent,
  PageDescription,
  PageHeader,
  PageShell,
  PageTitle,
} from '@/components/ui/page-shell';
import { getUserDecks } from '@/lib/api/decks';

export default async function DecksPage() {
  const decks = await getUserDecks();

  return (
    <PageShell>
      <PageHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <PageTitle>Meine Decks</PageTitle>

            <PageDescription>{decks.length} gespeichert</PageDescription>
          </div>

          <div className="flex shrink-0 gap-3">
            <Button variant="outline" size="sm">
              <Upload />
              Import
            </Button>

            <Button size="sm">
              <Plus />
              Neues Deck
            </Button>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}

          <AddDeckCard />
        </div>
      </PageContent>
    </PageShell>
  );
}
