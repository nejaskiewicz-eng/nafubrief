-- Strefa klienta: pilne ankiety, profil firmy, pliki (baza mediów), zespół, usługi, wiadomości.
-- Dostęp: administratorka (właścicielka klienta) i zalogowany klient do swoich danych.

-- pilne ankiety -------------------------------------------------------------
alter table public.briefs add column if not exists urgent boolean not null default false;

-- wspólna reguła dostępu do danych klienta -----------------------------------
create or replace function public.can_access_client(p_client uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clients c
    where c.id = p_client
      and (c.user_id = (select auth.uid())
           or (c.owner_id = (select auth.uid()) and exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))))
  )
$$;
revoke all on function public.can_access_client(uuid) from public, anon;
grant execute on function public.can_access_client(uuid) to authenticated;

-- profil firmy (dane uzupełniane przez klienta) ------------------------------
create table if not exists public.client_profiles (
  client_id  uuid primary key references public.clients(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- pliki: baza mediów, zdjęcia zespołu, certyfikaty, załączniki wiadomości ---
create table if not exists public.client_files (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  kind        text not null default 'media' check (kind in ('media', 'team', 'certificate', 'message')),
  category    text,
  name        text not null,
  path        text,            -- plik w Storage (bucket client-files)
  url         text,            -- albo link zewnętrzny (np. Dysk Google, WeTransfer)
  mime        text,
  size        bigint,
  note        text,
  member_id   uuid,
  uploaded_by uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  check (path is not null or url is not null)
);
create index if not exists client_files_client_idx on public.client_files(client_id, kind);

-- zespół ------------------------------------------------------------------
create table if not exists public.team_members (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  name            text not null,
  role            text,
  photo_path      text,
  bio             text,
  qualifications  text,
  specializations text,
  services        text,
  schedule        jsonb not null default '[]'::jsonb,  -- [{location, days, from, to}]
  position        int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists team_members_client_idx on public.team_members(client_id);

-- usługi ------------------------------------------------------------------
create table if not exists public.services (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  name             text not null,
  category         text,
  description      text,
  duration_min     int,
  price            text,       -- np. „150 zł”, „od 200 zł”, „bezpłatnie”
  locations        jsonb not null default '[]'::jsonb,  -- id salonów z profilu
  show_on_site     boolean not null default true,
  show_in_calendar boolean not null default false,
  position         int not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists services_client_idx on public.services(client_id);

-- wiadomości --------------------------------------------------------------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  author_id  uuid not null default auth.uid(),
  from_admin boolean not null default false,
  body       text not null,
  file_id    uuid references public.client_files(id) on delete set null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_client_idx on public.messages(client_id, created_at);

-- RLS ------------------------------------------------------------------------
alter table public.client_profiles enable row level security;
alter table public.client_files    enable row level security;
alter table public.team_members    enable row level security;
alter table public.services        enable row level security;
alter table public.messages        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['client_profiles', 'client_files', 'team_members', 'services'] loop
    execute format('drop policy if exists "access" on public.%I', t);
    execute format(
      'create policy "access" on public.%I for all to authenticated using ((select public.can_access_client(client_id))) with check ((select public.can_access_client(client_id)))', t);
  end loop;
end $$;

drop policy if exists "read" on public.messages;
create policy "read" on public.messages for select to authenticated
  using ((select public.can_access_client(client_id)));
drop policy if exists "write" on public.messages;
create policy "write" on public.messages for insert to authenticated
  with check ((select public.can_access_client(client_id)) and author_id = (select auth.uid())
              and from_admin = (select public.is_admin()));
drop policy if exists "mark read" on public.messages;
create policy "mark read" on public.messages for update to authenticated
  using ((select public.can_access_client(client_id)))
  with check ((select public.can_access_client(client_id)));

-- Storage: prywatny bucket, ścieżka zaczyna się od id klienta --------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-files', 'client-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "client files access" on storage.objects;
create policy "client files access" on storage.objects for all to authenticated
  using (bucket_id = 'client-files' and (select public.can_access_client(((storage.foldername(name))[1])::uuid)))
  with check (bucket_id = 'client-files' and (select public.can_access_client(((storage.foldername(name))[1])::uuid)));

-- adresy zakładek strefy klienta nie mogą być nazwami ankiet ---------------
create or replace function public.briefs_set_slug() returns trigger
language plpgsql set search_path = '' as $$
declare base text; candidate text; n int := 1;
begin
  if new.slug is not null and new.slug <> '' then return new; end if;
  base := case new.template_key
    when 'strategy' then 'strategia'
    when 'legal' then 'prawny'
    when 'technical' then 'techniczny'
    when 'visual' then 'wizualny'
    else coalesce(nullif(public.slugify(new.title), ''), 'ankieta') end;
  if base in ('profil', 'media', 'zespol', 'uslugi', 'wiadomosci', 'haslo') then base := 'ankieta-' || base; end if;
  candidate := base;
  while exists (select 1 from public.briefs where client_id = new.client_id and slug = candidate and id <> new.id) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end $$;
