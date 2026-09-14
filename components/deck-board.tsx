'use client';

import { useState } from 'react';
import { useDeckStream } from '@/hooks/use-deck-stream';
import { Loader2, AlertCircle, Settings2 } from 'lucide-react';
import { ChatInput } from '@/components/chat-input';
import { CardTooltip } from '@/components/card-tooltip';
import { MTGMarkdown } from '@/components/mtg-markdown';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MANA_SYMBOLS = ['W', 'U', 'B', 'R', 'G'];

export function DeckBoard() {
  const { prompt, setPrompt, isGenerating, statusMessage, deck, error, generateDeck } =
    useDeckStream('/api/decks/generate');

  const [format, setFormat] = useState('auto');
  const [isAutoColor, setIsAutoColor] = useState(true);
  const [colors, setColors] = useState<string[]>([]);

  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const explicitFormat = format === 'auto' ? undefined : format;
    const explicitColors = isAutoColor ? undefined : colors;
    generateDeck(explicitFormat, explicitColors, e);
  };

  const toggleColor = (sym: string) => {
    setColors((prev) => {
      const nextColors = prev.includes(sym) ? prev.filter((c) => c !== sym) : [...prev, sym];

      setIsAutoColor(nextColors.length === 0);

      return nextColors;
    });
  };

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6 min-h-0 overflow-hidden">
      {/* Console Card */}
      <Card className="w-full shrink-0 z-10 overflow-hidden shadow-md">
        <CardHeader className="py-3 px-4 md:px-6 bg-card shrink-0 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Build Console</CardTitle>
        </CardHeader>
        <ChatInput
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleGenerate}
          isStreaming={isGenerating}
          placeholder="e.g. A graveyard recursion engine featuring The Gitrog Monster"
        />
        <div className="bg-secondary/40 border-t border-border/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-secondary-foreground font-medium shrink-0">
            <Settings2 className="w-4 h-4" />
            <span>Parameters:</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Format Dropdown */}
            <Select value={format} onValueChange={setFormat} disabled={isGenerating}>
              <SelectTrigger className="h-8 w-[140px] bg-background text-xs shadow-sm border-border/80">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="commander">Commander</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
              </SelectContent>
            </Select>

            <div className="h-4 w-px bg-border/80 hidden sm:block" />

            {/* Color Identity Toggles */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                type="button"
                variant={isAutoColor ? 'default' : 'outline'}
                size="sm"
                disabled={isGenerating}
                onClick={() => {
                  setIsAutoColor(true);
                  setColors([]);
                }}
                className={`h-8 text-xs shadow-sm transition-all ${
                  isAutoColor
                    ? 'border-primary ring-1 ring-primary/50'
                    : 'text-muted-foreground hover:text-foreground hover:border-primary/50 bg-background'
                }`}
              >
                Auto-detect
              </Button>

              <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />

              {MANA_SYMBOLS.map((sym) => {
                const isActive = !isAutoColor && colors.includes(sym);
                return (
                  <Button
                    key={sym}
                    type="button"
                    variant={isActive ? 'default' : 'outline'}
                    size="icon"
                    disabled={isGenerating}
                    onClick={() => toggleColor(sym)}
                    className={`h-8 w-8 rounded-full shadow-sm transition-all flex items-center justify-center ${
                      isActive
                        ? 'border-primary ring-1 ring-primary/50'
                        : 'text-muted-foreground hover:text-foreground hover:border-primary/50 bg-background'
                    }`}
                    title={sym}
                  >
                    {/* Utilizing the ms font classes to render the vector symbol */}
                    <i className={`ms ms-${sym.toLowerCase()} text-[15px]`} />
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Board Card */}
      <Card className="w-full flex-1 flex flex-col shadow-md overflow-hidden min-h-0">
        <CardHeader className="py-3 px-4 md:px-6 border-b border-border bg-card shrink-0 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Draft Board</CardTitle>
          {isGenerating && statusMessage && (
            <div className="px-3 py-1 bg-primary/15 text-primary border border-primary/20 rounded-full text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">{statusMessage}</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="flex-1 p-4 md:p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 items-start relative custom-scrollbar bg-background/50">
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 z-20 shadow-lg w-[90%] md:w-auto">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {!deck && !isGenerating && !error && (
            <div className="col-span-full h-full min-h-[200px] flex items-center justify-center text-muted-foreground text-sm text-center p-4">
              Define your parameters and build a new deck.
            </div>
          )}

          {/* Categories */}
          {deck &&
            Object.entries(deck.categories).map(([categoryName, cards]) => (
              <div
                key={categoryName}
                className="w-full flex flex-col bg-secondary/30 rounded-xl border border-border/60 overflow-hidden shadow-inner"
              >
                <div className="p-3 border-b border-border/50 bg-secondary flex items-center justify-between shrink-0">
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-secondary-foreground truncate pr-2">
                    {categoryName}
                  </h3>
                  <span className="text-xs font-medium bg-background text-foreground px-2 py-0.5 rounded-full border border-border/80 shadow-sm shrink-0">
                    {cards.reduce((acc, c) => acc + c.quantity, 0)}
                  </span>
                </div>

                <div className="flex-1 p-3 flex flex-col gap-2.5">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      className="bg-card rounded-lg p-3 shadow-sm border border-border hover:border-primary/60 hover:bg-secondary/40 transition-all duration-200 flex flex-col gap-2 group"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="font-medium text-sm text-card-foreground truncate flex items-center gap-1.5">
                          {card.quantity > 1 && (
                            <span className="text-xs text-primary font-semibold">
                              {card.quantity}x
                            </span>
                          )}
                          <CardTooltip cardName={card.name} />
                        </div>
                        <span className="text-[11px] font-mono bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded border border-border/50 shrink-0 shadow-sm">
                          CMC {card.cmc}
                        </span>
                      </div>

                      {card.reasoning && (
                        <div className="text-[12px] text-muted-foreground leading-snug">
                          <MTGMarkdown content={card.reasoning} />
                        </div>
                      )}
                    </div>
                  ))}

                  {isGenerating && cards.length === 0 && (
                    <div className="h-20 border-2 border-dashed border-primary/20 rounded-lg animate-pulse bg-primary/5" />
                  )}
                </div>
              </div>
            ))}

          {/* Mana Base */}
          {deck?.lands && deck.lands.length > 0 && (
            <div className="w-full flex flex-col bg-secondary/30 rounded-xl border border-border/60 overflow-hidden shadow-inner">
              <div className="p-3 border-b border-border/50 bg-secondary flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-secondary-foreground">
                  Mana Base
                </h3>
                <span className="text-xs font-medium bg-background text-foreground px-2 py-0.5 rounded-full border border-border/80 shadow-sm shrink-0">
                  {deck.lands.reduce((acc, l) => acc + l.quantity, 0)}
                </span>
              </div>
              <div className="flex-1 p-3 flex flex-col gap-2.5">
                {deck.lands.map((land) => (
                  <div
                    key={land.card_id}
                    className="bg-card rounded-lg p-3 shadow-sm border border-border hover:border-primary/60 hover:bg-secondary/40 transition-all duration-200 flex justify-between items-center"
                  >
                    <div className="font-medium text-sm flex items-center gap-1.5 text-card-foreground">
                      <span className="text-xs text-primary font-semibold">{land.quantity}x</span>
                      <CardTooltip cardName={land.name} />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded border border-border/50 shadow-sm">
                      Land
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
