-- Dostępy jako wspólna lista: obie strony dodają, edytują i usuwają pozycje.
-- Dane logowania szyfrowane w Supabase Vault; odczyt tylko dla klienta i administratorki.

alter table public.access_items alter column service drop not null;
alter table public.access_items drop constraint if exists access_items_client_id_service_key;
alter table public.access_items add column if not exists title text;
alter table public.access_items add column if not exists description text;
alter table public.access_items add column if not exists kind text not null default 'invite' check (kind in ('invite', 'login'));
alter table public.access_items add column if not exists step_id uuid references public.project_steps(id) on delete set null;
alter table public.access_items add column if not exists urgent boolean not null default false;
alter table public.access_items add column if not exists position int not null default 0;
alter table public.access_items add column if not exists created_by text not null default 'admin' check (created_by in ('admin', 'client'));
alter table public.access_items add column if not exists secret_id uuid;
alter table public.access_items add column if not exists created_at timestamptz not null default now();
update public.access_items set title = coalesce(title, service, 'Dostęp') where title is null;

-- zapis danych logowania (szyfrowane w Vault)
create or replace function public.set_access_credentials(p_item uuid, p_url text, p_login text, p_password text, p_notes text)
returns void
language plpgsql security definer set search_path = '' as $$
declare it public.access_items; payload text;
begin
  select * into it from public.access_items where id = p_item;
  if not found or not public.can_access_client(it.client_id) then raise exception 'not_found'; end if;
  payload := json_build_object('url', p_url, 'login', p_login, 'password', p_password, 'notes', p_notes)::text;
  if it.secret_id is null then
    update public.access_items set secret_id = vault.create_secret(payload, 'access-' || it.id::text, 'Dane logowania NAFU Brief')
    where id = it.id;
  else
    perform vault.update_secret(it.secret_id, payload);
  end if;
  update public.access_items set updated_at = now() where id = it.id;
end $$;

create or replace function public.get_access_credentials(p_item uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare it public.access_items; secret text;
begin
  select * into it from public.access_items where id = p_item;
  if not found or not public.can_access_client(it.client_id) then raise exception 'not_found'; end if;
  if it.secret_id is null then return null; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where id = it.secret_id;
  return secret::json;
end $$;

create or replace function public.clear_access_credentials(p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare it public.access_items;
begin
  select * into it from public.access_items where id = p_item;
  if not found or not public.can_access_client(it.client_id) then raise exception 'not_found'; end if;
  if it.secret_id is not null then
    delete from vault.secrets where id = it.secret_id;
    update public.access_items set secret_id = null, updated_at = now() where id = it.id;
  end if;
end $$;

-- usunięcie pozycji usuwa też zaszyfrowane dane
create or replace function public.access_items_drop_secret() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.secret_id is not null then delete from vault.secrets where id = old.secret_id; end if;
  return old;
end $$;
drop trigger if exists access_items_secret on public.access_items;
create trigger access_items_secret after delete on public.access_items
  for each row execute function public.access_items_drop_secret();

revoke all on function public.set_access_credentials(uuid, text, text, text, text) from public, anon;
revoke all on function public.get_access_credentials(uuid) from public, anon;
revoke all on function public.clear_access_credentials(uuid) from public, anon;
grant execute on function public.set_access_credentials(uuid, text, text, text, text) to authenticated;
grant execute on function public.get_access_credentials(uuid) to authenticated;
grant execute on function public.clear_access_credentials(uuid) to authenticated;

-- klient i administratorka: pełna kontrola nad listą (odczyt, dodawanie, edycja, usuwanie)
drop policy if exists "client access" on public.access_items;
create policy "client access" on public.access_items for all to authenticated
  using ((select public.can_access_client(client_id))) with check ((select public.can_access_client(client_id)));
