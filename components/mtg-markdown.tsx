'use client';

import ReactMarkdown from 'react-markdown';
import { CardTooltip } from '@/components/card-tooltip';

interface MTGMarkdownProps {
  content: string;
}

export function MTGMarkdown({ content }: MTGMarkdownProps) {
  const getManaClass = (sym: string): string => {
    const s = sym.toLowerCase().trim();
    if (s === 't') return 'ms-tap';
    if (s === 'q') return 'ms-untap';
    return `ms-${s.replace('/', '')}`;
  };

  const prepareTextForMarkdown = (text: string) => {
    let processed = text;

    // Symbols
    processed = processed.replace(/\{([0-9a-zA-Z/]+?)\}/g, (_, sym) => {
      const cleanSym = sym.toUpperCase().replace('/', '');
      return `[${cleanSym}](mtg-sym:${cleanSym})`;
    });

    // Cards, Keywords, Rules
    processed = processed.replace(
      /\[\[card:([\s\S]*?)\]\]/gi,
      (_, name) => `[${name.trim()}](mtg-card:${encodeURIComponent(name.trim())})`
    );
    processed = processed.replace(
      /\[\[kw:([\s\S]*?)\]\]/gi,
      (_, kw) => `[${kw.trim()}](mtg-kw:${encodeURIComponent(kw.trim())})`
    );
    processed = processed.replace(
      /\[\[rule:([\s\S]*?)\]\]/gi,
      (_, rule) => `[${rule.trim()}](mtg-rule:${encodeURIComponent(rule.trim())})`
    );

    return processed;
  };

  return (
    <ReactMarkdown
      urlTransform={(url) => url}
      components={{
        a: ({ href, children, ...props }) => {
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
        ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
      }}
    >
      {prepareTextForMarkdown(content)}
    </ReactMarkdown>
  );
}
