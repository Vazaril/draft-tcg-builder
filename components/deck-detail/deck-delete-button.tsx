'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { ActionDialog } from '@/components/ui/action-dialog';
import { Button } from '@/components/ui/button';
import { deleteDeck } from '@/lib/api/decks';

export function DeckDeleteButton({ deckId, deckName }: { deckId: string; deckName: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeleteDeck() {
    try {
      setIsDeleting(true);

      await deleteDeck(deckId);

      router.replace('/protected/my-decks');
    } catch {
      setIsDeleting(false);
    }
  }

  return (
    <ActionDialog
      trigger={
        <Button type="button" variant="destructive" size="sm">
          <Trash2 className="h-4 w-4" />
          Deck löschen
        </Button>
      }
      title="Deck wirklich löschen?"
      description={`Möchtest du das Deck „${deckName}“ wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
      showCancel
    >
      <div className="flex justify-end">
        <Button
          type="button"
          variant="destructive"
          disabled={isDeleting}
          onClick={handleDeleteDeck}
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? 'Wird gelöscht...' : 'Deck löschen'}
        </Button>
      </div>
    </ActionDialog>
  );
}
