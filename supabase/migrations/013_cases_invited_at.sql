-- Sprawy: data ostatniego powiadomienia e-mail z prośbą o dołączenie do sprawy.
alter table public.cases add column if not exists invited_at timestamptz;
