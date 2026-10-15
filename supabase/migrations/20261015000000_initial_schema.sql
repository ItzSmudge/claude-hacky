-- PaperCut initial schema (F-10). See docs/SETUP_PLAN.md §0.7.
-- Access model: everything hangs off a project; a user can see a project's data iff they are in
-- project_members. The shared `papers` cache is readable by any signed-in user (incl. anonymous)
-- and written only by the service role.

create extension if not exists pgcrypto with schema extensions;

-- ── profiles ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── projects & membership ────────────────────────────────────────────────
create function public.generate_join_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- 6 chars from an unambiguous alphabet (no 0/O/1/I/L)
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6);
$$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  query text not null default '',
  context jsonb,
  join_code text not null unique default public.generate_join_code(),
  created_at timestamptz not null default now()
);
create index projects_owner_idx on public.projects (owner_id, created_at desc);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

-- Owner is always a member.
create function public.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_project_created
  after insert on public.projects
  for each row execute function public.add_owner_membership();

-- security definer so policies can call it without recursing through project_members RLS.
create function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid()
  );
$$;

-- Join a project by its code (GR-01). Returns the project id, or null if the code is unknown.
create function public.join_project(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select id into v_project_id from public.projects where join_code = upper(trim(p_code));
  if v_project_id is null then
    return null;
  end if;
  insert into public.project_members (project_id, user_id, role)
  values (v_project_id, auth.uid(), 'member')
  on conflict do nothing;
  return v_project_id;
end;
$$;

-- ── documents (uploaded briefs) ─────────────────────────────────────────
create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null,
  filename text not null,
  extracted_text text,
  created_at timestamptz not null default now()
);
create index project_documents_project_idx on public.project_documents (project_id);

-- ── papers cache ─────────────────────────────────────────────────────────
-- `id` is the internal paper id (Paper.id) that LLM output refers to.
create table public.papers (
  id text primary key default gen_random_uuid()::text,
  source text not null check (source in ('openalex', 'semanticscholar')),
  external_id text not null,
  doi text,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);
create index papers_doi_idx on public.papers (lower(doi)) where doi is not null;

-- ── analyses & swipes ────────────────────────────────────────────────────
create table public.paper_analyses (
  project_id uuid not null references public.projects (id) on delete cascade,
  paper_id text not null references public.papers (id) on delete cascade,
  analysis jsonb not null,
  credibility jsonb,
  created_at timestamptz not null default now(),
  primary key (project_id, paper_id)
);

create table public.swipes (
  project_id uuid not null references public.projects (id) on delete cascade,
  paper_id text not null references public.papers (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  decision text not null check (decision in ('save', 'skip')),
  created_at timestamptz not null default now(),
  primary key (project_id, paper_id, user_id)
);
create index swipes_project_idx on public.swipes (project_id, created_at desc);

-- ── views (security_invoker so RLS of the caller applies) ────────────────
create view public.reading_list
with (security_invoker = true) as
select
  s.project_id,
  s.paper_id,
  count(*) filter (where s.decision = 'save')::int as save_count,
  count(*) filter (where s.decision = 'skip')::int as skip_count,
  max(s.created_at) as last_swiped_at
from public.swipes s
group by s.project_id, s.paper_id
having count(*) filter (where s.decision = 'save') >= 1;

create view public.disagreements
with (security_invoker = true) as
select
  s.project_id,
  s.paper_id,
  count(*) filter (where s.decision = 'save')::int as save_count,
  count(*) filter (where s.decision = 'skip')::int as skip_count
from public.swipes s
group by s.project_id, s.paper_id
having count(*) filter (where s.decision = 'save') >= 1
   and count(*) filter (where s.decision = 'skip') >= 1;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_documents enable row level security;
alter table public.papers enable row level security;
alter table public.paper_analyses enable row level security;
alter table public.swipes enable row level security;

-- profiles: you, plus people you share a project with
create policy "profiles: read self and collaborators" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.project_members mine
      join public.project_members theirs on theirs.project_id = mine.project_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );
create policy "profiles: update self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- projects
create policy "projects: members read" on public.projects
  -- owner_id check lets `insert … returning` see the row before the membership trigger runs
  for select to authenticated using (owner_id = auth.uid() or public.is_project_member(id));
create policy "projects: owner insert" on public.projects
  for insert to authenticated with check (owner_id = auth.uid());
create policy "projects: owner update" on public.projects
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "projects: owner delete" on public.projects
  for delete to authenticated using (owner_id = auth.uid());

-- project_members (joining goes through join_project())
create policy "members: members read" on public.project_members
  for select to authenticated using (public.is_project_member(project_id));
create policy "members: leave or owner removes" on public.project_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

-- project_documents
create policy "documents: members read" on public.project_documents
  for select to authenticated using (public.is_project_member(project_id));
create policy "documents: members insert" on public.project_documents
  for insert to authenticated with check (public.is_project_member(project_id));
create policy "documents: members delete" on public.project_documents
  for delete to authenticated using (public.is_project_member(project_id));

-- papers: shared read-only cache (writes via service role, which bypasses RLS)
create policy "papers: signed-in read" on public.papers
  for select to authenticated using (true);

-- paper_analyses
create policy "analyses: members read" on public.paper_analyses
  for select to authenticated using (public.is_project_member(project_id));
create policy "analyses: members insert" on public.paper_analyses
  for insert to authenticated with check (public.is_project_member(project_id));
create policy "analyses: members update" on public.paper_analyses
  for update to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- swipes: everyone in the project sees all swipes (group mode); you only write your own
create policy "swipes: members read" on public.swipes
  for select to authenticated using (public.is_project_member(project_id));
create policy "swipes: own insert" on public.swipes
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_project_member(project_id));
create policy "swipes: own update" on public.swipes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_project_member(project_id));
create policy "swipes: own delete" on public.swipes
  for delete to authenticated using (user_id = auth.uid());

-- ── grants (public schema functions callable by signed-in users only) ───
revoke execute on function public.join_project(text) from public, anon;
grant execute on function public.join_project(text) to authenticated;
revoke execute on function public.is_project_member(uuid) from public, anon;
grant execute on function public.is_project_member(uuid) to authenticated;

-- ── realtime ────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.swipes;

-- ── storage: private `briefs` bucket, objects stored as <project_id>/<file> ─
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'briefs', 'briefs', false, 10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]
)
on conflict (id) do nothing;

create policy "briefs: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'briefs' and public.is_project_member(((storage.foldername(name))[1])::uuid));
create policy "briefs: members upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'briefs' and public.is_project_member(((storage.foldername(name))[1])::uuid));
create policy "briefs: members delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'briefs' and public.is_project_member(((storage.foldername(name))[1])::uuid));
