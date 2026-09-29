# NAFU Brief

Narzędzie NAFU Design do zbierania briefów od klientów: ankiety online (strategia, prawo, technika, wygląd), panel do zarządzania klientami i agent AI, który z odpowiedzi robi podsumowanie, wnioski i konspekt pracy.

**Stos:** Vite + React + TypeScript · Supabase (baza + logowanie) · Netlify (hosting + funkcje) · Claude (agent AI)

## Jak to działa

1. **Panel → Nowy klient** - wpisujesz dane i zaznaczasz ankiety.
2. Ankiety powstają jako **szkice** (kopie szablonów). Otwierasz każdą → **Pytania**: edytujesz, usuwasz, dodajesz pytania i całe części. **Podgląd** pokazuje ankietę oczami klienta.
3. **Zatwierdź i wygeneruj linki** - linki zaczynają działać. Wysyłasz klientowi jeden link do wszystkich ankiet (`/k/…`) albo osobne (`/b/…`). Przycisk **Wiadomość do klienta** przygotowuje gotowy tekst.
4. Klient wypełnia - odpowiedzi zapisują się automatycznie, może wracać w dowolnej chwili. Po kliknięciu **Wyślij** ankieta ma status „Wysłana” i widzisz ją w panelu (opcjonalnie dostajesz e-mail).
5. **Podsumowanie AI** - agent czyta wszystkie odpowiedzi klienta i przygotowuje dokument roboczy: profil, wnioski, zakres strony, listę dokumentów prawnych z brakami, technikę, kierunek wizualny, pytania na rozmowę, ryzyka i konspekt pracy. Eksport do .md lub PDF.

Szablony pytań są w `src/templates/*.ts` (strategia, prawny, techniczny, wizualny).

## Uruchomienie lokalne

```bash
npm install
npm run dev
```

Bez pliku `.env` aplikacja działa w **trybie demo** (dane w przeglądarce, logowanie bez hasła) - dobre do oglądania i testów.

## Wdrożenie (jednorazowo, ok. 15 minut)

### 1. Supabase

1. Załóż projekt na [supabase.com](https://supabase.com) (region: Frankfurt / EU - dane klientów zostają w UE).
2. **SQL Editor** → wklej całość `supabase/migrations/001_init.sql` → **Run**.
3. **Authentication → Users → Add user**: Twój e-mail i hasło (to konto do panelu).
4. **Authentication → Sign In / Providers**: wyłącz **Allow new users to sign up** - tylko Ty masz konto.
5. **Project Settings → API**: skopiuj *Project URL* i *publishable / anon key*.

### 2. GitHub

```bash
git remote add origin git@github.com:<twoje-konto>/nafu-brief.git
git push -u origin main
```

### 3. Netlify

1. **Add new project → Import from Git** → wybierz repozytorium. Ustawienia buildu czyta z `netlify.toml`.
2. **Site configuration → Environment variables** - dodaj:

| Zmienna | Wartość |
|---|---|
| `VITE_SUPABASE_URL` | Project URL z Supabase |
| `VITE_SUPABASE_ANON_KEY` | publishable / anon key |
| `SUPABASE_URL` | to samo co wyżej |
| `SUPABASE_ANON_KEY` | to samo co wyżej |
| `ANTHROPIC_API_KEY` | klucz z [platform.claude.com](https://platform.claude.com) |
| `RESEND_API_KEY` *(opcjonalnie)* | klucz Resend - powiadomienia e-mail o wysłanej ankiecie |
| `NOTIFY_EMAIL` *(opcjonalnie)* | gdzie wysyłać powiadomienia (domyślnie n.e.jaskiewicz@gmail.com) |
| `NOTIFY_FROM` *(opcjonalnie)* | nadawca, np. `NAFU Brief <brief@nafudesign.pl>` (domena zweryfikowana w Resend) |

3. **Deploys → Trigger deploy**.
4. W Supabase: **Authentication → URL Configuration → Site URL** ustaw na adres z Netlify.

## Bezpieczeństwo i RODO

- Tabele są chronione RLS - dostęp ma tylko zalogowana właścicielka.
- Klient bez logowania widzi wyłącznie ankietę, do której ma link (losowy token UUID), przez funkcje `get_brief` / `save_brief` / `get_portal`. Szkice są niewidoczne, wysłanej ankiety nie da się nadpisać (chyba że ją odblokujesz w panelu).
- Strony mają `noindex` - nie trafią do Google.
- Klucz Anthropic jest tylko po stronie serwera (funkcja Netlify). Odpowiedzi klientów są przekazywane do API Claude wyłącznie przy generowaniu podsumowania - uwzględnij to w swojej umowie powierzenia / informacji dla klientów.
- W ankietach są ostrzeżenia, żeby nie wpisywać haseł ani danych klientów.

## Agent AI

`netlify/functions/summarize-background.ts` - funkcja w tle (do 15 min). Model domyślnie `claude-opus-5-5` (zmiana: zmienna `ANTHROPIC_MODEL`), z adaptacyjnym myśleniem i automatycznym modelem zapasowym (`fallbacks: "default"`), gdyby główny model odmówił odpowiedzi. Instrukcje agenta (struktura podsumowania) są w stałej `SYSTEM` w tym pliku.

## Struktura

```
src/templates/     szablony ankiet (tu zmieniasz pytania bazowe)
src/pages/client/  to, co widzi klient (ankieta, portal)
src/pages/admin/   panel (klienci, edytor pytań, odpowiedzi, AI)
src/lib/api.ts     dostęp do danych (Supabase + tryb demo)
netlify/functions/ agent AI i powiadomienia e-mail
supabase/          schemat bazy
public/brand/      logo i key visual NAFU
```

Kontakt: Natalia Jaśkiewicz · NAFU Design · Bolesławiec · +48 571 786 388 · n.e.jaskiewicz@gmail.com
