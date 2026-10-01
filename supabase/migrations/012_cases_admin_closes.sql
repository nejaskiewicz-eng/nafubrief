-- Sprawy: klient tylko akceptuje, zamyka zawsze administratorka (z podsumowaniem dla klienta).
alter table public.cases drop constraint if exists cases_status_check;
alter table public.cases add constraint cases_status_check check (status in ('open', 'review', 'accepted', 'closed'));

create or replace function public.accept_case(p_case uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.cases c set status = 'accepted', accepted_at = now(), accepted_by = (select auth.uid()), updated_at = now()
  where c.id = p_case and c.status = 'review' and public.can_access_client(c.client_id);
  if not found then raise exception 'not_found'; end if;
end $$;
