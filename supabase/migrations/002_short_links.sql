-- Krótkie, czytelne linki do ankiet:
--   /optyka-perfect-7k2m            (wszystkie ankiety klienta)
--   /optyka-perfect-7k2m/prawny     (jedna ankieta)
-- 4 losowe znaki w adresie klienta chronią przed zgadnięciem linku po nazwie firmy.
-- Stare linki /k/<token> i /b/<token> przestają działać: klient ma dostęp tylko przez krótkie adresy.

create or replace function public.slugify(p text) returns text
language sql immutable set search_path = '' as $$
  select trim(both '-' from regexp_replace(
    translate(lower(coalesce(p, '')), 'ąćęłńóśźżäöüéèáàíìúù', 'acelnoszzaoueeaaiiuu'),
    '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.random_code(n int default 4) returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  bytes bytea := extensions.gen_random_bytes(n);
  out text := '';
begin
  for i in 0 .. n - 1 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return out;
end $$;

alter table public.clients add column if not exists slug text;
alter table public.briefs add column if not exists slug text;

create or replace function public.clients_set_slug() returns trigger
language plpgsql set search_path = '' as $$
declare base text; candidate text;
begin
  if new.slug is not null and new.slug <> '' then return new; end if;
  base := left(public.slugify(coalesce(nullif(new.company, ''), new.name)), 40);
  if base = '' then base := 'klient'; end if;
  loop
    candidate := base || '-' || public.random_code(4);
    exit when not exists (select 1 from public.clients where slug = candidate);
  end loop;
  new.slug := candidate;
  return new;
end $$;

create or replace function public.briefs_set_slug() returns trigger
language plpgsql set search_path = '' as $$
declare base text; candidate text; n int := 1;
begin
  if new.slug is not null and new.slug <> '' then return new; end if;
  base := case new.template_key
    when 'strategy' then 'strategia'
    when 'legal' then 'prawny'
    when 'technical' then 'techniczny'
    when 'visual' then 'wizualny'
    else coalesce(nullif(public.slugify(new.title), ''), 'ankieta') end;
  candidate := base;
  while exists (select 1 from public.briefs where client_id = new.client_id and slug = candidate and id <> new.id) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end $$;

drop trigger if exists clients_slug on public.clients;
create trigger clients_slug before insert on public.clients
  for each row execute function public.clients_set_slug();

drop trigger if exists briefs_slug on public.briefs;
create trigger briefs_slug before insert on public.briefs
  for each row execute function public.briefs_set_slug();

-- uzupełnienie istniejących rekordów (trigger działa tylko przy insert, więc liczymy ręcznie)
do $$
declare r record; base text; candidate text; n int;
begin
  for r in select id, name, company from public.clients where slug is null loop
    base := left(public.slugify(coalesce(nullif(r.company, ''), r.name)), 40);
    if base = '' then base := 'klient'; end if;
    loop
      candidate := base || '-' || public.random_code(4);
      exit when not exists (select 1 from public.clients where slug = candidate);
    end loop;
    update public.clients set slug = candidate where id = r.id;
  end loop;

  for r in select id, client_id, template_key, title from public.briefs where slug is null order by created_at loop
    base := case r.template_key
      when 'strategy' then 'strategia' when 'legal' then 'prawny'
      when 'technical' then 'techniczny' when 'visual' then 'wizualny'
      else coalesce(nullif(public.slugify(r.title), ''), 'ankieta') end;
    candidate := base; n := 1;
    while exists (select 1 from public.briefs where client_id = r.client_id and slug = candidate) loop
      n := n + 1; candidate := base || '-' || n;
    end loop;
    update public.briefs set slug = candidate where id = r.id;
  end loop;
end $$;

alter table public.clients alter column slug set not null;
alter table public.briefs alter column slug set not null;
create unique index if not exists clients_slug_key on public.clients(slug);
create unique index if not exists briefs_client_slug_key on public.briefs(client_id, slug);

-- portal: dodatkowo zwraca krótkie adresy
create or replace function public.get_portal(p_token uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare c public.clients;
begin
  select * into c from public.clients where portal_token = p_token;
  if not found then return null; end if;
  return json_build_object(
    'client_name', coalesce(c.company, c.name),
    'client_slug', c.slug,
    'briefs', coalesce((
      select json_agg(json_build_object(
        'title', b.title, 'description', b.description, 'status', b.status,
        'token', b.token, 'slug', b.slug, 'template_key', b.template_key
      ) order by b.position, b.created_at)
      from public.briefs b where b.client_id = c.id and b.status <> 'draft'
    ), '[]'::json)
  );
end $$;

create or replace function public.get_portal_by_slug(p_client text) returns json
language plpgsql security definer set search_path = '' as $$
declare t uuid;
begin
  select portal_token into t from public.clients where slug = lower(p_client);
  if not found then return null; end if;
  return public.get_portal(t);
end $$;

-- ankieta po krótkim adresie: zwraca to samo co get_brief + token do zapisu odpowiedzi
create or replace function public.get_brief_by_slug(p_client text, p_brief text) returns json
language plpgsql security definer set search_path = '' as $$
declare t uuid; res json;
begin
  select b.token into t
  from public.briefs b join public.clients c on c.id = b.client_id
  where c.slug = lower(p_client) and b.slug = lower(p_brief);
  if not found then return null; end if;
  res := public.get_brief(t);
  return (res::jsonb || jsonb_build_object('token', t))::json;
end $$;

revoke all on function public.get_portal_by_slug(text) from public;
revoke all on function public.get_brief_by_slug(text, text) from public;
grant execute on function public.get_portal_by_slug(text) to anon, authenticated;
grant execute on function public.get_brief_by_slug(text, text) to anon, authenticated;

-- stare, długie linki wyłączone dla niezalogowanych
revoke execute on function public.get_brief(uuid) from anon;
revoke execute on function public.get_portal(uuid) from anon;
