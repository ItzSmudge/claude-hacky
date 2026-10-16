import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixturePapers, fixtureProject } from "@/fixtures";
import fixtureRelations from "@/lib/ai/__fixtures__/relations.json";
import { projectRelationsSchema } from "@/lib/ai/schemas";
import type { LoadResult } from "@/lib/export";

const state = vi.hoisted(() => ({
  userId: "user-1" as string | undefined,
  library: undefined as unknown,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: {
      getClaims: async () => ({ data: state.userId ? { claims: { sub: state.userId } } : null }),
    },
  }),
}));
vi.mock("@/lib/export", () => ({ loadSavedLibrary: async () => state.library }));
const analyseRelations = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai", () => ({ analyseRelations }));

const { POST } = await import("./route");

const projectId = fixtureProject.id;
const saved = fixturePapers.slice(0, 3);
const library: LoadResult = {
  ok: true,
  library: {
    title: fixtureProject.title,
    claims: fixtureProject.context.claims,
    papers: saved.map((f) => f.paper),
    analyses: new Map(saved.map((f) => [f.paper.id, f.analysis])),
    savedBy: new Map(),
  },
};

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/analyse/relations", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  state.userId = "user-1";
  state.library = library;
  analyseRelations.mockReset();
  analyseRelations.mockResolvedValue(fixtureRelations);
});

describe("POST /api/analyse/relations", () => {
  it("returns the saved set's relations", async () => {
    const response = await post({ projectId });
    expect(response.status).toBe(200);
    const { relations } = (await response.json()) as { relations: unknown };
    expect(projectRelationsSchema.parse(relations)).toEqual(fixtureRelations);
    expect(analyseRelations).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        topic: fixtureProject.title,
        claims: fixtureProject.context.claims,
        papers: saved.map((f) => f.paper),
      }),
    );
  });

  it("rejects signed-out callers", async () => {
    state.userId = undefined;
    expect((await post({ projectId })).status).toBe(401);
    expect(analyseRelations).not.toHaveBeenCalled();
  });

  it("rejects a bad body", async () => {
    expect((await post({ projectId: "nope" })).status).toBe(400);
    expect((await post("{")).status).toBe(400);
  });

  it("404s for projects the caller can't see", async () => {
    state.library = { ok: false, reason: "not-found" } satisfies LoadResult;
    expect((await post({ projectId })).status).toBe(404);
    expect(analyseRelations).not.toHaveBeenCalled();
  });

  it("500s when the library can't be read", async () => {
    state.library = { ok: false, reason: "error" } satisfies LoadResult;
    expect((await post({ projectId })).status).toBe(500);
  });

  it("502s when the model fails", async () => {
    analyseRelations.mockRejectedValueOnce(new Error("invalid output"));
    const response = await post({ projectId });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Couldn't analyse relations" });
  });
});
