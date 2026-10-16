import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixturePapers, fixtureProject } from "@/fixtures";
import { analyseStreamEventSchema } from "@/lib/api-schemas";
import type { Paper } from "@/types/domain";

/** Rows each table returns, and upserts the route made. */
const db = vi.hoisted(() => ({
  userId: "user-1" as string | undefined,
  project: undefined as unknown,
  analyses: [] as { paper_id: string; analysis: unknown }[],
  papers: [] as { id: string; data: unknown }[],
  upserts: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/supabase/server", () => {
  /** A minimal chainable stand-in for the supabase-js query builder. */
  const query = (table: string) => {
    const result = () => {
      if (table === "projects") return { data: db.project ?? null, error: null };
      if (table === "paper_analyses") return { data: db.analyses, error: null };
      return { data: db.papers, error: null };
    };
    const builder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      maybeSingle: async () => result(),
      upsert: async (row: Record<string, unknown>) => {
        db.upserts.push(row);
        return { error: null };
      },
      then: (resolve: (value: unknown) => unknown) => resolve(result()),
    };
    return builder;
  };
  return {
    getSupabaseServerClient: async () => ({
      auth: {
        getClaims: async () => ({ data: db.userId ? { claims: { sub: db.userId } } : null }),
      },
      from: query,
    }),
  };
});

const analysePaper = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai", () => ({ analysePaper }));

const { POST } = await import("./route");

const projectId = fixtureProject.id;
const [first, second] = fixturePapers;

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/analyse", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

/** Every line must be a contract-valid event. */
async function events(response: Response) {
  const text = await response.text();
  expect(text.endsWith("\n")).toBe(true);
  return text
    .trimEnd()
    .split("\n")
    .map((line) => analyseStreamEventSchema.parse(JSON.parse(line)));
}

beforeEach(() => {
  db.userId = "user-1";
  db.project = { context: fixtureProject.context, title: fixtureProject.title, query: "q" };
  db.analyses = [];
  db.papers = fixturePapers.map((f) => ({ id: f.paper.id, data: f.paper }));
  db.upserts = [];
  analysePaper.mockReset();
  analysePaper.mockImplementation(async ({ paper }: { paper: Paper }) => ({
    analysis: fixturePapers.find((f) => f.paper.id === paper.id)!.analysis,
  }));
});

describe("POST /api/analyse", () => {
  it("rejects signed-out requests", async () => {
    db.userId = undefined;
    const response = await post({ projectId, paperIds: [first!.paper.id] });
    expect(response.status).toBe(401);
  });

  it.each([
    ["malformed JSON", "{"],
    ["a non-uuid project", { projectId: "nope", paperIds: ["a"] }],
    ["no papers", { projectId, paperIds: [] }],
    ["too many papers", { projectId, paperIds: Array.from({ length: 11 }, (_, i) => `p${i}`) }],
  ])("rejects %s with 400", async (_label, body) => {
    expect((await post(body)).status).toBe(400);
  });

  it("returns 404 for a project the user can't see", async () => {
    db.project = undefined;
    expect((await post({ projectId, paperIds: [first!.paper.id] })).status).toBe(404);
  });

  it("streams saved and new analyses as NDJSON and saves the new one with credibility", async () => {
    db.analyses = [{ paper_id: first!.paper.id, analysis: first!.analysis }];
    const response = await post({ projectId, paperIds: [first!.paper.id, second!.paper.id] });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(await events(response)).toEqual([
      { type: "analysis", analysis: first!.analysis },
      { type: "analysis", analysis: second!.analysis },
      { type: "done" },
    ]);
    expect(analysePaper).toHaveBeenCalledTimes(1);
    expect(analysePaper.mock.calls[0]![0]).toMatchObject({
      projectId,
      context: fixtureProject.context,
      paper: { id: second!.paper.id },
    });
    expect(db.upserts).toEqual([
      expect.objectContaining({
        project_id: projectId,
        paper_id: second!.paper.id,
        analysis: second!.analysis,
        credibility: expect.objectContaining({ score: expect.any(Number) }),
      }),
    ]);
  });

  it("falls back to the title and query when the project has no parsed brief", async () => {
    db.project = { context: null, title: "Sleep and memory", query: "sleep memory students" };
    await events(await post({ projectId, paperIds: [first!.paper.id] }));
    expect(analysePaper.mock.calls[0]![0].context).toEqual({
      topic: "Sleep and memory",
      summary: "sleep memory students",
      claims: [],
      themes: [],
      constraints: [],
    });
  });
});
