-- NAFU Brief — schemat bazy
-- Uruchom w Supabase: SQL Editor → wklej całość → Run

create extension if not exists pgcrypto;

-- Klienci ---------------------------------------------------------------
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null,
  company       text,
  email         text,
  phone         text,
  website       text,
  industry      text,
  notes         text,
  portal_token  uuid not null unique default gen_random_uuid(),
  created_at    timestamptz not null default now()
);

-- Ankiety przypisane do klienta (kopia szablonu, edytowalna) -------------
create table if not exists public.briefs (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  template_key  text not null,
  title         text not null,
  description   text,
  intro         text,
  schema        jsonb not null,
  answers       jsonb not null default '{}'::jsonb,
  status        text not null default 'draft'
                check (status in ('draft', 'sent', 'in_progress', 'submitted')),
  token         uuid not null unique default gen_random_uuid(),
  position      int not null default 0,
  opened_at     timestamptz,
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists briefs_client_idx on public.briefs(client_id);

-- Podsumowania AI ------------------------------------------------------
create table if not exists public.summaries (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'done', 'error')),
  content     text,
  error       text,
  model       text,
  created_at  timestamptz not null default now()
);
create index if not exists summaries_client_idx on public.summaries(client_id);

-- RLS: zalogowana właścicielka widzi tylko swoje dane ------------------
alter table public.clients   enable row level security;
alter table public.briefs    enable row level security;
alter table public.summaries enable row level security;

drop policy if exists "owner all" on public.clients;
create policy "owner all" on public.clients for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "owner all" on public.briefs;
create policy "owner all" on public.briefs for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "owner all" on public.summaries;
create policy "owner all" on public.summaries for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists briefs_touch on public.briefs;
create trigger briefs_touch before update on public.briefs
  for each row execute function public.touch_updated_at();

-- Dostęp klienta przez link (bez logowania) ----------------------------
-- Tabele są niewidoczne dla anonimowych użytkowników; klient dostaje
-- wyłącznie to, co zwracają poniższe funkcje, i tylko po znajomości tokenu.

create or replace function public.get_brief(p_token uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare b public.briefs; c public.clients;
begin
  select * into b from public.briefs where token = p_token;
  if not found then return null; end if;
  select * into c from public.clients where id = b.client_id;
  if b.status = 'draft' then
    return json_build_object('status', 'draft', 'client_name', coalesce(c.company, c.name));
  end if;
  if b.opened_at is null then
    update public.briefs set opened_at = now() where id = b.id;
  end if;
  return json_build_object(
    'status', b.status, 'title', b.title, 'description', b.description, 'intro', b.intro,
    'schema', b.schema, 'answers', b.answers,
    'client_name', coalesce(c.company, c.name), 'submitted_at', b.submitted_at
  );
end $$;

create or replace function public.save_brief(p_token uuid, p_answers jsonb, p_submit boolean default false)
returns json
language plpgsql security definer set search_path = '' as $$
declare b public.briefs;
begin
  select * into b from public.briefs where token = p_token for update;
  if not found then raise exception 'not_found'; end if;
  if b.status = 'draft' then raise exception 'not_ready'; end if;
  if b.status = 'submitted' then raise exception 'already_submitted'; end if;
  if jsonb_typeof(p_answers) <> 'object' or octet_length(p_answers::text) > 800000 then
    raise exception 'invalid_answers';
  end if;
  update public.briefs set
    answers = p_answers,
    status = case when p_submit then 'submitted' else 'in_progress' end,
    submitted_at = case when p_submit then now() else null end
  where id = b.id;
  return json_build_object('ok', true, 'status', case when p_submit then 'submitted' else 'in_progress' end);
end $$;

create or replace function public.get_portal(p_token uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare c public.clients;
begin
  select * into c from public.clients where portal_token = p_token;
  if not found then return null; end if;
  return json_build_object(
    'client_name', coalesce(c.company, c.name),
    'briefs', coalesce((
      select json_agg(json_build_object(
        'title', b.title, 'description', b.description, 'status', b.status,
        'token', b.token, 'template_key', b.template_key
      ) order by b.position, b.created_at)
      from public.briefs b where b.client_id = c.id and b.status <> 'draft'
    ), '[]'::json)
  );
end $$;

revoke all on function public.get_brief(uuid) from public;
revoke all on function public.save_brief(uuid, jsonb, boolean) from public;
revoke all on function public.get_portal(uuid) from public;
grant execute on function public.get_brief(uuid) to anon, authenticated;
grant execute on function public.save_brief(uuid, jsonb, boolean) to anon, authenticated;
grant execute on function public.get_portal(uuid) to anon, authenticated;
