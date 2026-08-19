import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SynergyScore } from '@/lib/deck-detail';

export function SynergyScoreCard({ synergy }: { synergy: SynergyScore }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Synergie-Score</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-5">
        <div
          className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(hsl(var(--primary)) ${synergy.percent * 3.6}deg, hsl(var(--muted)) 0deg)`,
          }}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-sm font-semibold text-foreground">
            {synergy.percent}%
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{synergy.headline}</p>
          <p className="mt-1 text-sm text-muted-foreground">{synergy.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
