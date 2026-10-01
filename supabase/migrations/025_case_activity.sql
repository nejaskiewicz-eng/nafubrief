-- Aktywność klienta w sprawie: dziennik zdarzeń (co otworzył, przeczytał, odhaczył, dodał) i czas ostatniej obecności.
-- Zapis tylko przez funkcję, odczyt tylko dla administratorki.

alter table public.cases add column if not exists client_seen_at timestamptz;

create table if not exists public.case_activity (
  id         bigint generated always as identity primary key,
  case_id    uuid not null references public.cases(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  from_admin boolean not null default false,
  user_id    uuid,
  kind       text not null,
  label      text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists case_activity_case_idx on public.case_activity(case_id, created_at desc);
alter table public.case_activity enable row level security;

drop policy if exists "admin read" on public.case_activity;
create policy "admin read" on public.case_activity for select to authenticated
  using ((select public.is_admin()) and (select public.can_access_client(client_id)));

-- zapis zdarzenia: każdy, kto ma dostęp do klienta tej sprawy; kto zapisał (pracownia czy klient), ustala baza
create or replace function public.log_case_activity(p_case uuid, p_kind text, p_label text default null, p_meta jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_client uuid;
  v_admin boolean;
begin
  select c.client_id into v_client from public.cases c where c.id = p_case;
  if v_client is null or not public.can_access_client(v_client) then return; end if;
  v_admin := public.is_admin();
  insert into public.case_activity (case_id, client_id, from_admin, user_id, kind, label, meta)
  values (p_case, v_client, v_admin, (select auth.uid()), left(coalesce(p_kind, ''), 40), left(p_label, 300),
          case when p_meta is null or pg_column_size(p_meta) > 2000 then '{}'::jsonb else p_meta end);
  if not v_admin then
    update public.cases set client_seen_at = now() where id = p_case;
  end if;
end $$;
revoke all on function public.log_case_activity(uuid, text, text, jsonb) from public, anon;
grant execute on function public.log_case_activity(uuid, text, text, jsonb) to authenticated;

-- sygnał obecności klienta w otwartej sprawie (bez wpisu w dzienniku)
create or replace function public.touch_case(p_case uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then return; end if;
  update public.cases c set client_seen_at = now() where c.id = p_case and public.can_access_client(c.client_id);
end $$;
revoke all on function public.touch_case(uuid) from public, anon;
grant execute on function public.touch_case(uuid) to authenticated;
