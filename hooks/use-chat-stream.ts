import { useState } from 'react';

export type Citation = {
  id?: string;
  name?: string;
  card_name?: string;
  text?: string;
  snippet?: string;
  type?: 'ruling' | 'card' | 'rule' | string;
  score?: number;
};

export type Message = {
  role: 'user' | 'model';
  content: string;
  context_used?: Citation[];
};

export function useChatStream(apiEndpoint: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming) return;

    setError(null);
    const userMessage: Message = { role: 'user', content: input };
    const currentHistory = [...messages];

    setMessages([...currentHistory, userMessage]);
    setInput('');
    setIsStreaming(true);

    try {
      setMessages((prev) => [...prev, { role: 'model', content: '', context_used: [] }]);

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ message: userMessage.content, history: currentHistory }),
      });

      if (!response.body) throw new Error('No response body returned from chat endpoint');

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
              const dataString = part.replace('data: ', '');
              try {
                const parsedData = JSON.parse(dataString);
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIndex = updated.length - 1;
                  const lastMessage = { ...updated[lastIndex] };

                  if (parsedData.type === 'citations') {
                    lastMessage.context_used = parsedData.context_used;
                  } else if (parsedData.type === 'text') {
                    lastMessage.content += parsedData.content;
                  } else if (parsedData.type === 'done') {
                    setIsStreaming(false);
                  }

                  updated[lastIndex] = lastMessage;
                  return updated;
                });
              } catch {
                // wop wop
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsStreaming(false);
    }
  };

  return { messages, input, setInput, isStreaming, error, handleSubmit };
}
