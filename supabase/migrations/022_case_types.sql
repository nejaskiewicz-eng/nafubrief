-- Rodzaj sprawy: wybierany przy zakładaniu, ustawia sekcje startowe (szablon). Przy „Inne” własna nazwa w type_label.
alter table public.cases add column if not exists type text;
alter table public.cases add column if not exists type_label text;
