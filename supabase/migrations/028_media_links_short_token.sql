-- Krótsze linki do wgrywania mediów: 10 znaków bez łatwych do pomylenia (0/o, 1/l/i), np. /wgraj/k7m2x9q4ab.
-- 31^10 możliwości wystarcza, bo link daje dostęp tylko do wgrywania i do plików wgranych nim samym.

create or replace function public.media_link_token() returns text
language plpgsql volatile set search_path = '' as $$
declare
  abc constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  t text;
  b bytea;
  i int;
begin
  loop
    -- losowe bajty z gen_random_uuid (kryptograficzne); bajty 6 i 8 pomijamy, bo niosą wersję uuid
    b := uuid_send(gen_random_uuid());
    t := '';
    foreach i in array array[0, 1, 2, 3, 4, 5, 9, 10, 11, 12] loop
      t := t || substr(abc, 1 + get_byte(b, i) % 31, 1);
    end loop;
    exit when not exists (select 1 from public.media_links where token = t);
  end loop;
  return t;
end $$;
revoke all on function public.media_link_token() from public, anon;

alter table public.media_links alter column token set default public.media_link_token();

-- istniejące długie linki dostają krótki kod (stary adres przestaje działać)
update public.media_links set token = public.media_link_token() where length(token) > 10;
