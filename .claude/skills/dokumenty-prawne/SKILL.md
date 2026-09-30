---
name: dokumenty-prawne
description: Przygotowuje szkice dokumentów prawnych na stronę klienta NAFU Brief (polityka prywatności, cookies, regulamin, klauzule RODO, zgody, deklaracja dostępności, skrócone standardy ochrony małoletnich) na podstawie ankiety prawnej i profilu klienta z panelu, z użyciem skilli prawnych Natalii. Używaj, gdy Natalia napisze „Przygotuj dokumenty prawne dla klienta <adres-klienta>” albo poprosi o dokumenty prawne dla klienta z panelu.
---

# Dokumenty prawne dla klienta NAFU Brief

Natalia prowadzi NAFU Design (jednoosobowa pracownia). Panel NAFU Brief działa na Supabase, projekt `kqkqufxpxwqhujglhxej`. Dane klienta czytasz i szkice zapisujesz narzędziami Supabase (`execute_sql`).

## 1. Pobierz dane klienta

Adres klienta (slug) jest w poleceniu, np. `optyka-perfect`.

```sql
select c.id, c.name, c.company, c.industry, c.website, c.notes,
  (select data from public.client_profiles p where p.client_id = c.id) as profile,
  (select json_agg(json_build_object('title', b.title, 'status', b.status, 'schema', b.schema, 'answers', b.answers))
     from public.briefs b where b.client_id = c.id) as briefs,
  (select json_agg(json_build_object('name', t.name, 'role', t.role, 'qualifications', t.qualifications, 'schedule', t.schedule))
     from public.team_members t where t.client_id = c.id) as team,
  (select json_agg(json_build_object('name', s.name, 'price', s.price, 'show_on_site', s.show_on_site, 'show_in_calendar', s.show_in_calendar))
     from public.services s where s.client_id = c.id) as services,
  (select json_agg(json_build_object('title', d.title, 'kind', d.kind, 'visible', d.visible))
     from public.client_documents d where d.client_id = c.id) as documents
from public.clients c where c.slug = '<slug>';
```

Najważniejsza jest ankieta „Dział prawny” (`template_key = 'legal'`). Odpowiedzi są w `answers` pod identyfikatorami pytań ze `schema` (np. `l1_name`, `l3_recipients`, `l6_applies`). Połącz pytanie z odpowiedzią, zanim zaczniesz analizę. Wykorzystaj też ankietę techniczną (narzędzia, hosting, poczta) i profil (firmy, salony, dane kontaktowe).

Jeśli ankieta prawna nie jest wysłana albo brakuje kluczowych danych administratora (nazwa, NIP, adres, kontakt w sprawach danych), napisz to Natalii i zapytaj, czy przygotować szkice z brakami.

## 2. Pracuj na skillach prawnych Natalii

Zawsze najpierw wczytaj `prawny-router-v3` i postępuj zgodnie z nim (HARD GATE, routing, weryfikacja aktualnego stanu prawnego w sieci). Router wskaże skille dziedzinowe; typowo potrzebne będą:

- `dr-11-cyfrowe-cyber-ai-dane-ip`: RODO, cookies i prawo telekomunikacyjne, AI Act (oznaczenie kontaktu z AI), usługi cyfrowe, Europejski Akt o Dostępności,
- `dr-02-prawo-cywilne-rodzinne-gospodarcze`: prawo konsumenckie, regulaminy, Omnibus, odstąpienie od umowy (przycisk odstąpienia od 19.06.2026), GPSR,
- `dr-10-zdrowie-farmacja-zywnosc-rolnictwo`: gdy firma bada klientów lub jest podmiotem leczniczym (dane o zdrowiu, dokumentacja medyczna),
- skill właściwy dla standardów ochrony małoletnich (ustawa z 2023 r.), wskazany przez router,
- `pisma-proste-v2` do redakcji tekstów.

Nie zgaduj przepisów z pamięci. Sprawdzaj aktualne brzmienie i daty wejścia w życie tak, jak każą skille.

## 3. Ustal, które dokumenty są potrzebne

Na podstawie odpowiedzi przygotuj tylko te, które dotyczą klienta:

| Dokument | Kiedy |
|---|---|
| Polityka prywatności | zawsze |
| Polityka cookies i treść banera zgód | zawsze (zakres zależy od narzędzi z `l4_tools`) |
| Klauzule informacyjne przy formularzach | gdy są formularze (`l4_forms`) |
| Treści zgód (marketing, wizerunek, przypomnienia) | według `l8_consents`, `l3_photos` |
| Regulamin świadczenia usług | gdy są usługi opisane w części „Zasady Twoich usług” |
| Regulamin sklepu / sprzedaży online | gdy `l4_shop` lub `l8_withdraw` wskazuje sprzedaż |
| Informacja o monitoringu | gdy `l3_cctv` = Tak |
| Deklaracja dostępności | gdy obowiązek dotyczy firmy (liczba pracowników i obrót z `l1_staff`, `l1_turnover`); jeśli nie dotyczy, napisz to Natalii |
| Standardy ochrony małoletnich, wersja skrócona do publikacji | gdy `l6_applies` = Tak |
| Informacja o kontakcie z AI | gdy `l8_ai` = Tak |

## 4. Zasady pisania

- Po polsku, prostym językiem zrozumiałym dla klienta firmy, bez zbędnego żargonu.
- Tylko prawdziwe dane z ankiety i profilu. Brakujące dane oznacz jako `[DO UZUPEŁNIENIA: …]`, niczego nie wymyślaj.
- Nie używaj długich myślników (— ani –), tylko krótki `-`.
- Format: Markdown z nagłówkami `##` i numerowanymi paragrafami.
- Na górze każdego dokumentu: nazwa, dane administratora, data „Obowiązuje od: [DO UZUPEŁNIENIA]”.

## 5. Zapisz szkice w panelu

Każdy dokument wstaw jako szkic widoczny tylko dla Natalii (`visible = false`). Użyj dollar-quotingu z unikalnym znacznikiem, żeby treść nie psuła zapytania:

```sql
insert into public.client_documents (client_id, title, kind, content, note, visible, requires_acceptance)
values (
  '<client_id>',
  'Polityka prywatności',
  'legal',
  $nafudoc$<treść w Markdown>$nafudoc$,
  $nafunote$Do sprawdzenia: <lista braków i punktów do weryfikacji>$nafunote$,
  false,
  true
);
```

Jeśli szkic o tym samym tytule już istnieje i jest ukryty (`visible = false`), zaktualizuj go (`update … set content = …, note = …, updated_at = now()`) zamiast tworzyć duplikat. Nigdy nie zmieniaj dokumentów już udostępnionych klientowi (`visible = true`), chyba że Natalia wyraźnie o to poprosi.

## 6. Podsumowanie dla Natalii

Na koniec napisz krótko:
- jakie dokumenty są przygotowane, a które pominięte (z powodem),
- listę braków `[DO UZUPEŁNIENIA]` do dopytania klienta,
- punkty, które warto skonsultować z prawnikiem,
- że szkice czekają w panelu: kartoteka klienta → Dokumenty, gdzie po sprawdzeniu klika „Udostępnij klientowi”.
