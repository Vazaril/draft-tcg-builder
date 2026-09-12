'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { useChatStream } from '@/hooks/use-chat-stream';
import { ChatMessageItem } from '@/components/chat-message-item';
import { TypingIndicator } from '@/components/typing-indicator';
import { ChatInput } from '@/components/chat-input';

export function JudgeChat() {
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, setInput, isStreaming, error, handleSubmit } =
    useChatStream('/api/chat');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, error]);

  const isModelThinking =
    isStreaming && messages.length > 0 && messages[messages.length - 1].content === '';

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
            {messages.length === 0 && !error && (
              <p className="text-muted-foreground text-sm text-center mt-10">
                Ask a rules question! (e.g. Can I cast Murder on a hexproof creature?)
              </p>
            )}

            {messages.map((msg, idx) => {
              if (msg.role === 'model' && msg.content === '' && isStreaming) return null;
              return <ChatMessageItem key={idx} message={msg} />;
            })}

            {isModelThinking && <TypingIndicator />}

            {error && (
              <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1 leading-normal">{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </CardContent>

          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            isStreaming={isStreaming}
            placeholder="Ask a rules question..."
          />
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
