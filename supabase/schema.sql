-- ============================================================================
-- HACKATHON COMMAND CENTER — Supabase Schema (Phase 2) — CORRECTED / HARDENED
-- Founded by Sai Karthik
--
-- Safe to run on a FRESH project OR re-run on an EXISTING project:
--   * no tables are dropped, no data is deleted, RLS is never disabled
--   * objects are created only if missing; policies/triggers are re-installed
-- Order is dependency-safe: user_prefs and team_timers exist BEFORE the
-- triggers that write to them are installed.
--
-- MANUAL (non-SQL) configuration — do these in the Supabase Dashboard:
--   1. Auth: enable Email provider (and set Site URL / redirect URLs).
--   2. Storage: buckets are created below via SQL; if your role cannot write
--      storage.buckets, create 'team-files' (private, 50MB), 'dm-files'
--      (private, 50MB) and 'avatars' (public, 5MB) in the Dashboard instead.
--   3. Realtime: the publication block below adds tables if the
--      'supabase_realtime' publication exists; verify in Database → Replication.
--   4. Edge Function 'mentor-reply' (service role) inserts mentor_messages
--      rows with role = 'ai'. Client RLS deliberately blocks 'ai' inserts.
--   5. This file has NOT been executed against any project by the assistant.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. ENUMS (create only if missing)
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'team_role' and n.nspname = 'public') then
    create type public.team_role as enum ('owner','admin','member');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'invite_status' and n.nspname = 'public') then
    create type public.invite_status as enum ('active','revoked');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'attachment_kind' and n.nspname = 'public') then
    create type public.attachment_kind as enum ('image','video','doc','code');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'task_priority' and n.nspname = 'public') then
    create type public.task_priority as enum ('low','medium','high','critical');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'milestone_status' and n.nspname = 'public') then
    create type public.milestone_status as enum ('todo','active','done');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'milestone_priority' and n.nspname = 'public') then
    create type public.milestone_priority as enum ('low','medium','high');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'timer_status' and n.nspname = 'public') then
    create type public.timer_status as enum ('idle','running','paused','done');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'mentor_role' and n.nspname = 'public') then
    create type public.mentor_role as enum ('user','ai');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. TABLES (dependency-safe order; additive 'if not exists' everywhere)
-- ---------------------------------------------------------------------------

-- 2.1 profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  avatar_url  text,
  color       text not null default '#22d3ee',
  bio         text not null default '' check (char_length(bio) <= 280),
  skill_tags  text[] not null default '{}' check (cardinality(skill_tags) <= 10),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists skill_tags text[] not null default '{}';

-- 2.2 user_prefs  (MUST exist before handle_new_user trigger)
create table if not exists public.user_prefs (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  theme         text not null default 'dark' check (theme in ('dark','light')),
  sound         boolean not null default true,
  notifications boolean not null default false,
  mentions      boolean not null default true,
  email_digest  boolean not null default true,
  updated_at    timestamptz not null default now()
);

-- 2.3 teams
create table if not exists public.teams (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 2 and 80),
  description       text not null default '',
  hackathon         text not null default '',
  problem_statement text not null default '',
  emoji             text not null default '🚀',
  color             text not null default '#8b5cf6',
  logo_url          text,
  capacity          int  not null default 6 check (capacity between 1 and 12),
  created_by        uuid not null references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 2.4 team_timers  (MUST exist before handle_new_team trigger)
create table if not exists public.team_timers (
  team_id      uuid primary key references public.teams (id) on delete cascade,
  label        text not null default 'Final Submission',
  status       public.timer_status not null default 'idle',
  deadline_at  timestamptz,
  remaining_ms bigint check (remaining_ms is null or remaining_ms >= 0),
  duration_ms  bigint not null default 129600000 check (duration_ms > 0),
  updated_by   uuid references public.profiles (id),
  updated_at   timestamptz not null default now()
);

