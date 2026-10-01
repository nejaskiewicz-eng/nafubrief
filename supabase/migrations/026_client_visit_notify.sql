-- Wejście klienta do panelu: czas ostatniej obecności przy kliencie, rozpoznanie nowej wizyty (do powiadomienia e-mail)
-- oraz dziennik aktywności dostępny na żywo (Realtime) zamiast cyklicznego odpytywania.

alter table public.clients add column if not exists seen_at timestamptz;

-- Wywołuje zalogowany klient przy wejściu do panelu. Nowa wizyta = brak aktywności przez ostatnie 30 minut.
create or replace function public.client_panel_visit() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_name text;
  v_seen timestamptz;
begin
  select c.id, coalesce(nullif(c.company, ''), c.name), c.seen_at into v_id, v_name, v_seen
  from public.clients c where c.user_id = (select auth.uid());
  if v_id is null then return null; end if;
  update public.clients set seen_at = now() where id = v_id;
  return jsonb_build_object('client_id', v_id, 'name', v_name, 'new_visit', v_seen is null or v_seen < now() - interval '30 minutes');
end $$;
revoke all on function public.client_panel_visit() from public, anon;
grant execute on function public.client_panel_visit() to authenticated;

-- Sygnał obecności w panelu (bez powiadomienia)
create or replace function public.client_panel_touch() returns void
language sql security definer set search_path = '' as $$
  update public.clients set seen_at = now() where user_id = (select auth.uid());
$$;
revoke all on function public.client_panel_touch() from public, anon;
grant execute on function public.client_panel_touch() to authenticated;

-- sygnał obecności w sprawie odświeża też obecność w panelu
create or replace function public.touch_case(p_case uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then return; end if;
  update public.cases c set client_seen_at = now() where c.id = p_case and public.can_access_client(c.client_id);
  update public.clients set seen_at = now() where user_id = (select auth.uid());
end $$;

-- dziennik aktywności na żywo: administratorka dostaje nowe wpisy bez odpytywania (RLS nadal obowiązuje)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'case_activity') then
    alter publication supabase_realtime add table public.case_activity;
  end if;
end $$;
