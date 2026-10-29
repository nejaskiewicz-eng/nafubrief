-- Foldery w bazie mediów (np. jeden na salon). Lista folderów jest przy kliencie (ustawia administratorka),
-- plik ma swój folder niezależnie od kategorii.

alter table public.clients add column if not exists media_folders text[] not null default '{}';
alter table public.client_files add column if not exists folder text;
create index if not exists client_files_folder_idx on public.client_files(client_id, folder) where kind = 'media';
