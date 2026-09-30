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
