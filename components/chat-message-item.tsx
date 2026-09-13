'use client';

import { Message } from '@/hooks/use-chat-stream';
import { MTGMarkdown } from '@/components/mtg-markdown';
import { MTGCitations } from '@/components/mtg-citations';

interface ChatMessageItemProps {
  message: Message;
}

export function ChatMessageItem({ message }: ChatMessageItemProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`p-3 rounded-2xl max-w-[85%] text-[14px] leading-relaxed shadow-sm ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-secondary text-secondary-foreground border border-border/50 rounded-bl-sm'
        }`}
      >
        <MTGMarkdown content={message.content} />
      </div>

      {!isUser && <MTGCitations citations={message.context_used || []} />}
    </div>
  );
}
