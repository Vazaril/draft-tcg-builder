import {
  PageShell,
  PageHeader,
  PageTitle,
  PageDescription,
  PageContent,
} from '@/components/ui/page-shell';
import { DeckBoard } from '@/components/deck-board';

export default function DeckBuilderPage() {
  return (
    <PageShell>
      <PageHeader>
        <PageTitle>Deck Builder</PageTitle>
        <PageDescription>
          Describe your strategy, and the builder will orchestrate a highly synergistic decklist.
        </PageDescription>
      </PageHeader>
      <PageContent>
        <DeckBoard />
      </PageContent>
    </PageShell>
  );
}
