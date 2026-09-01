import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Card } from '@/components/ui/card';

export function AddDeckCard() {
  return (
    <Link href="/protected/decks/import" className="block h-full">
      <Card className="flex h-full min-h-64 flex-col items-center justify-center gap-2 border-dashed bg-transparent text-center text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
        <Plus className="h-6 w-6" />
        <span className="px-4 text-sm">Plain-Text Deckliste einfügen</span>
      </Card>
    </Link>
  );
}