-- 2.5 team_members
create table if not exists public.team_members (
  team_id   uuid not null references public.teams (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      public.team_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- 2.6 invitations
create table if not exists public.invitations (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  token      text not null unique default encode(gen_random_bytes(16), 'hex'),
  status     public.invite_status not null default 'active',
  expires_at timestamptz not null default now() + interval '48 hours',
  max_uses   int not null default 10 check (max_uses between 1 and 50),
  use_count  int not null default 0 check (use_count >= 0),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- 2.7 team chat
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null default '' check (char_length(body) <= 8000),
  reply_to   uuid references public.messages (id) on delete set null,
  edited     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.messages (id) on delete cascade,
  team_id      uuid not null references public.teams (id) on delete cascade,
  kind         public.attachment_kind not null,
  file_name    text not null check (char_length(file_name) between 1 and 255),
  size_bytes   bigint not null default 0 check (size_bytes between 0 and 52428800),
  mime_type    text not null default 'application/octet-stream',
  storage_path text not null,
  created_at   timestamptz not null default now()
);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.team_reads (
  team_id      uuid not null references public.teams (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- 2.8 direct messages
create table if not exists public.dm_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references public.profiles (id) on delete cascade,
  user_b     uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table if not exists public.dm_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null default '' check (char_length(body) <= 8000),
  reply_to        uuid references public.dm_messages (id) on delete set null,
  edited          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.dm_attachments (
  id              uuid primary key default gen_random_uuid(),
  dm_message_id   uuid not null references public.dm_messages (id) on delete cascade,
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  kind            public.attachment_kind not null,
  file_name       text not null check (char_length(file_name) between 1 and 255),
  size_bytes      bigint not null default 0 check (size_bytes between 0 and 52428800),
  mime_type       text not null default 'application/octet-stream',
  storage_path    text not null,
  created_at      timestamptz not null default now()
);

create table if not exists public.dm_reactions (
  dm_message_id uuid not null references public.dm_messages (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  emoji         text not null check (char_length(emoji) between 1 and 16),
  created_at    timestamptz not null default now(),
  primary key (dm_message_id, user_id, emoji)
);

create table if not exists public.dm_reads (
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- 2.9 roadmap
create table if not exists public.milestones (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  due_label   text not null default 'TBD',
  due_at      timestamptz,
  status      public.milestone_status   not null default 'todo',
  priority    public.milestone_priority not null default 'medium',
  depends_on  uuid references public.milestones (id) on delete set null,
  acceptance  jsonb not null default '[]'::jsonb check (jsonb_typeof(acceptance) = 'array'),
  position    int not null default 0,
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  title        text not null check (char_length(title) between 1 and 200),
  priority     public.task_priority not null default 'medium',
  done         boolean not null default false,
  assignee_id  uuid references public.profiles (id) on delete set null,
  created_by   uuid not null references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2.10 mentor
create table if not exists public.mentor_messages (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  role       public.mentor_role not null,
  body       text not null check (char_length(body) between 1 and 16000),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. INDEXES (if not exists)
-- ---------------------------------------------------------------------------
create index if not exists idx_profiles_skill_tags  on public.profiles using gin (skill_tags);
create index if not exists idx_team_members_user    on public.team_members (user_id);
create index if not exists idx_invitations_team     on public.invitations (team_id);
create index if not exists idx_invitations_token    on public.invitations (token);
create index if not exists idx_messages_team_time   on public.messages (team_id, created_at desc);
create index if not exists idx_attachments_team     on public.attachments (team_id, created_at desc);
create index if not exists idx_attachments_message  on public.attachments (message_id);
create index if not exists idx_dm_conv_a            on public.dm_conversations (user_a);
create index if not exists idx_dm_conv_b            on public.dm_conversations (user_b);
create index if not exists idx_dm_messages_conv     on public.dm_messages (conversation_id, created_at desc);
create index if not exists idx_dm_attachments_conv  on public.dm_attachments (conversation_id, created_at desc);
create index if not exists idx_dm_attachments_msg   on public.dm_attachments (dm_message_id);
create index if not exists idx_milestones_team      on public.milestones (team_id, position);
create index if not exists idx_tasks_team           on public.tasks (team_id, done, priority);
create index if not exists idx_mentor_team_time     on public.mentor_messages (team_id, created_at);

-- ---------------------------------------------------------------------------
-- 4. HELPER / UTILITY FUNCTIONS (all with pinned search_path)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_team_member(_team uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from team_members
    where team_id = _team and user_id = auth.uid()
  );
$$;

create or replace function public.team_role_of(_team uuid)
returns public.team_role
language sql stable security definer
set search_path = public, pg_temp
as $$
  select role from team_members
  where team_id = _team and user_id = auth.uid();
$$;

create or replace function public.is_team_admin(_team uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.team_role_of(_team) in ('owner','admin'), false);
$$;

create or replace function public.is_team_owner(_team uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.team_role_of(_team) = 'owner', false);
$$;

create or replace function public.shares_team_with(_other uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from team_members a
    join team_members b on a.team_id = b.team_id
    where a.user_id = auth.uid() and b.user_id = _other
  );
$$;

create or replace function public.is_dm_participant(_conv uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from dm_conversations
    where id = _conv and auth.uid() in (user_a, user_b)
  );
$$;

-- storage path helpers: validate '<uuid>/<uuid>/<filename>' (3 segments)
create or replace function public.storage_path_root(_name text)
returns uuid
language sql immutable
set search_path = public, pg_temp
as $$
  select case
    when split_part(_name, '/', 1)
         ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then split_part(_name, '/', 1)::uuid
    else null
  end;
$$;

create or replace function public.storage_path_valid(_name text)
returns boolean
language sql immutable
set search_path = public, pg_temp
as $$
  select array_length(string_to_array(_name, '/'), 1) = 3
     and split_part(_name, '/', 1)
         ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     and split_part(_name, '/', 2)
         ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     and char_length(split_part(_name, '/', 3)) between 1 and 255;
$$;

-- ---------------------------------------------------------------------------
-- 5. PROTECTED-FIELD & CONSISTENCY TRIGGER FUNCTIONS
-- ---------------------------------------------------------------------------
-- messages: author_id / team_id / created_at are immutable
create or replace function public.protect_message_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.author_id is distinct from old.author_id
     or new.team_id is distinct from old.team_id
     or new.created_at is distinct from old.created_at then
    raise exception 'PROTECTED_FIELD_CHANGE';
  end if;
  return new;
end;
$$;

-- dm_messages: sender_id / conversation_id / created_at are immutable
create or replace function public.protect_dm_message_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.sender_id is distinct from old.sender_id
     or new.conversation_id is distinct from old.conversation_id
     or new.created_at is distinct from old.created_at then
    raise exception 'PROTECTED_FIELD_CHANGE';
  end if;
  return new;
end;
$$;

-- invitations: team/token/creator immutable; use_count only +1 at a time
create or replace function public.protect_invitation_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.team_id is distinct from old.team_id
     or new.token is distinct from old.token
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'PROTECTED_FIELD_CHANGE';
  end if;
  if new.use_count not in (old.use_count, old.use_count + 1) then
    raise exception 'INVALID_USE_COUNT';
  end if;
  return new;
end;
$$;

-- team_members: identity immutable; 'owner' role can never be granted or
-- removed via UPDATE (owner rows are created only by handle_new_team)
create or replace function public.protect_membership_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.team_id is distinct from old.team_id
     or new.user_id is distinct from old.user_id then
    raise exception 'PROTECTED_FIELD_CHANGE';
  end if;
  if old.role = 'owner' or new.role = 'owner' then
    raise exception 'OWNER_ROLE_IMMUTABLE';
  end if;
  return new;
end;
$$;

-- milestones: depends_on must reference a milestone of the same team
create or replace function public.validate_milestone_dependency()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.depends_on is not null then
    if new.depends_on = new.id then
      raise exception 'SELF_DEPENDENCY';
    end if;
    if not exists (select 1 from milestones
                   where id = new.depends_on and team_id = new.team_id) then
      raise exception 'DEPENDENCY_WRONG_TEAM';
    end if;
  end if;
  return new;
end;
$$;

-- tasks: milestone_id must belong to the same team
create or replace function public.validate_task_milestone()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.milestone_id is not null then
    if not exists (select 1 from milestones
                   where id = new.milestone_id and team_id = new.team_id) then
      raise exception 'MILESTONE_WRONG_TEAM';
    end if;
  end if;
  return new;
end;
$$;

-- profiles: normalize + validate skill tags
create or replace function public.normalize_skill_tags()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  cleaned text[] := '{}';
  t text;
  norm text;
begin
  if new.skill_tags is not null then
    foreach t in array new.skill_tags loop
      norm := lower(btrim(t));
      norm := regexp_replace(norm, '[^a-z0-9+\- ]', '', 'g');
      norm := regexp_replace(norm, '\s+', ' ', 'g');
      if char_length(norm) between 2 and 24 and not (norm = any (cleaned)) then
        cleaned := array_append(cleaned, norm);
      end if;
    end loop;
  end if;
  if cardinality(cleaned) > 10 then
    cleaned := cleaned[1:10];
  end if;
  new.skill_tags := cleaned;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. SIGNUP / TEAM-CREATION TRIGGER FUNCTIONS
--    (defined AFTER user_prefs and team_timers exist — dependency-safe)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;

  insert into public.user_prefs (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.handle_new_team()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.team_members (team_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (team_id, user_id) do nothing;

  insert into public.team_timers (team_id, label)
  values (new.id, coalesce(nullif(new.hackathon, ''), new.name) || ' — Final Submission')
  on conflict (team_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC FUNCTIONS (invitations + DMs)
-- ---------------------------------------------------------------------------
create or replace function public.preview_invitation(_token text)
returns table (
  team_name    text,
  team_emoji   text,
  team_color   text,
  description  text,
  hackathon    text,
  member_count bigint,
  capacity     int,
  state        text,            -- 'valid' | 'expired' | 'revoked' | 'full'
  expires_at   timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  inv invitations%rowtype;
  t   teams%rowtype;
  cnt bigint;
begin
  select * into inv from invitations where invitations.token = _token;
  if not found then
    return; -- empty result = invalid token
  end if;

  select * into t from teams where id = inv.team_id;
  select count(*) into cnt from team_members where team_id = inv.team_id;

  return query select
    t.name, t.emoji, t.color, t.description, t.hackathon, cnt, t.capacity,
    case
      when inv.status = 'revoked'        then 'revoked'
      when inv.expires_at < now()        then 'expired'
      when inv.use_count >= inv.max_uses then 'expired'
      when cnt >= t.capacity             then 'full'
      else 'valid'
    end,
    inv.expires_at;
end;
$$;

create or replace function public.accept_invitation(_token text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  inv invitations%rowtype;
  cap int;
  cnt bigint;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into inv from invitations
  where invitations.token = _token
  for update;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;
  if inv.status = 'revoked' then
    raise exception 'INVITE_REVOKED';
  end if;
  if inv.expires_at < now() or inv.use_count >= inv.max_uses then
    raise exception 'INVITE_EXPIRED';
  end if;

  if exists (select 1 from team_members
             where team_id = inv.team_id and user_id = auth.uid()) then
    return inv.team_id; -- idempotent
  end if;

  select capacity into cap from teams where id = inv.team_id for update;
  select count(*) into cnt from team_members where team_id = inv.team_id;
  if cnt >= cap then
    raise exception 'TEAM_FULL';
  end if;

  insert into team_members (team_id, user_id, role)
  values (inv.team_id, auth.uid(), 'member');

  update invitations set use_count = use_count + 1 where id = inv.id;

  return inv.team_id;
end;
$$;

create or replace function public.get_or_create_dm(_other uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  a uuid;
  b uuid;
  conv uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if _other is null or _other = auth.uid() then
    raise exception 'INVALID_RECIPIENT';
  end if;
  if not exists (select 1 from profiles where id = _other) then
    raise exception 'USER_NOT_FOUND';
  end if;
  if not public.shares_team_with(_other) then
    raise exception 'NOT_TEAMMATES';
  end if;

  a := least(auth.uid(), _other);
  b := greatest(auth.uid(), _other);

  insert into dm_conversations (user_a, user_b)
  values (a, b)
  on conflict (user_a, user_b) do nothing;

  select id into conv from dm_conversations where user_a = a and user_b = b;
  return conv;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. TRIGGER INSTALLATION (idempotent: drop if exists, then create)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_tags on public.profiles;
create trigger trg_profiles_tags
  before insert or update of skill_tags on public.profiles
  for each row execute function public.normalize_skill_tags();

drop trigger if exists trg_teams_updated on public.teams;
create trigger trg_teams_updated
  before update on public.teams
  for each row execute function public.set_updated_at();

drop trigger if exists trg_team_timers_updated on public.team_timers;
create trigger trg_team_timers_updated
  before update on public.team_timers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_messages_updated on public.messages;
create trigger trg_messages_updated
  before update on public.messages
  for each row execute function public.set_updated_at();

drop trigger if exists trg_messages_protect on public.messages;
create trigger trg_messages_protect
  before update on public.messages
  for each row execute function public.protect_message_fields();

drop trigger if exists trg_dm_messages_updated on public.dm_messages;
create trigger trg_dm_messages_updated
  before update on public.dm_messages
  for each row execute function public.set_updated_at();

drop trigger if exists trg_dm_messages_protect on public.dm_messages;
create trigger trg_dm_messages_protect
  before update on public.dm_messages
  for each row execute function public.protect_dm_message_fields();

drop trigger if exists trg_invitations_protect on public.invitations;
create trigger trg_invitations_protect
  before update on public.invitations
  for each row execute function public.protect_invitation_fields();

drop trigger if exists trg_membership_protect on public.team_members;
create trigger trg_membership_protect
  before update on public.team_members
  for each row execute function public.protect_membership_fields();

drop trigger if exists trg_milestones_updated on public.milestones;
create trigger trg_milestones_updated
  before update on public.milestones
  for each row execute function public.set_updated_at();

drop trigger if exists trg_milestones_dependency on public.milestones;
create trigger trg_milestones_dependency
  before insert or update of depends_on, team_id on public.milestones
  for each row execute function public.validate_milestone_dependency();

drop trigger if exists trg_tasks_updated on public.tasks;
create trigger trg_tasks_updated
  before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_milestone on public.tasks;
create trigger trg_tasks_milestone
  before insert or update of milestone_id, team_id on public.tasks
  for each row execute function public.validate_task_milestone();

drop trigger if exists trg_user_prefs_updated on public.user_prefs;
create trigger trg_user_prefs_updated
  before update on public.user_prefs
  for each row execute function public.set_updated_at();

-- signup trigger (installed last; user_prefs already exists above)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- team-creation trigger (team_timers already exists above)
drop trigger if exists on_team_created on public.teams;
create trigger on_team_created
  after insert on public.teams
  for each row execute function public.handle_new_team();

-- ---------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY — enable + policies (drop/recreate = idempotent)
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.user_prefs        enable row level security;
alter table public.teams             enable row level security;
alter table public.team_timers       enable row level security;
alter table public.team_members      enable row level security;
alter table public.invitations       enable row level security;
alter table public.messages          enable row level security;
alter table public.attachments       enable row level security;
alter table public.message_reactions enable row level security;
alter table public.team_reads        enable row level security;
alter table public.dm_conversations  enable row level security;
alter table public.dm_messages       enable row level security;
alter table public.dm_attachments    enable row level security;
alter table public.dm_reactions      enable row level security;
alter table public.dm_reads          enable row level security;
alter table public.milestones        enable row level security;
alter table public.tasks             enable row level security;
alter table public.mentor_messages   enable row level security;

-- ---------- profiles ----------
drop policy if exists "profiles_select"      on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- teams ----------
drop policy if exists "teams_select_member" on public.teams;
drop policy if exists "teams_insert_auth"   on public.teams;
drop policy if exists "teams_update_admin"  on public.teams;
drop policy if exists "teams_delete_owner"  on public.teams;
create policy "teams_select_member" on public.teams
  for select using (public.is_team_member(id));
create policy "teams_insert_auth" on public.teams
  for insert with check (created_by = auth.uid());
create policy "teams_update_admin" on public.teams
  for update using (public.is_team_admin(id)) with check (public.is_team_admin(id));
create policy "teams_delete_owner" on public.teams
  for delete using (public.is_team_owner(id));

-- ---------- team_members (hardened) ----------
drop policy if exists "members_select_same_team"     on public.team_members;
drop policy if exists "members_update_admin"         on public.team_members;
drop policy if exists "members_delete_self_or_admin" on public.team_members;
create policy "members_select_same_team" on public.team_members
  for select using (public.is_team_member(team_id));
-- admins/owners manage roles ONLY inside their own team, NEVER their own row,
-- NEVER rows holding 'owner', and can NEVER write the 'owner' role
-- (the trg_membership_protect trigger enforces this again at row level)
create policy "members_update_admin" on public.team_members
  for update using (
    public.is_team_admin(team_id)
    and user_id <> auth.uid()
    and role <> 'owner'
  )
  with check (
    public.is_team_admin(team_id)
    and user_id <> auth.uid()
    and role in ('admin','member')
  );
create policy "members_delete_self_or_admin" on public.team_members
  for delete using (
    (user_id = auth.uid() and role <> 'owner')                              -- leave
    or (public.is_team_admin(team_id) and user_id <> auth.uid() and role <> 'owner')  -- remove
  );
-- inserts only via handle_new_team / accept_invitation (security definer)

-- ---------- invitations (validated against authorized team) ----------
drop policy if exists "invites_select_admin" on public.invitations;
drop policy if exists "invites_insert_admin" on public.invitations;
drop policy if exists "invites_update_admin" on public.invitations;
drop policy if exists "invites_delete_admin" on public.invitations;
create policy "invites_select_admin" on public.invitations
  for select using (public.is_team_admin(team_id));
create policy "invites_insert_admin" on public.invitations
  for insert with check (
    public.is_team_admin(team_id)
    and created_by = auth.uid()
    and expires_at > now()
    and use_count = 0
  );
create policy "invites_update_admin" on public.invitations
  for update using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));
  -- team_id/token/created_by immutability + use_count rules enforced by
  -- trg_invitations_protect; expiry/revocation/use-limit checked in RPCs
create policy "invites_delete_admin" on public.invitations
  for delete using (public.is_team_admin(team_id));

-- ---------- messages ----------
drop policy if exists "messages_select_member"       on public.messages;
drop policy if exists "messages_insert_member"       on public.messages;
drop policy if exists "messages_update_own"          on public.messages;
drop policy if exists "messages_delete_own_or_admin" on public.messages;
create policy "messages_select_member" on public.messages
  for select using (public.is_team_member(team_id));
create policy "messages_insert_member" on public.messages
  for insert with check (author_id = auth.uid() and public.is_team_member(team_id));
create policy "messages_update_own" on public.messages
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid() and public.is_team_member(team_id));
  -- author_id/team_id/created_at immutability enforced by trg_messages_protect
create policy "messages_delete_own_or_admin" on public.messages
  for delete using (author_id = auth.uid() or public.is_team_admin(team_id));

-- ---------- attachments (message/team cross-check) ----------
drop policy if exists "attachments_select_member"         on public.attachments;
drop policy if exists "attachments_insert_member"         on public.attachments;
drop policy if exists "attachments_delete_owner_or_admin" on public.attachments;
create policy "attachments_select_member" on public.attachments
  for select using (public.is_team_member(team_id));
create policy "attachments_insert_member" on public.attachments
  for insert with check (
    public.is_team_member(team_id)
    and exists (
      select 1 from public.messages m
      where m.id = attachments.message_id
        and m.team_id = attachments.team_id      -- attachment team == message team
        and m.author_id = auth.uid()             -- only the message author attaches
    )
  );
create policy "attachments_delete_owner_or_admin" on public.attachments
  for delete using (
    public.is_team_admin(team_id)
    or exists (
      select 1 from public.messages m
      where m.id = attachments.message_id
        and m.team_id = attachments.team_id
        and m.author_id = auth.uid()
    )
  );

-- ---------- message reactions ----------
drop policy if exists "reactions_select_member" on public.message_reactions;
drop policy if exists "reactions_insert_self"   on public.message_reactions;
drop policy if exists "reactions_delete_self"   on public.message_reactions;
create policy "reactions_select_member" on public.message_reactions
  for select using (
    exists (select 1 from public.messages m
            where m.id = message_reactions.message_id
              and public.is_team_member(m.team_id))
  );
create policy "reactions_insert_self" on public.message_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.messages m
                where m.id = message_reactions.message_id
                  and public.is_team_member(m.team_id))
  );
create policy "reactions_delete_self" on public.message_reactions
  for delete using (user_id = auth.uid());

-- ---------- team read state ----------
drop policy if exists "reads_select_self" on public.team_reads;
drop policy if exists "reads_insert_self" on public.team_reads;
drop policy if exists "reads_update_self" on public.team_reads;
create policy "reads_select_self" on public.team_reads
  for select using (user_id = auth.uid());
create policy "reads_insert_self" on public.team_reads
  for insert with check (user_id = auth.uid() and public.is_team_member(team_id));
create policy "reads_update_self" on public.team_reads
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- DM conversations ----------
drop policy if exists "dm_conv_select_participant" on public.dm_conversations;
create policy "dm_conv_select_participant" on public.dm_conversations
  for select using (auth.uid() in (user_a, user_b));
-- created only via get_or_create_dm (security definer)

-- ---------- DM messages ----------
drop policy if exists "dm_msg_select_participant" on public.dm_messages;
drop policy if exists "dm_msg_insert_sender"      on public.dm_messages;
drop policy if exists "dm_msg_update_own"         on public.dm_messages;
drop policy if exists "dm_msg_delete_own"         on public.dm_messages;
create policy "dm_msg_select_participant" on public.dm_messages
  for select using (public.is_dm_participant(conversation_id));
create policy "dm_msg_insert_sender" on public.dm_messages
  for insert with check (
    sender_id = auth.uid() and public.is_dm_participant(conversation_id)
  );
create policy "dm_msg_update_own" on public.dm_messages
  for update using (sender_id = auth.uid())
  with check (sender_id = auth.uid());
  -- sender_id/conversation_id/created_at immutability via trg_dm_messages_protect
create policy "dm_msg_delete_own" on public.dm_messages
  for delete using (sender_id = auth.uid());

-- ---------- DM attachments (message/conversation cross-check) ----------
drop policy if exists "dm_att_select_participant" on public.dm_attachments;
drop policy if exists "dm_att_insert_sender"      on public.dm_attachments;
drop policy if exists "dm_att_delete_own"         on public.dm_attachments;
create policy "dm_att_select_participant" on public.dm_attachments
  for select using (public.is_dm_participant(conversation_id));
create policy "dm_att_insert_sender" on public.dm_attachments
  for insert with check (
    public.is_dm_participant(conversation_id)
    and exists (
      select 1 from public.dm_messages dm
      where dm.id = dm_attachments.dm_message_id
        and dm.conversation_id = dm_attachments.conversation_id  -- must match
        and dm.sender_id = auth.uid()                            -- own message
    )
  );
create policy "dm_att_delete_own" on public.dm_attachments
  for delete using (
    exists (select 1 from public.dm_messages dm
            where dm.id = dm_attachments.dm_message_id
              and dm.conversation_id = dm_attachments.conversation_id
              and dm.sender_id = auth.uid())
  );

-- ---------- DM reactions ----------
drop policy if exists "dm_react_select_participant" on public.dm_reactions;
drop policy if exists "dm_react_insert_self"        on public.dm_reactions;
drop policy if exists "dm_react_delete_self"        on public.dm_reactions;
create policy "dm_react_select_participant" on public.dm_reactions
  for select using (
    exists (select 1 from public.dm_messages dm
            where dm.id = dm_reactions.dm_message_id
              and public.is_dm_participant(dm.conversation_id))
  );
create policy "dm_react_insert_self" on public.dm_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.dm_messages dm
                where dm.id = dm_reactions.dm_message_id
                  and public.is_dm_participant(dm.conversation_id))
  );
create policy "dm_react_delete_self" on public.dm_reactions
  for delete using (user_id = auth.uid());

-- ---------- DM read state ----------
drop policy if exists "dm_reads_select_self" on public.dm_reads;
drop policy if exists "dm_reads_insert_self" on public.dm_reads;
drop policy if exists "dm_reads_update_self" on public.dm_reads;
create policy "dm_reads_select_self" on public.dm_reads
  for select using (user_id = auth.uid());
create policy "dm_reads_insert_self" on public.dm_reads
  for insert with check (user_id = auth.uid() and public.is_dm_participant(conversation_id));
create policy "dm_reads_update_self" on public.dm_reads
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- milestones ----------
drop policy if exists "milestones_select_member" on public.milestones;
drop policy if exists "milestones_insert_member" on public.milestones;
drop policy if exists "milestones_update_member" on public.milestones;
drop policy if exists "milestones_delete_member" on public.milestones;
create policy "milestones_select_member" on public.milestones
  for select using (public.is_team_member(team_id));
create policy "milestones_insert_member" on public.milestones
  for insert with check (public.is_team_member(team_id) and created_by = auth.uid());
create policy "milestones_update_member" on public.milestones
  for update using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id));
create policy "milestones_delete_member" on public.milestones
  for delete using (public.is_team_member(team_id));

-- ---------- tasks ----------
drop policy if exists "tasks_select_member" on public.tasks;
drop policy if exists "tasks_insert_member" on public.tasks;
drop policy if exists "tasks_update_member" on public.tasks;
drop policy if exists "tasks_delete_member" on public.tasks;
create policy "tasks_select_member" on public.tasks
  for select using (public.is_team_member(team_id));
create policy "tasks_insert_member" on public.tasks
  for insert with check (public.is_team_member(team_id) and created_by = auth.uid());
create policy "tasks_update_member" on public.tasks
  for update using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id));
create policy "tasks_delete_member" on public.tasks
  for delete using (public.is_team_member(team_id));

-- ---------- mentor ----------
drop policy if exists "mentor_select_member" on public.mentor_messages;
drop policy if exists "mentor_insert_user"   on public.mentor_messages;
create policy "mentor_select_member" on public.mentor_messages
  for select using (public.is_team_member(team_id));
create policy "mentor_insert_user" on public.mentor_messages
  for insert with check (
    role = 'user' and user_id = auth.uid() and public.is_team_member(team_id)
  );
-- 'ai' rows are inserted only by the Edge Function using the service role

-- ---------- team timers ----------
drop policy if exists "timers_select_member" on public.team_timers;
drop policy if exists "timers_update_member" on public.team_timers;
create policy "timers_select_member" on public.team_timers
  for select using (public.is_team_member(team_id));
create policy "timers_update_member" on public.team_timers
  for update using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id));
-- rows are created only by handle_new_team (security definer)

-- ---------- user prefs ----------
drop policy if exists "prefs_select_self" on public.user_prefs;
drop policy if exists "prefs_insert_self" on public.user_prefs;
drop policy if exists "prefs_update_self" on public.user_prefs;
create policy "prefs_select_self" on public.user_prefs
  for select using (user_id = auth.uid());
create policy "prefs_insert_self" on public.user_prefs
  for insert with check (user_id = auth.uid());
create policy "prefs_update_self" on public.user_prefs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 10. STORAGE BUCKETS & POLICIES
--   team-files : '<team_id>/<message_id>/<file_name>'        private
--   dm-files   : '<conversation_id>/<dm_message_id>/<file>'  private
--   avatars    : '<user_id>/<file_name>'                     public read
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('team-files', 'team-files', false, 52428800),
  ('dm-files',   'dm-files',   false, 52428800),
  ('avatars',    'avatars',    true,  5242880)
on conflict (id) do nothing;

-- team-files: path must be '<uuid>/<uuid>/<name>' and uploader must be a member
drop policy if exists "teamfiles_read_member"   on storage.objects;
drop policy if exists "teamfiles_insert_member" on storage.objects;
drop policy if exists "teamfiles_update_member" on storage.objects;
drop policy if exists "teamfiles_delete_member" on storage.objects;
create policy "teamfiles_read_member" on storage.objects
  for select using (
    bucket_id = 'team-files'
    and public.storage_path_valid(name)
    and public.is_team_member(public.storage_path_root(name))
  );
create policy "teamfiles_insert_member" on storage.objects
  for insert with check (
    bucket_id = 'team-files'
    and public.storage_path_valid(name)
    and public.is_team_member(public.storage_path_root(name))
  );
create policy "teamfiles_update_member" on storage.objects
  for update using (
    bucket_id = 'team-files'
    and public.storage_path_valid(name)
    and public.is_team_member(public.storage_path_root(name))
  )
  with check (
    bucket_id = 'team-files'
    and public.storage_path_valid(name)
    and public.is_team_member(public.storage_path_root(name))
  );
create policy "teamfiles_delete_member" on storage.objects
  for delete using (
    bucket_id = 'team-files'
    and public.storage_path_valid(name)
    and public.is_team_member(public.storage_path_root(name))
  );

-- dm-files: path must be '<uuid>/<uuid>/<name>' and user must be a participant
drop policy if exists "dmfiles_read_participant"   on storage.objects;
drop policy if exists "dmfiles_insert_participant" on storage.objects;
drop policy if exists "dmfiles_update_participant" on storage.objects;
drop policy if exists "dmfiles_delete_participant" on storage.objects;
create policy "dmfiles_read_participant" on storage.objects
  for select using (
    bucket_id = 'dm-files'
    and public.storage_path_valid(name)
    and public.is_dm_participant(public.storage_path_root(name))
  );
create policy "dmfiles_insert_participant" on storage.objects
  for insert with check (
    bucket_id = 'dm-files'
    and public.storage_path_valid(name)
    and public.is_dm_participant(public.storage_path_root(name))
  );
create policy "dmfiles_update_participant" on storage.objects
  for update using (
    bucket_id = 'dm-files'
    and public.storage_path_valid(name)
    and public.is_dm_participant(public.storage_path_root(name))
  )
  with check (
    bucket_id = 'dm-files'
    and public.storage_path_valid(name)
    and public.is_dm_participant(public.storage_path_root(name))
  );
create policy "dmfiles_delete_participant" on storage.objects
  for delete using (
    bucket_id = 'dm-files'
    and public.storage_path_valid(name)
    and public.is_dm_participant(public.storage_path_root(name))
  );

-- avatars: public read; only the user writes under their own uuid folder
drop policy if exists "avatars_read_public" on storage.objects;
drop policy if exists "avatars_write_self"  on storage.objects;
drop policy if exists "avatars_update_self" on storage.objects;
drop policy if exists "avatars_delete_self" on storage.objects;
create policy "avatars_read_public" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_write_self" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and split_part(name, '/', 1) = auth.uid()::text
    and array_length(string_to_array(name, '/'), 1) = 2
  );
