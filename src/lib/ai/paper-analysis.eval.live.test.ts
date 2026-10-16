import { describe, expect, it, vi } from "vitest";
import { fixturePapers, fixtureProject } from "@/fixtures";
import type { Paper } from "@/types/domain";
import { checkAnalysis, formatEvalReport, type EvalRow } from "./eval";

vi.mock("server-only", () => ({}));

// AI-06. Opt-in real API calls (11 short FAST-model requests, costs tokens). Run:
//   AI_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/ai/paper-analysis.eval.live.test.ts --silent=false
const live = process.env.AI_LIVE === "1";

describe.skipIf(!live)("paper analysis eval (live)", () => {
  it("invents no bibliographic data on 10 fixture papers and a paper with no abstract", async () => {
    const { analysePaper } = await import("./paper-analysis");
    const all = fixturePapers.map((e) => e.paper);
    const first = all[0]!;
    const papers: Paper[] = [
      ...all.slice(0, 10),
      { ...first, id: `${first.id}-noabstract`, abstract: undefined },
    ];

    const rows: EvalRow[] = [];
    const usage = { input: 0, output: 0, cacheRead: 0 };
    // Sequential: gentle on rate limits, and the log reads in order.
    for (const paper of papers) {
      try {
        const result = await analysePaper({
          paper,
          projectId: fixtureProject.id,
          context: fixtureProject.context,
        });
        usage.input += result.usage.input_tokens;
        usage.output += result.usage.output_tokens;
        usage.cacheRead += result.usage.cache_read_input_tokens;
        rows.push({
          paperId: paper.id,
          relevance: result.analysis.relevance,
          repaired: result.repaired,
          issues: checkAnalysis(paper, result.analysis, {
            // Its own title is checked separately; the no-abstract copy shares the first's title.
            others: all.filter((p) => p.title !== paper.title),
            context: fixtureProject.context,
            repaired: result.repaired,
          }),
        });
      } catch (err) {
        rows.push({
          paperId: paper.id,
          repaired: false,
          issues: { failures: [], warnings: [] },
          error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        });
      }
    }

    console.log(`\n${formatEvalReport(rows, usage)}\n`);
    const failed = rows
      .filter((r) => r.error || r.issues.failures.length)
      .map((r) => ({ paperId: r.paperId, error: r.error, failures: r.issues.failures }));
    expect(failed).toEqual([]);
  }, 300_000);
});
