import { beforeEach, describe, expect, it, vi } from "vitest";

const PROJECT = "00000000-0000-4000-8000-000000000001";

/** Filters each delete was narrowed by, so we can see exactly what would be removed. */
const db = vi.hoisted(() => ({
  userId: "user-1" as string | undefined,
  deletes: [] as Record<string, string>[],
  error: null as { code: string; message: string } | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: {
      getClaims: async () => ({ data: db.userId ? { claims: { sub: db.userId } } : null }),
    },
    from: () => ({
      delete: () => {
        const filters: Record<string, string> = {};
        db.deletes.push(filters);
        const chain = {
          eq: (column: string, value: string) => {
            filters[column] = value;
            return chain;
          },
          then: (resolve: (v: { error: typeof db.error }) => void) => resolve({ error: db.error }),
        };
        return chain;
      },
    }),
  }),
}));

const { DELETE } = await import("./route");

const del = async (query: string, projectId = PROJECT): Promise<Response> => {
  const res = await DELETE(
    new Request(`http://localhost/api/projects/${projectId}/swipes?${query}`, { method: "DELETE" }),
    { params: Promise.resolve({ projectId }) },
  );
  if (!res) throw new Error("no response");
  return res;
};

beforeEach(() => {
  db.userId = "user-1";
  db.deletes = [];
  db.error = null;
});

describe("DELETE /api/projects/[projectId]/swipes", () => {
  it("undo removes only the caller's swipe on that paper", async () => {
    expect((await del("paperId=openalex-W1")).status).toBe(204);
    expect(db.deletes).toEqual([
      { project_id: PROJECT, paper_id: "openalex-W1", user_id: "user-1" },
    ]);
  });

  it("all=true removes all of the caller's swipes in the project, and nobody else's", async () => {
    expect((await del("all=true")).status).toBe(204);
    expect(db.deletes).toEqual([{ project_id: PROJECT, user_id: "user-1" }]);
  });

  it("needs a paper id unless all=true", async () => {
    expect((await del("all=yes")).status).toBe(400);
    expect((await del("")).status).toBe(400);
    expect(db.deletes).toEqual([]);
  });

  it("returns 401 without a session and 400 for a bad project id", async () => {
    db.userId = undefined;
    expect((await del("all=true")).status).toBe(401);
    db.userId = "user-1";
    expect((await del("all=true", "not-a-uuid")).status).toBe(400);
    expect(db.deletes).toEqual([]);
  });

  it("maps a database failure to 500", async () => {
    db.error = { code: "XX000", message: "boom" };
    expect((await del("all=true")).status).toBe(500);
  });
});
