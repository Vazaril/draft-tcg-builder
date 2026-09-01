import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Deck, DeckAccent } from '@/lib/api/decks';

// Semantic-token-only gradients — no raw Tailwind colors (bg-blue-500 etc.),
// per the "Semantic Theming" rule in the dev style guide.
const accentGradients: Record<DeckAccent, string> = {
  primary: 'from-primary/80 via-primary/30 to-background',
  secondary: 'from-secondary/80 via-secondary/30 to-background',
  accent: 'from-accent/80 via-accent/30 to-background',
  muted: 'from-muted/80 via-muted/30 to-background',
};

export function DeckCard({ deck }: { deck: Deck }) {
  return (
    <Link href={`/protected/decks/${deck.id}`} className="block">
      <Card className="h-full overflow-hidden transition-all hover:border-primary/50 hover:shadow-[0_0_15px_hsl(var(--primary)/0.15)]">
        <div className={`h-28 w-full bg-gradient-to-br ${accentGradients[deck.accent]}`} />
        <CardContent className="space-y-3 p-4">
          <div>
            <h3 className="truncate font-pixel text-base font-semibold text-foreground">
              {deck.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {deck.game} &middot; {deck.format}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {deck.tags.map((tag) => (
              <Badge key={tag} variant={tag === 'Turnier-legal' ? 'default' : 'secondary'}>
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
