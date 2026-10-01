-- Sprawy bieżące: osobne tematy prowadzone z klientem od założenia do akceptacji i zamknięcia.
-- Do sprawy podpinamy ankiety, dokumenty, zadania i dostępy (kolumna case_id) i prowadzimy w niej rozmowę.
-- Sprawę zakłada administratorka albo klient. Zamknięcie: podsumowanie, akceptacja klienta, zamknięcie.

create table if not exists public.cases (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'open' check (status in ('open', 'review', 'closed')),
  created_by  text not null default 'admin' check (created_by in ('admin', 'client')),
  author_id   uuid not null default auth.uid(),
  due_date    date,
  summary     text,
  accepted_at timestamptz,
  accepted_by uuid,
  closed_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists cases_client_idx on public.cases(client_id, status);

alter table public.briefs           add column if not exists case_id uuid references public.cases(id) on delete set null;
alter table public.client_documents add column if not exists case_id uuid references public.cases(id) on delete set null;
alter table public.client_tasks     add column if not exists case_id uuid references public.cases(id) on delete set null;
alter table public.access_items     add column if not exists case_id uuid references public.cases(id) on delete set null;
create index if not exists briefs_case_idx on public.briefs(case_id);
create index if not exists client_documents_case_idx on public.client_documents(case_id);
create index if not exists client_tasks_case_idx on public.client_tasks(case_id);
create index if not exists access_items_case_idx on public.access_items(case_id);

-- rozmowa w sprawie ---------------------------------------------------------
create table if not exists public.case_messages (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references public.cases(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  author_id  uuid not null default auth.uid(),
  from_admin boolean not null default false,
  body       text not null,
  file_id    uuid references public.client_files(id) on delete set null,
  edited_at  timestamptz,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists case_messages_case_idx on public.case_messages(case_id, created_at);

create or replace function public.case_messages_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.body is distinct from old.body then new.edited_at := now(); end if;
  return new;
end $$;
drop trigger if exists case_messages_touch on public.case_messages;
create trigger case_messages_touch before update on public.case_messages
  for each row execute function public.case_messages_touch();

-- RLS -------------------------------------------------------------------------
alter table public.cases         enable row level security;
alter table public.case_messages enable row level security;

drop policy if exists "read" on public.cases;
create policy "read" on public.cases for select to authenticated
  using ((select public.can_access_client(client_id)));
drop policy if exists "admin write" on public.cases;
create policy "admin write" on public.cases for all to authenticated
  using ((select public.is_admin()) and (select public.can_access_client(client_id)))
  with check ((select public.is_admin()) and (select public.can_access_client(client_id)));
-- klient zakłada sprawy i edytuje lub usuwa własne, dopóki są otwarte
drop policy if exists "client own" on public.cases;
create policy "client own" on public.cases for all to authenticated
  using ((select public.can_access_client(client_id)) and created_by = 'client' and author_id = (select auth.uid()) and status = 'open')
  with check ((select public.can_access_client(client_id)) and created_by = 'client' and author_id = (select auth.uid()) and status = 'open'
              and accepted_at is null and closed_at is null);

drop policy if exists "read" on public.case_messages;
create policy "read" on public.case_messages for select to authenticated
  using ((select public.can_access_client(client_id)));
drop policy if exists "write" on public.case_messages;
create policy "write" on public.case_messages for insert to authenticated
  with check ((select public.can_access_client(client_id)) and author_id = (select auth.uid())
              and from_admin = (select public.is_admin())
              and exists (select 1 from public.cases c where c.id = case_id and c.client_id = case_messages.client_id));
-- każdy edytuje i usuwa tylko swoje wiadomości
drop policy if exists "edit own" on public.case_messages;
create policy "edit own" on public.case_messages for update to authenticated
  using ((select public.can_access_client(client_id)) and author_id = (select auth.uid()))
  with check ((select public.can_access_client(client_id)) and author_id = (select auth.uid()));
drop policy if exists "delete own" on public.case_messages;
create policy "delete own" on public.case_messages for delete to authenticated
  using ((select public.can_access_client(client_id)) and (author_id = (select auth.uid()) or (select public.is_admin())));

-- decyzje w sprawie przez funkcje -----------------------------------------------
create or replace function public.accept_case(p_case uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.cases c set status = 'closed', accepted_at = now(), accepted_by = (select auth.uid()),
    closed_at = now(), updated_at = now()
  where c.id = p_case and c.status = 'review' and public.can_access_client(c.client_id);
  if not found then raise exception 'not_found'; end if;
end $$;

create or replace function public.return_case(p_case uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.cases;
begin
  update public.cases x set status = 'open', updated_at = now()
  where x.id = p_case and x.status = 'review' and public.can_access_client(x.client_id)
  returning * into c;
  if not found then raise exception 'not_found'; end if;
  if coalesce(trim(p_reason), '') <> '' then
    insert into public.case_messages (case_id, client_id, author_id, from_admin, body)
    values (c.id, c.client_id, (select auth.uid()), public.is_admin(), 'Do poprawy przed akceptacją: ' || trim(p_reason));
  end if;
end $$;

create or replace function public.mark_case_read(p_case uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.case_messages m set read_at = now()
  where m.case_id = p_case and m.read_at is null and m.from_admin <> public.is_admin()
    and public.can_access_client(m.client_id);
end $$;

revoke all on function public.accept_case(uuid) from public, anon;
revoke all on function public.return_case(uuid, text) from public, anon;
revoke all on function public.mark_case_read(uuid) from public, anon;
grant execute on function public.accept_case(uuid) to authenticated;
grant execute on function public.return_case(uuid, text) to authenticated;
grant execute on function public.mark_case_read(uuid) to authenticated;

-- klient dodaje dostęp do sprawy (np. gdy go udziela), ale nie przenosi cudzych pozycji
-- (polityka "client access" z 010 już pozwala mu na pełną obsługę listy dostępów)

-- adres zakładki „sprawy” nie może być nazwą ankiety
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
  if base in ('profil', 'media', 'zespol', 'uslugi', 'wiadomosci', 'haslo', 'podglad', 'dostepy', 'dokumenty', 'start', 'sprawy') then
    base := 'ankieta-' || base;
  end if;
  candidate := base;
  while exists (select 1 from public.briefs where client_id = new.client_id and slug = candidate and id <> new.id) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end $$;
