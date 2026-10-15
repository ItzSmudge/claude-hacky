#!/usr/bin/env node
// RLS smoke test against the local stack: pnpm db:smoke (needs pnpm db:start + .env.local).
// Two anonymous users exercise project ownership, membership, joining, swipes and the papers cache.
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const mk = () => createClient(url, key, { auth: { persistSession: false } });
const a = mk();
const b = mk();
let failed = 0;
const ok = (c, m) => {
  if (!c) failed++;
  console.log(c ? "✓" : "✗", m);
};
const { error: e1 } = await a.auth.signInAnonymously();
ok(!e1, "anon sign-in A " + (e1?.message ?? ""));
await b.auth.signInAnonymously();
const { data: p, error: e2 } = await a
  .from("projects")
  .insert({ title: "Test", query: "q" })
  .select()
  .single();
ok(p && !e2, "A creates project with insert…returning " + (e2?.message ?? ""));
const { data: m } = await a.from("project_members").select("role").eq("project_id", p.id);
ok(m?.[0]?.role === "owner", "owner membership via trigger");
const { data: seen } = await b.from("projects").select("id").eq("id", p.id);
ok(seen?.length === 0, "B cannot see A's project");
const { data: papers } = await b.from("papers").select("id").limit(3);
ok(papers?.length === 3, "signed-in user can read papers cache");
const { error: e3 } = await b
  .from("papers")
  .insert({ source: "openalex", external_id: "x", data: {} });
ok(!!e3, "users cannot write papers cache");
const { data: joined, error: ej } = await b.rpc("join_project", { p_code: p.join_code });
ok(joined === p.id, "B joins with code " + (ej?.message ?? ""));
const { error: e4 } = await b
  .from("swipes")
  .insert({ project_id: p.id, paper_id: papers[0].id, decision: "save" });
ok(!e4, "member B swipes " + (e4?.message ?? ""));
const { data: rl } = await a.from("reading_list").select("*").eq("project_id", p.id);
ok(rl?.length === 1 && rl[0].save_count === 1, "A sees B's save in reading_list");
const { error: e5 } = await a
  .from("swipes")
  .insert({
    project_id: p.id,
    paper_id: papers[1].id,
    decision: "skip",
    user_id: (await b.auth.getUser()).data.user.id,
  });
ok(!!e5, "A cannot swipe as B");
const { data: demo } = await a
  .from("projects")
  .select("id")
  .eq("id", "00000000-0000-4000-8000-000000000001");
ok(demo?.length === 0, "A cannot see demo project");
const { error: e6 } = await b.from("projects").delete().eq("id", p.id).select();
const { data: still } = await a.from("projects").select("id").eq("id", p.id);
ok(still?.length === 1, "member B cannot delete A's project " + (e6?.message ?? ""));
await a.from("projects").delete().eq("id", p.id);
process.exit(failed ? 1 : 0);
