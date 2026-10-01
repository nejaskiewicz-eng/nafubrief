-- Zadanie z działaniem: wgranie dokumentu do sprawy (przycisk „Wgraj”) albo wypełnienie ankiety (przycisk „Wypełnij ankietę”).
alter table public.client_tasks add column if not exists upload boolean not null default false;
alter table public.client_tasks add column if not exists brief_id uuid references public.briefs(id) on delete set null;
