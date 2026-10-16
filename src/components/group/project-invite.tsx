import { connection } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { InviteDialog } from "./invite-dialog";

/**
 * The Invite button for a project (GR-01). Reads the join code and member count as the user, so
 * RLS decides: someone who can't see the project gets nothing rendered.
 */
export async function ProjectInvite({ projectId }: { projectId: string }) {
  if (!z.uuid().safeParse(projectId).success) return null;
  // Request time only: supabase-js reads the clock to check token expiry.
  await connection();
  const supabase = await getSupabaseServerClient();
  const [project, members] = await Promise.all([
    supabase.from("projects").select("title, join_code").eq("id", projectId).maybeSingle(),
    supabase
      .from("project_members")
      .select("user_id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);
  if (project.error) console.error("[group] reading join code failed", project.error.message);
  if (members.error) console.error("[group] counting members failed", members.error.message);
  if (!project.data) return null;
  return (
    <InviteDialog
      code={project.data.join_code}
      title={project.data.title}
      groupHref={`/app/p/${projectId}/group`}
      memberCount={Math.max(1, members.count ?? 1)}
    />
  );
}
