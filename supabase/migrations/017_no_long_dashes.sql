-- Zasada nadrzędna panelu: żadnych długich myślników (U+2014) ani półpauz (U+2013), tylko krótki "-".
-- Każdy zapis do tabel z treściami (ankiety, dokumenty, notatki, sprawy, wiadomości, profile...) jest normalizowany.

create or replace function public.no_long_dashes() returns trigger
language plpgsql set search_path = '' as $$
declare j text;
begin
  j := to_jsonb(new)::text;
  if position(chr(8212) in j) > 0 or position(chr(8211) in j) > 0 then
    j := replace(replace(j, chr(8212), '-'), chr(8211), '-');
    new := jsonb_populate_record(new, j::jsonb);
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'briefs', 'client_documents', 'document_notes', 'client_tasks', 'project_steps', 'access_items', 'cases',
    'case_messages', 'case_tips', 'messages', 'reviews', 'review_comments', 'services', 'team_members',
    'client_profiles', 'clients', 'summaries', 'client_files'
  ] loop
    execute format('drop trigger if exists no_long_dashes on public.%I', t);
    execute format('create trigger no_long_dashes before insert or update on public.%I for each row execute function public.no_long_dashes()', t);
  end loop;
end $$;
