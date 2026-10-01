-- Kategorie dokumentów (pole kind): klient, dodając własny dokument do sprawy, może wybrać kategorię
-- z listy dla klienta. Umowy z pracownią, dokumenty prawne i opracowania dodaje tylko pracownia.

drop policy if exists "client adds to case" on public.client_documents;
create policy "client adds to case" on public.client_documents for insert to authenticated
  with check (
    (select public.can_access_client(client_id)) and not (select public.is_admin())
    and from_admin = false and visible and not requires_acceptance and accepted_at is null
    and content is null and kind in ('other', 'agreement', 'invoice', 'mail', 'evidence')
    and file_id is not null and case_id is not null
    and exists (select 1 from public.cases c
                where c.id = case_id and c.client_id = client_documents.client_id and c.status <> 'closed')
    and exists (select 1 from public.client_files f
                where f.id = file_id and f.client_id = client_documents.client_id)
  );
