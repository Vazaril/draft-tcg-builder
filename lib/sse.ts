/**
 * Minimal Server-Sent-Events parser for a fetch() Response body.
 *
 * Not using the browser's EventSource API here because it can't send a
 * POST body or custom headers (needed for the Supabase Authorization
 * bearer token) - see backend/deck-generation-streaming.md.
 */
export type SseEvent = Record<string, unknown> & { type: string };

export async function* streamSse(response: Response): AsyncGenerator<SseEvent> {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const messages = buffer.split('\n\n');
    buffer = messages.pop() ?? '';

    for (const message of messages) {
      const line = message.trim();
      if (!line.startsWith('data:')) continue;

      const jsonText = line.slice('data:'.length).trim();
      if (!jsonText) continue;

      try {
        yield JSON.parse(jsonText) as SseEvent;
      } catch {
        // Ignore a malformed chunk rather than aborting the whole stream.
      }
    }
  }
}
