-- Linki do wgrywania mediów dla firm zewnętrznych (np. fotograf, agencja, poprzedni wykonawca).
-- Osoba z linkiem widzi tylko bazę mediów jednego klienta i tylko pliki wgrane tym linkiem.
-- Bez konta: wszystko idzie przez funkcję Netlify media-link (klucz serwerowy), więc anon nie ma tu żadnych uprawnień.

create table if not exists public.media_links (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  token      text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  label      text not null,          -- dla kogo, np. nazwa firmy
  expires_at timestamptz,            -- pusta = bez terminu
  revoked_at timestamptz,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists media_links_client_idx on public.media_links(client_id);

alter table public.media_links enable row level security;
drop policy if exists "admin" on public.media_links;
create policy "admin" on public.media_links for all to authenticated
  using ((select public.is_admin()) and (select public.can_access_client(client_id)))
  with check ((select public.is_admin()) and (select public.can_access_client(client_id)));

-- z którego linku przyszedł plik (po usunięciu linku plik zostaje w bazie mediów)
alter table public.client_files add column if not exists media_link_id uuid references public.media_links(id) on delete set null;
create index if not exists client_files_media_link_idx on public.client_files(media_link_id) where media_link_id is not null;

-- filmy z salonów są duże: limit pliku w buckecie 5 GB (plan Pro; limit globalny ustawia się w Storage > Settings)
update storage.buckets set file_size_limit = 5368709120 where id = 'client-files';