create policy "avatars_update_self" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );
create policy "avatars_delete_self" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 11. REALTIME (add tables only if not already in the publication)
-- ---------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach tbl in array array[
      'messages','attachments','message_reactions',
      'dm_messages','dm_attachments','dm_reactions',
      'tasks','milestones','team_timers','team_members','mentor_messages'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = tbl
      ) then
        execute format('alter publication supabase_realtime add table public.%I', tbl);
      end if;
    end loop;
  end if;
end $$;

alter table public.messages          replica identity full;
alter table public.message_reactions replica identity full;
alter table public.dm_messages       replica identity full;
alter table public.dm_reactions      replica identity full;
alter table public.tasks             replica identity full;
alter table public.milestones        replica identity full;
alter table public.team_timers       replica identity full;
alter table public.team_members      replica identity full;

-- ---------------------------------------------------------------------------
-- 12. FUNCTION PRIVILEGES (least privilege for SECURITY DEFINER surface)
-- ---------------------------------------------------------------------------
-- RPCs: authenticated only (preview also for anon so invite links render
-- before login)
revoke execute on function public.accept_invitation(text)  from public, anon;
grant  execute on function public.accept_invitation(text)  to authenticated;

revoke execute on function public.get_or_create_dm(uuid)   from public, anon;
grant  execute on function public.get_or_create_dm(uuid)   to authenticated;

