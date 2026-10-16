import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "user-1" as string | undefined,
  project: { id: "p" } as unknown,
  dbError: null as unknown,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: {
      getClaims: async () => ({ data: state.userId ? { claims: { sub: state.userId } } : null }),
    },
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: state.project, error: state.dbError }),
      };
      return builder;
    },
  }),
}));
const phraseInsight = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai", () => ({ phraseInsight }));

const { POST } = await import("./route");

const body = {
  projectId: "00000000-0000-4000-8000-000000000001",
  kind: "study",
  label: "Reviews",
  direction: "skip",
  count: 3,
  total: 3,
};
const post = (b: unknown) =>
  POST(
    new Request("http://localhost/api/ranking/insight", {
      method: "POST",
      body: JSON.stringify(b),
    }),
  );

beforeEach(() => {
  state.userId = "user-1";
  state.project = { id: body.projectId };
  state.dbError = null;
  phraseInsight.mockReset();
  phraseInsight.mockResolvedValue("You keep skipping reviews. Hide them?");
});

describe("POST /api/ranking/insight", () => {
  it("returns the model's sentence for the pattern only", async () => {
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sentence: "You keep skipping reviews. Hide them?" });
    expect(phraseInsight).toHaveBeenCalledWith(
      { kind: "study", label: "Reviews", direction: "skip", count: 3, total: 3 },
      expect.any(AbortSignal),
    );
  });

  it("needs a signed-in member and a valid pattern", async () => {
    expect((await post({ ...body, count: 4 })).status).toBe(400);
    expect((await post({ ...body, kind: "title" })).status).toBe(400);
    state.project = null;
    expect((await post(body)).status).toBe(404);
    state.userId = undefined;
    expect((await post(body)).status).toBe(401);
    expect(phraseInsight).not.toHaveBeenCalled();
  });

  it("reports model failures as 502", async () => {
    phraseInsight.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post(body)).status).toBe(502);
  });
});
