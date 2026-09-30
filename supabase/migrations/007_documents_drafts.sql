-- Dokumenty: szkice widoczne tylko dla administratorki, treść w Markdown (np. dokumenty prawne z Claude),
-- domyślne etapy harmonogramu, zarezerwowane adresy zakładek strefy klienta.

alter table public.client_documents add column if not exists visible boolean not null default true;
alter table public.client_documents add column if not exists content text;
alter table public.client_documents add column if not exists kind text not null default 'other';
alter table public.client_documents add column if not exists updated_at timestamptz not null default now();

-- klient widzi tylko udostępnione dokumenty
drop policy if exists "read" on public.client_documents;
create policy "read" on public.client_documents for select to authenticated
  using ((select public.can_access_client(client_id)) and (visible or (select public.is_admin())));

create or replace function public.accept_document(p_doc uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.client_documents d set accepted_at = now(), accepted_by = (select auth.uid())
  where d.id = p_doc and d.visible and d.accepted_at is null and d.requires_acceptance and public.can_access_client(d.client_id);
  if not found then raise exception 'not_found'; end if;
end $$;

-- adresy zakładek nie mogą być nazwami ankiet
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
  if base in ('profil', 'media', 'zespol', 'uslugi', 'wiadomosci', 'haslo', 'podglad', 'dostepy', 'dokumenty', 'start') then
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

-- domyślne etapy harmonogramu dla nowych klientów
create or replace function public.clients_default_steps() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_steps (client_id, title, position, status)
  select new.id, t.title, t.pos, case when t.pos = 0 then 'current' else 'todo' end
  from (values
    ('Brief i materiały', 0),
    ('Koncept i key visual', 1),
    ('Projekt strony na roboczym podglądzie', 2),
    ('Treści i poprawki', 3),
    ('Dokumenty prawne', 4),
    ('Publikacja strony', 5)
  ) as t(title, pos);
  return new;
end $$;

drop trigger if exists clients_steps on public.clients;
create trigger clients_steps after insert on public.clients
  for each row execute function public.clients_default_steps();

-- istniejący klienci bez harmonogramu
insert into public.project_steps (client_id, title, position, status)
select c.id, t.title, t.pos, case when t.pos = 0 then 'current' else 'todo' end
from public.clients c
cross join (values
  ('Brief i materiały', 0),
  ('Koncept i key visual', 1),
  ('Projekt strony na roboczym podglądzie', 2),
  ('Treści i poprawki', 3),
  ('Dokumenty prawne', 4),
  ('Publikacja strony', 5)
) as t(title, pos)
where not exists (select 1 from public.project_steps s where s.client_id = c.id);
