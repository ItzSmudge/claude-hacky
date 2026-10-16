import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureProject } from "@/fixtures";
import { projectSchema } from "@/lib/api-schemas";

const ROW = {
  id: fixtureProject.id,
  owner_id: "00000000-0000-4000-8000-0000000000aa",
  title: "Sleep",
  query: "Does sleep matter?",
  context: null,
  join_code: "ABC123",
  created_at: "2026-10-16T10:00:00.000Z",
};

/** What the insert returns, and the rows the route inserted. */
const db = vi.hoisted(() => ({
  userId: "user-1" as string | undefined,
  inserts: [] as unknown[],
  insertError: null as { code: string; message: string } | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: {
      getClaims: async () => ({ data: db.userId ? { claims: { sub: db.userId } } : null }),
    },
    from: () => ({
      insert: (row: unknown) => {
        db.inserts.push(row);
        return {
          select: () => ({
            single: async () =>
              db.insertError ? { data: null, error: db.insertError } : { data: ROW, error: null },
          }),
        };
      },
    }),
  }),
}));

const { POST } = await import("./route");

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/projects", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  db.userId = "user-1";
  db.inserts = [];
  db.insertError = null;
});

describe("POST /api/projects", () => {
  it("returns 401 without a session", async () => {
    db.userId = undefined;
    expect((await post({ title: "T", query: "Q" })).status).toBe(401);
    expect(db.inserts).toEqual([]);
  });

  it("returns 400 for a blank question", async () => {
    expect((await post({ title: "T", query: "   " })).status).toBe(400);
    expect(db.inserts).toEqual([]);
  });

  it("returns 400 for a non-JSON body", async () => {
    expect((await post("nope")).status).toBe(400);
  });

  it("inserts title and query as the user and returns 201 Project", async () => {
    const res = await post({ title: "Sleep", query: "Does sleep matter?" });
    expect(res.status).toBe(201);
    expect(db.inserts).toEqual([{ title: "Sleep", query: "Does sleep matter?" }]);
    const project = projectSchema.parse(await res.json());
    expect(project).toMatchObject({ id: ROW.id, joinCode: "ABC123", context: null });
  });

  it("returns 500 when the insert fails", async () => {
    db.insertError = { code: "42501", message: "denied" };
    expect((await post({ title: "T", query: "Q" })).status).toBe(500);
  });
});
