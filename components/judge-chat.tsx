'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardTooltip } from '@/components/card-tooltip';

type Message = {
  role: 'user' | 'model';
  content: string;
  context_used?: any[];
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

  const getManaClass = (sym: string): string => {
    const s = sym.toLowerCase().trim();
    if (s === 't') return 'ms-tap';
    if (s === 'q') return 'ms-untap';
    return `ms-${s.replace('/', '')}`;
  };

  const prepareTextForMarkdown = (text: string) => {
    let processed = text;

    processed = processed.replace(/\{([0-9a-zA-Z/]+?)\}/g, (_, sym) => {
      const cleanSym = sym.toUpperCase().replace('/', '');
      return `[${cleanSym}](mtg-sym:${cleanSym})`;
    });
    processed = processed.replace(/\[\[card:([\s\S]*?)\]\]/gi, (_, name) => {
      const cleanName = name.trim();
      return `[${cleanName}](mtg-card:${encodeURIComponent(cleanName)})`;
    });
    processed = processed.replace(/\[\[kw:([\s\S]*?)\]\]/gi, (_, kw) => {
      const cleanKw = kw.trim();
      return `[${cleanKw}](mtg-kw:${encodeURIComponent(cleanKw)})`;
    });
    processed = processed.replace(/\[\[rule:([\s\S]*?)\]\]/gi, (_, rule) => {
      const cleanRule = rule.trim();
      return `[${cleanRule}](mtg-rule:${encodeURIComponent(cleanRule)})`;
    });
    return processed;
  };

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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ message: userMessage.content, history: currentHistory }),
      });

      if (!response.body) throw new Error('No response body');

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

                  if (parsedData.type === 'citations')
                    lastMessage.context_used = parsedData.context_used;
                  else if (parsedData.type === 'text') lastMessage.content += parsedData.content;
                  else if (parsedData.type === 'done') setIsStreaming(false);

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
        <Card className="mb-4 w-[350px] md:w-[450px] h-[500px] flex flex-col shadow-2xl border-primary/20 overflow-hidden">
          <CardHeader className="border-b border-border bg-card py-3 px-4 flex flex-row items-center justify-between space-y-0 z-10 shadow-sm">
            <CardTitle className="text-lg">MTG Judge</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-5 bg-muted/20">
            {messages.length === 0 && (
              <p className="text-muted-foreground text-sm text-center mt-10">
                Ask a rules question! (e.g. Can I cast Murder on a hexproof creature?)
              </p>
            )}

            {messages.map((msg, idx) => {
              if (msg.role === 'model' && msg.content === '' && isStreaming) {
                return null;
              }

              return (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`p-3 rounded-2xl max-w-[85%] text-[14px] leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-secondary text-secondary-foreground border border-border/50 rounded-bl-sm'
                    }`}
                  >
                    <ReactMarkdown
                      urlTransform={(url) => url}
                      components={{
                        a: ({ node, href, children, ...props }) => {
                          const url = href || '';

                          if (url.startsWith('mtg-sym:')) {
                            const sym = url.replace('mtg-sym:', '');
                            const cls = getManaClass(sym);
                            return (
                              <i
                                className={`ms ${cls} ms-cost inline-block mx-[1.5px] align-[-1px] text-[13.5px] drop-shadow-sm`}
                                title={sym.toUpperCase()}
                              />
                            );
                          }

                          if (url.startsWith('mtg-card:')) {
                            const cardName = decodeURIComponent(url.replace('mtg-card:', ''));
                            return <CardTooltip cardName={cardName} />;
                          }
                          if (url.startsWith('mtg-kw:')) {
                            const keyword = decodeURIComponent(url.replace('mtg-kw:', ''));
                            return (
                              <span className="font-medium text-primary bg-primary/10 border border-primary/20 px-1 py-0.5 rounded text-[13px] mx-0.5 shadow-sm">
                                {keyword}
                              </span>
                            );
                          }
                          if (url.startsWith('mtg-rule:')) {
                            const rule = decodeURIComponent(url.replace('mtg-rule:', ''));
                            const anchor = rule.replace(/[^a-zA-Z0-9]/g, '');
                            return (
                              <a
                                href={`https://yawgatog.com/resources/magic-rules/#R${anchor}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[11px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border hover:text-foreground hover:border-primary/50 transition-colors mx-0.5 shadow-sm"
                              >
                                Rule {rule}
                              </a>
                            );
                          }

                          return (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
                              {...props}
                            >
                              {children}
                            </a>
                          );
                        },
                        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                        ul: ({ children }) => (
                          <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
                        ),
                        li: ({ children }) => <li>{children}</li>,
                        strong: ({ children }) => (
                          <strong className="font-semibold text-foreground">{children}</strong>
                        ),
                      }}
                    >
                      {prepareTextForMarkdown(msg.content)}
                    </ReactMarkdown>
                  </div>

                  {msg.role === 'model' && msg.context_used && msg.context_used.length > 0 && (
                    <div className="mt-1.5 w-[85%]">
                      <details className="text-[11px] w-full group">
                        <summary className="cursor-pointer font-medium select-none list-none inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                          <span className="bg-background border border-border px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
                            {msg.context_used.length} sources consulted
                            <ChevronDown className="w-3 h-3 transition-transform duration-200 group-open:rotate-180" />
                          </span>
                        </summary>

                        <div className="mt-2 p-1.5 rounded-lg bg-background border border-border shadow-inner space-y-1">
                          {msg.context_used.map((ctx: any, cIdx: number) => {
                            const name = ctx.name || ctx.card_name || 'Unknown Source';
                            const type =
                              ctx.type === 'ruling'
                                ? 'Ruling'
                                : ctx.type === 'card'
                                  ? 'Oracle Text'
                                  : 'Reference';

                            return (
                              <div
                                key={cIdx}
                                className="flex justify-between items-center bg-muted/50 px-2 py-1.5 rounded border border-border/40"
                              >
                                <span className="font-medium text-foreground truncate pr-2">
                                  {name}
                                </span>
                                <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground bg-background px-1.5 py-0.5 rounded shrink-0 shadow-sm">
                                  {type}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              );
            })}

            {isStreaming && messages.length > 0 && messages[messages.length - 1].content === '' && (
              <div className="flex flex-col items-start">
                <div className="p-3 rounded-2xl rounded-bl-sm bg-secondary border border-border/50 text-secondary-foreground shadow-sm flex gap-1 items-center h-[42px] px-4">
                  <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce"></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </CardContent>

          <form
            onSubmit={handleSubmit}
            className="bg-card z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
          >
            <CardFooter className="p-3 border-t border-border flex gap-2">
              <Input
                placeholder={
                  isStreaming ? 'Judge is reviewing the rules...' : 'Ask a rules question...'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isStreaming}
                className="flex-1 bg-background"
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
        className="h-14 w-14 rounded-full shadow-xl transition-transform hover:scale-105 hover:shadow-primary/20"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </Button>
    </div>
  );
}
