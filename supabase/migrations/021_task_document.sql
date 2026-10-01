-- Zadanie może wskazywać dokument do przeczytania: przy zadaniu pojawia się przycisk „Czytaj”.
alter table public.client_tasks add column if not exists document_id uuid references public.client_documents(id) on delete set null;
