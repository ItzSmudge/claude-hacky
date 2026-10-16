import { NextResponse } from "next/server";
import { z } from "zod";
import { analysePaper } from "@/lib/ai";
import { analyseBatch, type AnalyseBatchDeps } from "@/lib/ai/analyse-batch";
import {
  analyseRequestSchema,
  paperSchema,
  projectContextSchema,
  type ApiError,
} from "@/lib/api-schemas";
import { computeCredibility } from "@/lib/credibility";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { Paper, ProjectContext } from "@/types/domain";

// Owner: ai (AI-04). POST { projectId, paperIds } → NDJSON stream of AnalyseStreamEvent.

/** Vercel function limit; the batch deadline below stays under it so `done` is always sent. */
export const maxDuration = 60;
const DEADLINE_MS = 55_000;

const error = (status: number, message: string, details?: unknown) =>
  NextResponse.json<ApiError>(
    details === undefined ? { error: message } : { error: message, details },
    { status },
  );

/** Domain objects are plain JSON data; the interfaces just lack Json's index signature. */
const toJson = (value: object) => value as unknown as { [key: string]: Json | undefined };

/** Until a brief is parsed (AI-02), analyse against the project's title and query alone. */
function contextOf(project: { context: unknown; title: string; query: string }): ProjectContext {
  const parsed = projectContextSchema.safeParse(project.context);
  if (parsed.success) return parsed.data;
  return {
    topic: project.title,
    summary: project.query,
    claims: [],
    themes: [],
    constraints: [],
  };
}

export async function POST(request: Request) {
  // Members only: every call can spend model tokens.
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return error(401, "Sign in to analyse papers");

  const body: unknown = await request.json().catch(() => undefined);
  const parsed = analyseRequestSchema.safeParse(body);
  if (!parsed.success) return error(400, "Invalid request", z.treeifyError(parsed.error));
  const { projectId, paperIds } = parsed.data;

  // RLS hides projects the user isn't a member of.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("context, title, query")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) {
    console.error("[analyse] project lookup failed", projectError.code);
    return error(500, "Analysis failed");
  }
  if (!project) return error(404, "Project not found");
  const context = contextOf(project);

  const deps: AnalyseBatchDeps = {
    async loadExisting(ids) {
      const { data, error: err } = await supabase
        .from("paper_analyses")
        .select("paper_id, analysis")
        .eq("project_id", projectId)
        .in("paper_id", ids);
      if (err) throw new Error(`paper_analyses select failed: ${err.code}`);
      return data.map((row) => ({ paperId: row.paper_id, analysis: row.analysis }));
    },
    async loadPapers(ids) {
      const { data, error: err } = await supabase.from("papers").select("id, data").in("id", ids);
      if (err) throw new Error(`papers select failed: ${err.code}`);
      return data.flatMap((row): Paper[] => {
        const paper = paperSchema.safeParse(row.data);
        return paper.success ? [{ ...paper.data, id: row.id }] : [];
      });
    },
    async analyse(paper, signal) {
      return (await analysePaper({ paper, projectId, context, signal })).analysis;
    },
    async save(paper, analysis) {
      const { error: err } = await supabase.from("paper_analyses").upsert(
        {
          project_id: projectId,
          paper_id: paper.id,
          analysis: toJson(analysis),
          credibility: toJson(computeCredibility(paper)),
        },
        { onConflict: "project_id,paper_id" },
      );
      if (err) throw new Error(`paper_analyses upsert failed: ${err.code}`);
    },
  };

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(DEADLINE_MS)]);
  const claimIds = context.claims.map((claim) => claim.id);
  const events = analyseBatch({ projectId, paperIds, deps, claimIds, signal });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      } catch (err) {
        console.error("[analyse] stream failed", err);
        controller.error(err);
      }
    },
    async cancel() {
      await events.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
