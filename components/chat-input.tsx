'use client';

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isStreaming?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isStreaming = false,
  placeholder = 'Ask a question...',
  disabled = false,
}: ChatInputProps) {
  return (
    <form onSubmit={onSubmit} className="bg-card z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="p-3 border-t border-border flex gap-2">
        <Input
          placeholder={isStreaming ? 'Thinking...' : placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isStreaming}
          className="flex-1 bg-background"
        />
        <Button type="submit" size="icon" disabled={disabled || isStreaming || !value.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </form>
  );
}
