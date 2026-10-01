-- Dokumenty i media w sprawie z obu stron: klient może dodać własny dokument do sprawy,
-- a każdy dokument i plik ma oznaczenie, kto go dodał (pracownia czy klient).

alter table public.client_documents add column if not exists from_admin boolean not null default true;
alter table public.client_files     add column if not exists from_admin boolean not null default true;

-- dotychczasowe pliki: po koncie, które je wysłało (dokumenty dodawała dotąd tylko pracownia)
update public.client_files f set from_admin = false
where f.uploaded_by is not null
  and not exists (select 1 from public.app_admins a where a.user_id = f.uploaded_by);

-- oznaczenie ustawia baza, nie przeglądarka: przy dodaniu według zalogowanej osoby, przy zmianie bez zmian
create or replace function public.set_from_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    -- wpis bez zalogowanej osoby (konsola, usługa) traktujemy jak dodany przez pracownię
    new.from_admin := (select auth.uid()) is null or public.is_admin();
  else
    new.from_admin := old.from_admin;
  end if;
  return new;
end $$;
revoke all on function public.set_from_admin() from public, anon, authenticated;

drop trigger if exists set_from_admin on public.client_documents;
create trigger set_from_admin before insert or update on public.client_documents
  for each row execute function public.set_from_admin();
drop trigger if exists set_from_admin on public.client_files;
create trigger set_from_admin before insert or update on public.client_files
  for each row execute function public.set_from_admin();

-- klient dodaje do otwartej sprawy własny dokument: zawsze plik, widoczny, bez akceptacji, nie umowa
drop policy if exists "client adds to case" on public.client_documents;
create policy "client adds to case" on public.client_documents for insert to authenticated
  with check (
    (select public.can_access_client(client_id)) and not (select public.is_admin())
    and from_admin = false and visible and not requires_acceptance and accepted_at is null
    and content is null and kind = 'other' and file_id is not null and case_id is not null
    and exists (select 1 from public.cases c
                where c.id = case_id and c.client_id = client_documents.client_id and c.status <> 'closed')
    and exists (select 1 from public.client_files f
                where f.id = file_id and f.client_id = client_documents.client_id)
  );

-- klient może usunąć tylko to, co sam dodał
drop policy if exists "client deletes own" on public.client_documents;
create policy "client deletes own" on public.client_documents for delete to authenticated
  using ((select public.can_access_client(client_id)) and from_admin = false);
