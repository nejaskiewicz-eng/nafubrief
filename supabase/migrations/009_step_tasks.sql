-- Zadania w etapach: kolejność, przypisanie (klient / NAFU), widoczność dla klienta.
-- Klient może tylko odhaczać swoje zadania (przez funkcję), całą resztę zmienia administratorka.

alter table public.client_tasks add column if not exists step_id uuid references public.project_steps(id) on delete cascade;
alter table public.client_tasks add column if not exists position int not null default 0;
alter table public.client_tasks add column if not exists assignee text not null default 'client' check (assignee in ('client', 'nafu'));
alter table public.client_tasks add column if not exists visible boolean not null default true;
create index if not exists client_tasks_step_idx on public.client_tasks(step_id);

-- klient widzi tylko zadania udostępnione
drop policy if exists "read" on public.client_tasks;
create policy "read" on public.client_tasks for select to authenticated
  using ((select public.can_access_client(client_id)) and (visible or (select public.is_admin())));

-- klient nie edytuje zadań bezpośrednio
drop policy if exists "client tasks" on public.client_tasks;

create or replace function public.toggle_my_task(p_task uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.client_tasks t set done_at = case when t.done_at is null then now() else null end
  where t.id = p_task and t.visible and t.assignee = 'client' and public.can_access_client(t.client_id);
  if not found then raise exception 'not_found'; end if;
end $$;
revoke all on function public.toggle_my_task(uuid) from public, anon;
grant execute on function public.toggle_my_task(uuid) to authenticated;

-- kolejność ankiet w etapie
alter table public.briefs add column if not exists step_position int not null default 0;
