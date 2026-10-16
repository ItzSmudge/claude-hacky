import { analyseStreamEventSchema, type AnalyseStreamEvent } from "@/lib/api-schemas";

/**
 * Client-safe reader for `POST /api/analyse` (AI-04): yields each NDJSON line of the response
 * body as a validated `AnalyseStreamEvent`, skipping lines that don't parse. For SW-04's deck.
 * Not exported from `@/lib/ai`, which is server-only.
 */
export async function* readAnalyseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AnalyseStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const parse = (text: string) => {
    if (!text.trim()) return undefined;
    try {
      const result = analyseStreamEventSchema.safeParse(JSON.parse(text));
      return result.success ? result.data : undefined;
    } catch {
      return undefined;
    }
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const text of lines) {
        const event = parse(text);
        if (event) yield event;
      }
    }
    const last = parse(buffer + decoder.decode());
    if (last) yield last;
  } finally {
    // The caller may stop early (break / unmount): cancel so the server stops analysing.
    // A no-op once the stream has ended.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
