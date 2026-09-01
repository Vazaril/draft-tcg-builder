import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StatRow } from '@/lib/deck-detail';

export function DeckAnalysisCard({ stats }: { stats: StatRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deck-Analyse</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {stats.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 border-b border-border/50 py-2 text-sm last:border-b-0"
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className="text-right font-medium text-foreground">{row.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
