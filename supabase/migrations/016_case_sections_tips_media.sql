-- Sprawy: wybór sekcji widocznych w sprawie, zalecenia i porady, zdjęcia i wideo przypięte do sprawy.

-- sekcje sprawy (kolejność w panelu jest stała, tu tylko włączone)
alter table public.cases add column if not exists sections text[] not null
  default array['tasks', 'briefs', 'documents', 'access', 'chat', 'closing'];

-- zalecenia i porady ----------------------------------------------------------
create table if not exists public.case_tips (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references public.cases(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  title      text not null,
  body       text,
  done_at    timestamptz,
  position   int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists case_tips_case_idx on public.case_tips(case_id, position);
alter table public.case_tips enable row level security;

drop policy if exists "read" on public.case_tips;
create policy "read" on public.case_tips for select to authenticated
  using ((select public.can_access_client(client_id)));
drop policy if exists "admin write" on public.case_tips;
create policy "admin write" on public.case_tips for all to authenticated
  using ((select public.is_admin()) and (select public.can_access_client(client_id)))
  with check ((select public.is_admin()) and (select public.can_access_client(client_id))
              and exists (select 1 from public.cases c where c.id = case_id and c.client_id = case_tips.client_id));

-- klient odhacza zalecenie jako wykonane (tylko to pole)
create or replace function public.toggle_case_tip(p_tip uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.case_tips t set done_at = case when t.done_at is null then now() else null end, updated_at = now()
  where t.id = p_tip and public.can_access_client(t.client_id);
  if not found then raise exception 'not_found'; end if;
end $$;
revoke all on function public.toggle_case_tip(uuid) from public, anon;
grant execute on function public.toggle_case_tip(uuid) to authenticated;

-- zdjęcia i wideo w sprawie (pliki klienta z przypisaną sprawą) -------------------
alter table public.client_files add column if not exists case_id uuid references public.cases(id) on delete set null;
create index if not exists client_files_case_idx on public.client_files(case_id);
alter table public.client_files drop constraint if exists client_files_kind_check;
alter table public.client_files add constraint client_files_kind_check
  check (kind in ('media', 'team', 'certificate', 'message', 'concept', 'review', 'document', 'case'));
