-- Sposób komunikacji z klientem: forma zwracania się, zwrot w powitaniu, ton i sposób prowadzenia rozmów.
-- Ustawiane przy zakładaniu klienta; używane w e-mailach z panelu i jako wskazówka do wszystkich tekstów dla klienta.
alter table public.clients add column if not exists address_form text check (address_form in ('ty', 'pani', 'pan', 'panstwo'));
alter table public.clients add column if not exists salutation text;
alter table public.clients add column if not exists tone_notes text;
