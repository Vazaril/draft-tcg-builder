import { useState } from 'react';

export type DeckCard = {
  id: string;
  name: string;
  cmc: number;
  colors: string[];
  type: string;
  oracle_text: string;
  score: number;
  quantity: number;
  reasoning: string;
};

export type DeckCategory = {
  [categoryName: string]: DeckCard[];
};

export type DeckProposal = {
  commander: string;
  format: string;
  color_identity: string[];
  categories: DeckCategory;
  lands: { card_id: string; name: string; quantity: number; type: string }[];
};

export function useDeckStream(apiEndpoint: string) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [deck, setDeck] = useState<DeckProposal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateDeck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setStatusMessage('Initializing...');
    setDeck(null);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.body) throw new Error('No stream returned');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            if (part.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(part.replace('data: ', ''));

                if (parsed.type === 'status') {
                  setStatusMessage(parsed.message);
                } else if (parsed.type === 'partial' && parsed.stage === 'blueprint') {
                  // Initialize the empty blueprint
                  setDeck(parsed.data);
                } else if (parsed.type === 'partial' && parsed.stage === 'category') {
                  // Append the fully scored category to the deck
                  setDeck((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      categories: {
                        ...prev.categories,
                        [parsed.category]: parsed.cards,
                      },
                    };
                  });
                } else if (parsed.type === 'done') {
                  setDeck(parsed.proposal);
                  setIsGenerating(false);
                  setStatusMessage(null);
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.message);
                }
              } catch (err) {
                // Ignore incomplete JSON chunks
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsGenerating(false);
      setStatusMessage(null);
    }
  };

  return { prompt, setPrompt, isGenerating, statusMessage, deck, error, generateDeck };
}
