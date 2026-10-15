import {
  analyseStreamEventSchema,
  type AnalyseRequest,
  type AnalyseStreamEvent,
} from "@/lib/api-schemas";

export async function streamAnalyses(
  request: AnalyseRequest,
  onEvent: (event: AnalyseStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/analyse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok || !response.body) throw new Error(`analyse failed: ${response.status}`);

  const emit = (line: string) => {
    if (!line.trim()) return;
    try {
      const parsed = analyseStreamEventSchema.safeParse(JSON.parse(line));
      if (parsed.success) onEvent(parsed.data);
    } catch {
      // A malformed line must not kill the rest of the stream.
    }
  };

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(emit);
  }
  emit(buffer);
}
