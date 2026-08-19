'use client';

import { Trash2 } from 'lucide-react';

import { ActionDialog } from '@/components/ui/action-dialog';
import { Button } from '@/components/ui/button';

export function DeckDeleteButton({ deckId, deckName }: { deckId: string; deckName: string }) {
  function handleDeleteDeck() {
    console.log('Deck löschen:', deckId);
  }

  return (
    <ActionDialog
      trigger={
        <Button type="button" variant="destructive" size="sm">
          <Trash2 />
          Deck löschen
        </Button>
      }
      title="Deck wirklich löschen?"
      description={`Möchtest du das Deck „${deckName}“ wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
      showCancel={false}
    >
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline">
          Abbrechen
        </Button>

        <Button type="button" variant="destructive" onClick={handleDeleteDeck}>
          <Trash2 />
          Deck löschen
        </Button>
      </div>
    </ActionDialog>
  );
}