revoke execute on function public.preview_invitation(text) from public;
grant  execute on function public.preview_invitation(text) to anon, authenticated;

-- helpers referenced inside RLS policies: callable by request roles
revoke execute on function public.is_team_member(uuid)     from public;
grant  execute on function public.is_team_member(uuid)     to anon, authenticated;
revoke execute on function public.team_role_of(uuid)       from public;
grant  execute on function public.team_role_of(uuid)       to anon, authenticated;
revoke execute on function public.is_team_admin(uuid)      from public;
grant  execute on function public.is_team_admin(uuid)      to anon, authenticated;
revoke execute on function public.is_team_owner(uuid)      from public;
grant  execute on function public.is_team_owner(uuid)      to anon, authenticated;
revoke execute on function public.shares_team_with(uuid)   from public;
grant  execute on function public.shares_team_with(uuid)   to authenticated;
revoke execute on function public.is_dm_participant(uuid)  from public;
grant  execute on function public.is_dm_participant(uuid)  to anon, authenticated;
revoke execute on function public.storage_path_root(text)  from public;
grant  execute on function public.storage_path_root(text)  to anon, authenticated;
revoke execute on function public.storage_path_valid(text) from public;
grant  execute on function public.storage_path_valid(text) to anon, authenticated;

-- trigger-only functions: no direct client execution needed
revoke execute on function public.handle_new_user()               from public, anon, authenticated;
revoke execute on function public.handle_new_team()               from public, anon, authenticated;
revoke execute on function public.set_updated_at()                from public, anon, authenticated;
revoke execute on function public.normalize_skill_tags()          from public, anon, authenticated;
revoke execute on function public.protect_message_fields()        from public, anon, authenticated;
revoke execute on function public.protect_dm_message_fields()     from public, anon, authenticated;
revoke execute on function public.protect_invitation_fields()     from public, anon, authenticated;
revoke execute on function public.protect_membership_fields()     from public, anon, authenticated;
revoke execute on function public.validate_milestone_dependency() from public, anon, authenticated;
revoke execute on function public.validate_task_milestone()       from public, anon, authenticated;

