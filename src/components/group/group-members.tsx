"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface MemberView {
  userId: string;
  name: string;
  role: "owner" | "member";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts.at(-1)![0] : name.slice(0, 2)).toUpperCase();
}

/** Who's in the group. The owner can remove anyone else (RLS: "leave or owner removes"). */
export function GroupMembers({
  projectId,
  me,
  members,
}: {
  projectId: string;
  me: string | undefined;
  members: MemberView[];
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const isOwner = members.some((m) => m.userId === me && m.role === "owner");

  async function remove(member: MemberView) {
    setRemoving(member.userId);
    const { data, error } = await getSupabaseBrowserClient()
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", member.userId)
      .select("user_id");
    setRemoving(null);
    setConfirming(null);
    if (error || !data?.length) {
      toast.error(`Couldn't remove ${member.name}. Try again.`);
      return;
    }
    toast.success(`${member.name} was removed from the group.`);
    router.refresh();
  }

  return (
    <section
      aria-labelledby="group-members-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-paper md:p-6 hc:border-2"
    >
      <h3 id="group-members-heading" className="font-display text-xl">
        Members <span className="text-muted-foreground">({members.length})</span>
      </h3>
      <ul className="flex flex-col divide-y divide-border">
        {members.map((member) => {
          const isMe = member.userId === me;
          const label = isMe ? `${member.name} (you)` : member.name;
          return (
            <li key={member.userId} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar>
                <AvatarFallback aria-hidden>{initials(member.name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
              {member.role === "owner" && <Badge variant="secondary">Owner</Badge>}
              {isOwner && !isMe && member.role !== "owner" && (
                <div className="flex gap-2">
                  {confirming === member.userId ? (
                    <>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={removing === member.userId}
                        onClick={() => remove(member)}
                      >
                        {removing === member.userId ? "Removing…" : "Confirm remove"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Remove ${member.name} from the group`}
                      onClick={() => setConfirming(member.userId)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
