'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Message = {
  role: 'user' | 'model';
  content: string;
  context_used?: never[];
};

export function JudgeChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: 'user', content: input };
    const currentHistory = [...messages];
    setMessages([...currentHistory, userMessage]);
    setInput('');
    setIsStreaming(true);

    try {
      setMessages((prev) => [...prev, { role: 'model', content: '', context_used: [] }]);

      // TODO Create new netx.js api route for calling the flask server <- cors etc
      const response = await fetch('http://localhost:5001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          message: userMessage.content,
          history: currentHistory,
        }),
      });

      if (!response.body) throw new Error('No response body');

      // 3. Read the SSE Stream
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
              } catch (err) {
                console.error('Failed to parse SSE JSON:', err);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Judge Chat Error:', error);
      setIsStreaming(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <Card className="mb-4 w-[350px] md:w-[450px] h-[500px] flex flex-col shadow-2xl border-primary/20">
          <CardHeader className="border-b border-border py-3 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Judge</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <p className="text-muted-foreground text-sm text-center mt-10">
                Ask a rules question! (e.g. Can I cast Murder on a hexproof creature?)
              </p>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`p-3 rounded-xl max-w-[85%] text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-muted text-foreground rounded-bl-none'
                  }`}
                >
                  {/* //TODO Add the regex parser for [[card:]] later! */}
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </CardContent>

          <form onSubmit={handleSubmit}>
            <CardFooter className="p-3 border-t border-border flex gap-2">
              <Input
                placeholder="Ask a rules question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isStreaming}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={isStreaming || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        className="h-14 w-14 rounded-full shadow-xl transition-transform hover:scale-105"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </Button>
    </div>
  );
}