-- ============================================================================
-- 13. TESTING CHECKLIST (run after applying; nothing here executes)
--
--  SIGNUP
--   [ ] Sign up via Auth → a profiles row and a user_prefs row exist.
--   [ ] Update own profile (name, avatar_url, skill_tags) succeeds.
--   [ ] skill_tags like '  FrontEnd!! ' are normalized to 'frontend'.
--   [ ] Updating ANOTHER user's profile fails (RLS).
--
--  TEAM CREATION
--   [ ] Insert into teams → creator becomes owner; team_timers row exists.
--   [ ] Non-member cannot select the team; member can.
--   [ ] Admin can update team; member cannot; only owner can delete.
--
--  INVITATIONS
--   [ ] Admin creates invitation; member cannot.
--   [ ] preview_invitation(token) works while logged out (anon).
--   [ ] accept_invitation adds membership, increments use_count once.
--   [ ] Revoked / expired / max-used / full-team tokens raise the
--       documented errors; accepting twice is idempotent.
--   [ ] Admin cannot change an invite's team_id or token (trigger blocks).
--
--  MEMBERSHIP HARDENING
--   [ ] Admin cannot update their own membership row.
--   [ ] Admin cannot set anyone to 'owner'; cannot touch the owner row.
--   [ ] Admin of team A cannot modify memberships of team B.
--   [ ] Member can delete own row (leave); owner row cannot be deleted.
--
--  GROUP CHAT
--   [ ] Member sends message; non-member insert fails.
--   [ ] Author edits own body; changing author_id/team_id fails (trigger).
--   [ ] Author or admin deletes; other members cannot.
--   [ ] Reactions: add/remove own only. team_reads upsert for self only.
--
--  DIRECT MESSAGES
--   [ ] get_or_create_dm with a teammate returns the same id twice.
--   [ ] get_or_create_dm with a stranger raises NOT_TEAMMATES; with self
--       raises INVALID_RECIPIENT.
--   [ ] Only the two participants can read/write the conversation.
--   [ ] Changing sender_id/conversation_id on update fails (trigger).
--
--  ATTACHMENTS
--   [ ] Attachment insert succeeds only when message exists, belongs to the
--       SAME team as attachment.team_id, and auth user authored it.
--   [ ] DM attachment insert requires dm_message in the SAME conversation
--       authored by auth user.
--   [ ] Storage upload to team-files/dm-files fails for bad paths
--       ('x/y.png', wrong uuid, 2 or 4 segments) and for non-members.
--   [ ] Avatar upload works only under avatars/<own-uid>/file.
--
--  TASKS & MILESTONES
--   [ ] Member CRUD works inside own team; outside team fails.
--   [ ] Task with milestone from a DIFFERENT team fails (trigger).
--   [ ] Milestone depends_on from a different team or itself fails.
--
--  TIMER
--   [ ] team_timers row auto-created with the team; member updates
--       status/deadline_at; non-member blocked.
--
--  AI MENTOR
--   [ ] Member inserts role='user' rows; inserting role='ai' from the
--       client fails; Edge Function (service role) inserts 'ai' rows.
--
--  REALTIME
--   [ ] Subscribed client receives INSERT/UPDATE/DELETE for messages,
--       dm_messages, tasks, milestones, team_timers.
-- ============================================================================
