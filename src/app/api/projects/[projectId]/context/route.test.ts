import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_UPLOAD_BYTES, TOO_LARGE_MESSAGE } from "@/components/projects/new-project";
import { fixtureProject } from "@/fixtures";
import { AiConfigError, AiOutputError, BriefInputError } from "@/lib/ai/errors";

vi.mock("server-only", () => ({}));

const PID = fixtureProject.id;
const QUERY = fixtureProject.query;
const CONTEXT = fixtureProject.context;
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PROJECT = { id: PID, owner_id: "user-1", query: QUERY };

/** Rows the project read returns, and every write the route made. */
const db = vi.hoisted(() => ({
  userId: "user-1" as string | undefined,
  project: null as unknown,
  uploads: [] as { path: string; opts: { contentType?: string } }[],
  uploadError: null as { message: string } | null,
  removed: [] as string[],
  documents: [] as unknown[],
  projectUpdates: [] as unknown[],
}));

vi.mock("@/lib/supabase/server", () => {
  const projects = () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({ data: db.project, error: null }),
      update: (row: unknown) => {
        db.projectUpdates.push(row);
        return builder;
      },
    };
    return builder;
  };
  return {
    getSupabaseServerClient: async () => ({
      auth: {
        getClaims: async () => ({ data: db.userId ? { claims: { sub: db.userId } } : null }),
      },
      from: (table: string) =>
        table === "project_documents"
          ? {
              insert: async (row: unknown) => {
                db.documents.push(row);
                return { error: null };
              },
            }
          : projects(),
      storage: {
        from: () => ({
          upload: async (path: string, _data: unknown, opts: { contentType?: string }) => {
            if (db.uploadError) return { data: null, error: db.uploadError };
            db.uploads.push({ path, opts });
            return { data: { path }, error: null };
          },
          remove: async (paths: string[]) => {
            db.removed.push(...paths);
            return { data: [], error: null };
          },
        }),
      },
    }),
  };
});

const parseBrief = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai", () => ({ parseBrief }));

const { POST, maxDuration } = await import("./route");

const withBrief = (name: string, type: string, size = 3) => {
  const form = new FormData();
  form.set("brief", new File([new Uint8Array(size)], name, { type }));
  return form;
};

const post = (id: string, form: FormData) =>
  POST(new Request(`http://localhost/api/projects/${id}/context`, { method: "POST", body: form }), {
    params: Promise.resolve({ projectId: id }),
  });

beforeEach(() => {
  db.userId = "user-1";
  db.project = PROJECT;
  db.uploads = [];
  db.uploadError = null;
  db.removed = [];
  db.documents = [];
  db.projectUpdates = [];
  parseBrief.mockReset();
  parseBrief.mockResolvedValue({
    context: CONTEXT,
    extractedText: "text",
    usage: {},
    repaired: false,
  });
});

describe("POST /api/projects/[projectId]/context", () => {
  it("allows two minutes for slow briefs", () => {
    expect(maxDuration).toBe(120);
  });

  it.each([
    [
      "no session",
      () => {
        db.userId = undefined;
      },
      PID,
      401,
    ],
    ["a bad id", () => {}, "not-a-uuid", 400],
    [
      "a missing project",
      () => {
        db.project = null;
      },
      PID,
      404,
    ],
    [
      "a member who isn't the owner",
      () => {
        db.project = { ...PROJECT, owner_id: "someone-else" };
      },
      PID,
      403,
    ],
  ])(
    "returns the right status for %s, without uploading or parsing",
    async (_, arrange, id, status) => {
      arrange();
      expect((await post(id, withBrief("brief.pdf", "application/pdf"))).status).toBe(status);
      expect(db.uploads).toEqual([]);
      expect(parseBrief).not.toHaveBeenCalled();
    },
  );

  it("parses the question alone when no file is sent, and saves nothing", async () => {
    const res = await post(PID, new FormData());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ context: CONTEXT });
    expect(parseBrief).toHaveBeenCalledWith(
      expect.objectContaining({ query: QUERY, brief: undefined }),
    );
    expect(db.uploads).toEqual([]);
    expect(db.documents).toEqual([]);
    expect(db.projectUpdates).toEqual([]);
  });

  it("treats an empty file input as no brief", async () => {
    const form = new FormData();
    form.set("brief", new File([], ""));
    expect((await post(PID, form)).status).toBe(200);
    expect(parseBrief.mock.calls[0]![0].brief).toBeUndefined();
    expect(db.uploads).toEqual([]);
  });

  it("uploads the brief, parses it and records the document without saving the context", async () => {
    const res = await post(PID, withBrief("brief.docx", DOCX));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ context: CONTEXT });
    expect(db.uploads[0]!.path).toMatch(new RegExp(`^${PID}/[\\w-]+-brief\\.docx$`));
    expect(db.uploads[0]!.opts.contentType).toBe(DOCX);
    const call = parseBrief.mock.calls[0]![0];
    expect(call.brief).toMatchObject({ filename: "brief.docx", mimeType: DOCX });
    expect(call.brief.data).toBeInstanceOf(Uint8Array);
    expect(call.signal).toBeInstanceOf(AbortSignal);
    expect(db.documents).toEqual([
      {
        project_id: PID,
        storage_path: db.uploads[0]!.path,
        filename: "brief.docx",
        extracted_text: "text",
      },
    ]);
    expect(db.projectUpdates).toEqual([]);
  });

  it("stores a markdown brief with a text content type even if the browser sends octet-stream", async () => {
    await post(PID, withBrief("notes.md", "application/octet-stream"));
    expect(db.uploads[0]!.opts.contentType).toBe("text/markdown");
  });

  it("rejects files over 4 MB with 400 before uploading", async () => {
    const res = await post(PID, withBrief("big.pdf", "application/pdf", MAX_UPLOAD_BYTES + 1));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(TOO_LARGE_MESSAGE);
    expect(db.uploads).toEqual([]);
    expect(parseBrief).not.toHaveBeenCalled();
  });

  it("rejects an unsupported file with 400 before uploading", async () => {
    expect((await post(PID, withBrief("scan.png", "image/png"))).status).toBe(400);
    expect(db.uploads).toEqual([]);
    expect(parseBrief).not.toHaveBeenCalled();
  });

  it.each([
    ["BriefInputError", new BriefInputError("unreadable", "Can't read it."), 400],
    ["AiConfigError", new AiConfigError("no key"), 503],
    ["AiOutputError", new AiOutputError("invalid"), 502],
  ])("maps %s to %i and removes the uploaded file", async (_, err, status) => {
    parseBrief.mockRejectedValueOnce(err);
    const res = await post(PID, withBrief("brief.pdf", "application/pdf"));
    expect(res.status).toBe(status);
    expect(db.removed).toEqual([db.uploads[0]!.path]);
    expect(db.documents).toEqual([]);
  });

  it("returns 500 when the upload fails, without parsing", async () => {
    db.uploadError = { message: "bucket" };
    expect((await post(PID, withBrief("brief.pdf", "application/pdf"))).status).toBe(500);
    expect(parseBrief).not.toHaveBeenCalled();
  });
});
