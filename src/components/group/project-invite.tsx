import { connection } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { memberLabels } from "./group-list";
import { InviteDialog } from "./invite-dialog";
import { LivePresence } from "./live-presence";

/**
 * The deck header's group tools: who's swiping now (GR-02) and the Invite button (GR-01). Reads
 * the project, its members and their names as the user, so RLS decides: someone who can't see
 * the project gets nothing rendered.
 */
export async function ProjectInvite({ projectId }: { projectId: string }) {
  if (!z.uuid().safeParse(projectId).success) return null;
  // Request time only: supabase-js reads the clock to check token expiry.
  await connection();
  const supabase = await getSupabaseServerClient();
  const [project, members, { data: auth }] = await Promise.all([
    supabase.from("projects").select("title, join_code").eq("id", projectId).maybeSingle(),
    supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .order("joined_at", { ascending: true }),
    supabase.auth.getClaims(),
  ]);
  if (project.error) console.error("[group] reading join code failed", project.error.message);
  if (members.error) console.error("[group] reading members failed", members.error.message);
  if (!project.data) return null;

  const me = auth?.claims.sub;
  const userIds = (members.data ?? []).map((m) => m.user_id);
  const profiles = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [] };
  const names = new Map((profiles.data ?? []).map((p) => [p.id, p.display_name]));
  const labels = memberLabels(
    userIds.map((userId) => ({ userId, displayName: names.get(userId) ?? null })),
    me,
  );
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {me && <LivePresence projectId={projectId} me={me} labels={[...labels]} />}
      <InviteDialog
        code={project.data.join_code}
        title={project.data.title}
        groupHref={`/app/p/${projectId}/group`}
        memberCount={Math.max(1, userIds.length)}
      />
    </div>
  );
}
