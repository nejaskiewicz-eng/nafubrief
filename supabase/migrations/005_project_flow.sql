-- Przebieg projektu w strefie klienta:
-- harmonogram, zadania dla klienta, koncept i podgląd strony z akceptacją, dostępy do kont, dokumenty.

-- harmonogram ----------------------------------------------------------------
create table if not exists public.project_steps (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  title      text not null,
  note       text,
  status     text not null default 'todo' check (status in ('todo', 'current', 'done')),
  due_date   date,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists project_steps_client_idx on public.project_steps(client_id);

-- zadania dla klienta (własne, dodawane przez administratorkę) ---------------
create table if not exists public.client_tasks (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  title      text not null,
  note       text,
  due_date   date,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists client_tasks_client_idx on public.client_tasks(client_id);

-- koncept i podgląd strony ------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  kind        text not null check (kind in ('concept', 'page')),
  title       text not null,
  url         text,           -- link do roboczego podglądu podstrony
  file_id     uuid references public.client_files(id) on delete set null,  -- grafika konceptu
  note        text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'changes')),
  decided_at  timestamptz,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists reviews_client_idx on public.reviews(client_id);

create table if not exists public.review_comments (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references public.reviews(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  author_id  uuid not null default auth.uid(),
  from_admin boolean not null default false,
  body       text not null,
  file_id    uuid references public.client_files(id) on delete set null,
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists review_comments_review_idx on public.review_comments(review_id);

-- dostępy do kont --------------------------------------------------------
create table if not exists public.access_items (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  service    text not null,           -- klucz z listy usług w aplikacji
  status     text not null default 'todo' check (status in ('todo', 'done', 'na')),
  note       text,
  updated_at timestamptz not null default now(),
  unique (client_id, service)
);

-- dokumenty -----------------------------------------------------------------
create table if not exists public.client_documents (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  title               text not null,
  note                text,
  file_id             uuid references public.client_files(id) on delete set null,
  requires_acceptance boolean not null default true,
  accepted_at         timestamptz,
  accepted_by         uuid,
  created_at          timestamptz not null default now()
);
create index if not exists client_documents_client_idx on public.client_documents(client_id);

-- pliki: nowe rodzaje ----------------------------------------------------
alter table public.client_files drop constraint if exists client_files_kind_check;
alter table public.client_files add constraint client_files_kind_check
  check (kind in ('media', 'team', 'certificate', 'message', 'concept', 'review', 'document'));

-- RLS -------------------------------------------------------------------------
alter table public.project_steps    enable row level security;
alter table public.client_tasks     enable row level security;
alter table public.reviews          enable row level security;
alter table public.review_comments  enable row level security;
alter table public.access_items     enable row level security;
alter table public.client_documents enable row level security;

-- klient: odczyt wszystkiego swojego; zapis tylko tam, gdzie ma coś do zrobienia
do $$
declare t text;
begin
  foreach t in array array['project_steps', 'client_tasks', 'reviews', 'review_comments', 'access_items', 'client_documents'] loop
    execute format('drop policy if exists "read" on public.%I', t);
    execute format('create policy "read" on public.%I for select to authenticated using ((select public.can_access_client(client_id)))', t);
    execute format('drop policy if exists "admin write" on public.%I', t);
    execute format(
      'create policy "admin write" on public.%I for all to authenticated using ((select public.is_admin()) and (select public.can_access_client(client_id))) with check ((select public.is_admin()) and (select public.can_access_client(client_id)))', t);
  end loop;
end $$;

-- klient może: odhaczać zadania, zmieniać status dostępów, komentować podgląd
drop policy if exists "client tasks" on public.client_tasks;
create policy "client tasks" on public.client_tasks for update to authenticated
  using ((select public.can_access_client(client_id))) with check ((select public.can_access_client(client_id)));

drop policy if exists "client access" on public.access_items;
create policy "client access" on public.access_items for all to authenticated
  using ((select public.can_access_client(client_id))) with check ((select public.can_access_client(client_id)));

drop policy if exists "client comments" on public.review_comments;
create policy "client comments" on public.review_comments for insert to authenticated
  with check ((select public.can_access_client(client_id)) and author_id = (select auth.uid())
              and from_admin = (select public.is_admin()));

-- decyzje klienta (akceptacja podglądu, akceptacja dokumentu) przez funkcje,
-- żeby klient nie mógł zmieniać tytułów, linków itd.
create or replace function public.decide_review(p_review uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('approved', 'changes', 'pending') then raise exception 'invalid_status'; end if;
  update public.reviews r set status = p_status, decided_at = case when p_status = 'pending' then null else now() end
  where r.id = p_review and public.can_access_client(r.client_id);
  if not found then raise exception 'not_found'; end if;
end $$;

create or replace function public.accept_document(p_doc uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.client_documents d set accepted_at = now(), accepted_by = (select auth.uid())
  where d.id = p_doc and d.accepted_at is null and d.requires_acceptance and public.can_access_client(d.client_id);
  if not found then raise exception 'not_found'; end if;
end $$;

revoke all on function public.decide_review(uuid, text) from public, anon;
revoke all on function public.accept_document(uuid) from public, anon;
grant execute on function public.decide_review(uuid, text) to authenticated;
grant execute on function public.accept_document(uuid) to authenticated;
