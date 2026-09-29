-- Konta klientów
-- • Właścicielka (administratorka) zarządza wszystkim w panelu.
-- • Klient loguje się własnym kontem i widzi tylko swoje ankiety i odpowiedzi.
-- • Bez logowania można tylko przejrzeć pytania (bez żadnych odpowiedzi).
-- Adresy nie potrzebują już losowego kodu: /optyka-perfect i /optyka-perfect/prawny.

-- administratorzy ----------------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.app_admins enable row level security;
drop policy if exists "read own" on public.app_admins;
create policy "read own" on public.app_admins for select to authenticated
  using (user_id = (select auth.uid()));

insert into public.app_admins (user_id)
  select id from auth.users where email = 'n.e.jaskiewicz@gmail.com'
  on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins where user_id = (select auth.uid()))
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- konto klienta przy kliencie -----------------------------------------------
alter table public.clients add column if not exists user_id uuid unique references auth.users(id) on delete set null;
alter table public.clients add column if not exists login_email text;

-- zasady dostępu ------------------------------------------------------------
drop policy if exists "owner all" on public.clients;
drop policy if exists "admin all" on public.clients;
create policy "admin all" on public.clients for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_admin()))
  with check (owner_id = (select auth.uid()) and (select public.is_admin()));
drop policy if exists "client reads own" on public.clients;
create policy "client reads own" on public.clients for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "owner all" on public.briefs;
drop policy if exists "admin all" on public.briefs;
create policy "admin all" on public.briefs for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_admin()))
  with check (owner_id = (select auth.uid()) and (select public.is_admin()));
drop policy if exists "client reads own" on public.briefs;
create policy "client reads own" on public.briefs for select to authenticated
  using (
    status <> 'draft'
    and exists (select 1 from public.clients c where c.id = client_id and c.user_id = (select auth.uid()))
  );

drop policy if exists "owner all" on public.summaries;
drop policy if exists "admin all" on public.summaries;
create policy "admin all" on public.summaries for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_admin()))
  with check (owner_id = (select auth.uid()) and (select public.is_admin()));

create index if not exists clients_user_idx on public.clients(user_id);

-- zapis odpowiedzi przez zalogowanego klienta -------------------------------
create or replace function public.save_my_brief(p_brief uuid, p_answers jsonb, p_submit boolean default false)
returns json
language plpgsql security definer set search_path = '' as $$
declare b public.briefs;
begin
  select br.* into b
  from public.briefs br join public.clients c on c.id = br.client_id
  where br.id = p_brief and c.user_id = (select auth.uid())
  for update of br;
  if not found then raise exception 'not_found'; end if;
  if b.status = 'draft' then raise exception 'not_ready'; end if;
  if b.status = 'submitted' then raise exception 'already_submitted'; end if;
  if jsonb_typeof(p_answers) <> 'object' or octet_length(p_answers::text) > 800000 then
    raise exception 'invalid_answers';
  end if;
  update public.briefs set
    answers = p_answers,
    status = case when p_submit then 'submitted' else 'in_progress' end,
    submitted_at = case when p_submit then now() else null end,
    opened_at = coalesce(opened_at, now())
  where id = b.id;
  return json_build_object('ok', true, 'status', case when p_submit then 'submitted' else 'in_progress' end);
end $$;

create or replace function public.open_my_brief(p_brief uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.briefs br set opened_at = now()
  from public.clients c
  where br.id = p_brief and c.id = br.client_id and c.user_id = (select auth.uid()) and br.opened_at is null;
end $$;

revoke all on function public.save_my_brief(uuid, jsonb, boolean) from public, anon;
revoke all on function public.open_my_brief(uuid) from public, anon;
grant execute on function public.save_my_brief(uuid, jsonb, boolean) to authenticated;
grant execute on function public.open_my_brief(uuid) to authenticated;

-- publiczny podgląd pytań (bez odpowiedzi) -------------------------------
create or replace function public.get_public_portal(p_client text) returns json
language plpgsql stable security definer set search_path = '' as $$
declare c public.clients;
begin
  select * into c from public.clients where slug = lower(p_client);
  if not found then return null; end if;
  return json_build_object(
    'client_name', coalesce(c.company, c.name),
    'client_slug', c.slug,
    'briefs', coalesce((
      select json_agg(json_build_object(
        'title', b.title, 'description', b.description, 'slug', b.slug, 'template_key', b.template_key
      ) order by b.position, b.created_at)
      from public.briefs b where b.client_id = c.id and b.status <> 'draft'
    ), '[]'::json)
  );
end $$;

create or replace function public.get_public_brief(p_client text, p_brief text) returns json
language plpgsql stable security definer set search_path = '' as $$
declare b public.briefs; c public.clients;
begin
  select * into c from public.clients where slug = lower(p_client);
  if not found then return null; end if;
  select * into b from public.briefs where client_id = c.id and slug = lower(p_brief);
  if not found then return null; end if;
  if b.status = 'draft' then
    return json_build_object('status', 'draft', 'client_name', coalesce(c.company, c.name));
  end if;
  return json_build_object(
    'status', 'sent', 'title', b.title, 'description', b.description, 'intro', b.intro,
    'schema', b.schema, 'answers', '{}'::json, 'client_name', coalesce(c.company, c.name),
    'submitted_at', null
  );
end $$;

revoke all on function public.get_public_portal(text) from public;
revoke all on function public.get_public_brief(text, text) from public;
grant execute on function public.get_public_portal(text) to anon, authenticated;
grant execute on function public.get_public_brief(text, text) to anon, authenticated;

-- stary dostęp przez link (odczyt i zapis odpowiedzi bez logowania) usunięty
drop function if exists public.get_brief_by_slug(text, text);
drop function if exists public.get_portal_by_slug(text);
drop function if exists public.save_brief(uuid, jsonb, boolean);
drop function if exists public.get_brief(uuid);
drop function if exists public.get_portal(uuid);

-- adresy bez losowego kodu -------------------------------------------------
create or replace function public.clients_set_slug() returns trigger
language plpgsql set search_path = '' as $$
declare base text; candidate text; n int := 1;
begin
  if new.slug is not null and new.slug <> '' then return new; end if;
  base := left(public.slugify(coalesce(nullif(new.company, ''), new.name)), 50);
  if base = '' then base := 'klient'; end if;
  candidate := base;
  while exists (select 1 from public.clients where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end $$;

do $$
declare r record; base text; candidate text; n int;
begin
  for r in select id, name, company from public.clients order by created_at loop
    base := left(public.slugify(coalesce(nullif(r.company, ''), r.name)), 50);
    if base = '' then base := 'klient'; end if;
    candidate := base; n := 1;
    while exists (select 1 from public.clients where slug = candidate and id <> r.id) loop
      n := n + 1; candidate := base || '-' || n;
    end loop;
    update public.clients set slug = candidate where id = r.id;
  end loop;
end $$;
