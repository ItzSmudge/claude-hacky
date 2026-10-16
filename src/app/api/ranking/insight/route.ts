import { NextResponse } from "next/server";
import { z } from "zod";
import { phraseInsight } from "@/lib/ai";
import type { ApiError } from "@/lib/api-schemas";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: ranking (RK-03). POST a code-found swipe pattern → { sentence } from the SMART model.
// The deck has its own template sentence, so any failure here just means it uses that.

export const maxDuration = 15;
const DEADLINE_MS = 8_000;

const requestSchema = z.object({
  projectId: z.uuid(),
  kind: z.enum(["topic", "keyword", "study", "year", "venue", "cited"]),
  label: z.string().trim().min(1).max(80),
  direction: z.enum(["skip", "save"]),
  count: z.int().positive().max(10_000),
  total: z.int().positive().max(10_000),
});

const error = (status: number, message: string) =>
  NextResponse.json<ApiError>({ error: message }, { status });

export async function POST(request: Request) {
  // Members only: every call spends model tokens.
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return error(401, "Sign in first");

  const body: unknown = await request.json().catch(() => undefined);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success || parsed.data.count > parsed.data.total)
    return error(400, "Invalid request");
  const { projectId, ...pattern } = parsed.data;

  // RLS as the user: no row means not a member.
  const { data: project, error: dbError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (dbError) return error(500, "Couldn't check the project");
  if (!project) return error(404, "Project not found");

  try {
    const sentence = await phraseInsight(
      pattern,
      AbortSignal.any([request.signal, AbortSignal.timeout(DEADLINE_MS)]),
    );
    return NextResponse.json({ sentence }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[insight] phrasing failed", err instanceof Error ? err.name : typeof err);
    return error(502, "Couldn't phrase the insight");
  }
}
