import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fixtureProject } from "@/fixtures";
import { projectContextSchema } from "@/lib/api-schemas";

vi.mock("server-only", () => ({}));

// Opt-in real API call (costs tokens). Run:
//   AI_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/ai/brief.live.test.ts
// AI_LIVE only switches the test on; the app's own env still comes from src/lib/env.ts.
const live = process.env.AI_LIVE === "1";

describe.skipIf(!live)("parseBrief (live)", () => {
  it("turns the fixture question + a DOCX brief into a valid context", async () => {
    const { parseBrief } = await import("./brief");
    const data = new Uint8Array(
      readFileSync(new URL("./__fixtures__/brief.docx", import.meta.url)),
    );
    const { context, extractedText } = await parseBrief({
      query: fixtureProject.query,
      brief: {
        data,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename: "brief.docx",
      },
    });
    console.log(JSON.stringify(context, null, 1));
    expect(projectContextSchema.parse(context)).toEqual(context);
    expect(context.claims.length).toBeGreaterThan(0);
    expect(context.claims.map((c) => c.id)).toEqual(context.claims.map((_, i) => `c${i + 1}`));
    expect(JSON.stringify(context)).not.toMatch(/https?:\/\/|\b10\.\d{4,9}\//);
    expect(context.constraints.join(" ")).toMatch(/2015/);
    expect(extractedText).toContain("2015 onwards");
  }, 180_000);
});
