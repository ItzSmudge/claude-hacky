-- Resets the public demo project before judging (RD-02): removes every guest who joined it and
-- their swipes, so the group list, presence and "Member N" labels start clean.
-- Keeps the demo itself, its owner's starter saves and all analyses. Guests' own projects are
-- untouched. Safe to run any number of times. Paste into Supabase → SQL Editor → Run.
-- (To also restore analyses and the owner's starter saves, run prod-demo.sql afterwards.)
begin;

delete from public.swipes s
using public.projects p
where p.join_code = 'DEMO42'
  and s.project_id = p.id
  and s.user_id <> p.owner_id;

delete from public.project_members m
using public.projects p
where p.join_code = 'DEMO42'
  and m.project_id = p.id
  and m.user_id <> p.owner_id;

commit;

-- Check: expect members 1, guest_swipes 0.
select
  (select count(*) from public.project_members m join public.projects p on p.id = m.project_id
    where p.join_code = 'DEMO42') as members,
  (select count(*) from public.swipes s join public.projects p on p.id = s.project_id
    where p.join_code = 'DEMO42' and s.user_id <> p.owner_id) as guest_swipes,
  (select count(*) from public.swipes s join public.projects p on p.id = s.project_id
    where p.join_code = 'DEMO42' and s.decision = 'save') as saves;
