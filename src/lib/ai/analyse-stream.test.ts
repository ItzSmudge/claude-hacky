import { describe, expect, it } from "vitest";
import { fixturePapers } from "@/fixtures";
import type { AnalyseStreamEvent } from "@/lib/api-schemas";
import { readAnalyseStream } from "./analyse-stream";

const analysis = fixturePapers[0]!.analysis;
const line = (event: unknown) => `${JSON.stringify(event)}\n`;

function streamOf(...chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>) {
  const events: AnalyseStreamEvent[] = [];
  for await (const event of readAnalyseStream(body)) events.push(event);
  return events;
}

describe("readAnalyseStream", () => {
  it("parses one event per line", async () => {
    const body = streamOf(line({ type: "analysis", analysis }) + line({ type: "done" }));
    expect(await collect(body)).toEqual([{ type: "analysis", analysis }, { type: "done" }]);
  });

  it("joins lines split across chunks, including multi-byte characters", async () => {
    const text = line({ type: "error", paperId: "p1", error: "AI is busy — try again" });
    const bytes = new TextEncoder().encode(text);
    const cut = text.indexOf("—") + 1; // inside the 3-byte dash
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, cut));
        controller.enqueue(bytes.slice(cut));
        controller.close();
      },
    });
    expect(await collect(body)).toEqual([
      { type: "error", paperId: "p1", error: "AI is busy — try again" },
    ]);
  });

  it("reads a final line without a trailing newline", async () => {
    expect(await collect(streamOf('{"type":"done"}'))).toEqual([{ type: "done" }]);
  });

  it("skips blank, malformed and off-contract lines", async () => {
    const body = streamOf(
      "\n",
      "not json\n",
      line({ type: "mystery" }),
      line({ type: "analysis", analysis: { overview: "partial" } }),
      line({ type: "done" }),
    );
    expect(await collect(body)).toEqual([{ type: "done" }]);
  });
});
