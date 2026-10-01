-- Sprawy: kategoria pilności (zwykła, pilna, bardzo pilna), pokazywana w panelu i w e-mailu do klienta.
alter table public.cases add column if not exists priority text not null default 'normal' check (priority in ('normal', 'urgent', 'very_urgent'));
