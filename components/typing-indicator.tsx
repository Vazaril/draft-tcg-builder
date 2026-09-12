'use client';

export function TypingIndicator() {
  return (
    <div className="flex flex-col items-start animate-in fade-in duration-200">
      <div className="p-3 rounded-2xl rounded-bl-sm bg-secondary border border-border/50 text-secondary-foreground shadow-sm flex gap-1 items-center h-[42px] px-4">
        <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" />
      </div>
    </div>
  );
}
