-- Etap 0 „Wprowadzenie do projektu” i ankiety przypisane do etapów harmonogramu.

alter table public.briefs add column if not exists step_id uuid references public.project_steps(id) on delete set null;
create index if not exists briefs_step_idx on public.briefs(step_id);

-- domyślne etapy nowych klientów: od etapu 0
create or replace function public.clients_default_steps() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_steps (client_id, title, position, status)
  select new.id, t.title, t.pos, case when t.pos = 0 then 'current' else 'todo' end
  from (values
    ('Wprowadzenie do projektu', 0),
    ('Brief i materiały', 1),
    ('Koncept i key visual', 2),
    ('Projekt strony na roboczym podglądzie', 3),
    ('Treści i poprawki', 4),
    ('Dokumenty prawne', 5),
    ('Publikacja strony', 6)
  ) as t(title, pos);
  return new;
end $$;

-- nowe ankiety bez wskazanego etapu trafiają do etapu „Brief i materiały”
create or replace function public.briefs_default_step() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.step_id is null then
    select s.id into new.step_id from public.project_steps s
    where s.client_id = new.client_id and s.title = 'Brief i materiały'
    order by s.position limit 1;
  end if;
  return new;
end $$;

drop trigger if exists briefs_step on public.briefs;
create trigger briefs_step before insert on public.briefs
  for each row execute function public.briefs_default_step();

-- istniejący klienci: dodaj etap 0 na początku
do $$
declare c record; s0 uuid; was_start boolean;
begin
  for c in select id from public.clients loop
    if exists (select 1 from public.project_steps where client_id = c.id and title = 'Wprowadzenie do projektu') then
      continue;
    end if;
    -- projekt dopiero rusza, jeśli obecny jest pierwszy etap i nic nie jest zakończone
    select not exists (select 1 from public.project_steps where client_id = c.id and status = 'done')
      into was_start;
    update public.project_steps set position = position + 1 where client_id = c.id;
    if was_start then
      update public.project_steps set status = 'todo' where client_id = c.id and status = 'current';
    end if;
    insert into public.project_steps (client_id, title, position, status)
    values (c.id, 'Wprowadzenie do projektu', 0, case when was_start then 'current' else 'done' end)
    returning id into s0;
    -- ankiety bez etapu: prawna do etapu 0, pozostałe do „Brief i materiały”
    update public.briefs b set step_id = case
        when b.template_key = 'legal' then s0
        else (select s.id from public.project_steps s where s.client_id = c.id and s.title = 'Brief i materiały' order by s.position limit 1)
      end
    where b.client_id = c.id and b.step_id is null;
  end loop;
end $$;

-- Dane tylko dla administratorki ---------------------------------------------

-- notatki wewnętrzne do dokumentów w osobnej tabeli (klient nie ma do niej dostępu)
create table if not exists public.document_notes (
  document_id uuid primary key references public.client_documents(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  body        text not null default '',
  updated_at  timestamptz not null default now()
);
alter table public.document_notes enable row level security;
drop policy if exists "admin only" on public.document_notes;
create policy "admin only" on public.document_notes for all to authenticated
  using ((select public.is_admin()) and (select public.can_access_client(client_id)))
  with check ((select public.is_admin()) and (select public.can_access_client(client_id)));

-- klient nie czyta tabeli klientów bezpośrednio (są tam notatki administratorki),
-- tylko bezpieczne pola przez funkcję
drop policy if exists "client reads own" on public.clients;

create or replace function public.my_client() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object('id', c.id, 'name', c.name, 'company', c.company, 'slug', c.slug, 'login_email', c.login_email)
  from public.clients c where c.user_id = (select auth.uid()) limit 1
$$;
revoke all on function public.my_client() from public, anon;
grant execute on function public.my_client() to authenticated;

-- ankiety klienta: warunek przez funkcję (klient nie czyta już tabeli klientów bezpośrednio)
drop policy if exists "client reads own" on public.briefs;
create policy "client reads own" on public.briefs for select to authenticated
  using (status <> 'draft' and (select public.can_access_client(client_id)));
