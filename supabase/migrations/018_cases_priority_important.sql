-- Sprawy: poziom pilności "Ważne" pomiędzy zwykłą a pilną.
alter table public.cases drop constraint if exists cases_priority_check;
alter table public.cases add constraint cases_priority_check check (priority in ('normal', 'important', 'urgent', 'very_urgent'));
