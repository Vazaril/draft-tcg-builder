'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function GoalChips({ goals }: { goals: string[] }) {
  const [active, setActive] = useState(goals[0]);

  return (
    <div className="flex flex-wrap gap-2">
      {goals.map((goal) => (
        <Button
          key={goal}
          type="button"
          size="sm"
          variant={active === goal ? 'default' : 'outline'}
          onClick={() => setActive(goal)}
        >
          {goal}
        </Button>
      ))}
      <Button type="button" size="sm" variant="outline" className="border-dashed">
        <Plus />
        Eigenes Ziel eingeben
      </Button>
    </div>
  );
}
