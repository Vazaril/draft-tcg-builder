'use client';

import { Copy, Share2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { Button } from '@/components/ui/button';
import type { DeckListEntry } from '@/lib/deck-detail';

export function DeckShareButton({
  deckName,
  entries,
}: {
  deckName: string;
  entries: DeckListEntry[];
}) {
  function getPlainText() {
    return entries.map((entry) => `${entry.quantity}x ${entry.name}`).join('\n');
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
  }

  async function copyPlainText() {
    await navigator.clipboard.writeText(`${deckName}\n\n${getPlainText()}`);
  }

  async function shareDeck() {
    if (!navigator.share) {
      await copyLink();
      return;
    }

    await navigator.share({
      title: deckName,
      text: `Schau dir mein Deck „${deckName}“ an.`,
      url: window.location.href,
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Share2 />
          Teilen
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deck teilen</AlertDialogTitle>

          <AlertDialogDescription>
            Teile „{deckName}“ als Link oder als Plain Text.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3">
          <Button type="button" variant="secondary" onClick={shareDeck}>
            <Share2 />
            Link teilen
          </Button>

          <Button type="button" variant="outline" onClick={copyLink}>
            <Copy />
            Link kopieren
          </Button>

          <Button type="button" variant="outline" onClick={copyPlainText}>
            <Copy />
            Plain Text kopieren
          </Button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Schließen</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
