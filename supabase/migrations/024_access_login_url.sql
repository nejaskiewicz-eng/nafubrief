-- Dostępy: adres panelu logowania danego narzędzia (link przy pozycji).
alter table public.access_items add column if not exists login_url text;
