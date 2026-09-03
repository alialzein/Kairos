-- Phase 0 / task 0.4 — schema from docs/08-data-model.md §1 (cloud, scrubbed data only)
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- profiles: mirrors owner/guest role; row created by trigger on auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'guest' check (role in ('owner', 'guest')),
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner');
$$;

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('web', 'voice', 'mobile', 'guest')),
  register text not null default 'casual' check (register in ('casual', 'professional')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  summary text,
  summary_embedding vector(1024)
);

create table public.turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  idx int not null,
  role text not null check (role in ('user', 'twin')),
  text text not null,
  lang_mix jsonb,
  reasoner_draft text,
  style_applied boolean not null default false,
  latency jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, idx)
);

create table public.audit_log (
  id bigserial primary key,
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  reason text,
  at timestamptz not null default now()
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions (id) on delete set null,
  text text not null,
  embedding vector(1024),
  importance real not null default 0.5,
  sensitivity text not null default 'low' check (sensitivity in ('low', 'medium', 'high')),
  valid_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  source text,
  audit_id bigint references public.audit_log (id)
);

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  trigger text not null,
  action text not null,
  evidence jsonb,
  confidence real not null default 0.5,
  status text not null default 'active' check (status in ('active', 'superseded', 'rejected')),
  created_at timestamptz not null default now(),
  superseded_by uuid references public.policies (id)
);

create table public.memory_candidates (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null,
  sensitivity text not null default 'low' check (sensitivity in ('low', 'medium', 'high')),
  confidence real not null default 0.5,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'edited')),
  source_turn uuid references public.turns (id) on delete set null,
  decided_by text,
  decided_at timestamptz
);

create table public.persona_proposals (
  id uuid primary key default gen_random_uuid(),
  version_from int not null,
  diff_yaml text not null,
  evidence jsonb,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  turn_id uuid not null references public.turns (id) on delete cascade,
  rating int not null check (rating in (-1, 1)),
  correction text,
  created_at timestamptz not null default now()
);

create table public.style_exemplars (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  embedding vector(1024),
  register text not null check (register in ('casual', 'professional')),
  lang_mix jsonb,
  topics text[] not null default '{}',
  source_ref text,
  active boolean not null default true
);

create table public.eval_items (
  id uuid primary key default gen_random_uuid(),
  axis text not null,
  prompt text not null,
  ali_answer text,
  ali_answer_retest text,
  held_out boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.eval_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  config jsonb not null default '{}'::jsonb,
  fidelity_score real,
  axis_scores jsonb,
  notes text
);

create table public.eval_results (
  run_id uuid not null references public.eval_runs (id) on delete cascade,
  item_id uuid not null references public.eval_items (id) on delete cascade,
  twin_answer text,
  score real,
  judge jsonb,
  primary key (run_id, item_id)
);

create table public.training_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  base_model text,
  dataset_hash text,
  config jsonb,
  metrics jsonb,
  adapter_path text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'queued'
);

create table public.provider_health (
  provider text primary key,
  healthy boolean not null default true,
  last_check timestamptz not null default now(),
  note text
);

-- indexes (docs/08 §1)
create index sessions_summary_embedding_idx on public.sessions using hnsw (summary_embedding vector_cosine_ops);
create index episodes_embedding_idx on public.episodes using hnsw (embedding vector_cosine_ops);
create index style_exemplars_embedding_idx on public.style_exemplars using hnsw (embedding vector_cosine_ops);
create index turns_session_idx on public.turns (session_id, idx);
create index memory_candidates_status_idx on public.memory_candidates (status);
create index audit_log_at_idx on public.audit_log (at);

-- RLS: owner sees everything; guests only their own sessions/turns/feedback; no guest access to memory tables
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.turns enable row level security;
alter table public.feedback enable row level security;

create policy "profiles: self or owner" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_owner());

create policy "sessions: owner all" on public.sessions
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "sessions: guest own" on public.sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "turns: owner all" on public.turns
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "turns: guest own" on public.turns
  for all to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()));

create policy "feedback: owner all" on public.feedback
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "feedback: guest own" on public.feedback
  for all to authenticated
  using (exists (select 1 from public.turns t join public.sessions s on s.id = t.session_id
                 where t.id = turn_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.turns t join public.sessions s on s.id = t.session_id
                      where t.id = turn_id and s.user_id = auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['episodes', 'policies', 'memory_candidates', 'persona_proposals',
                           'style_exemplars', 'audit_log', 'eval_items', 'eval_runs', 'eval_results',
                           'training_runs', 'provider_health'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: owner only" on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())', t, t);
  end loop;
end $$;
