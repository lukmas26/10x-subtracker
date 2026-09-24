# SubTracker

Tracker subskrypcji cyklicznych. Wyciąg z karty pokazuje transakcje, które już się wydarzyły —
SubTracker pokazuje zobowiązania: to, co będzie płacone dalej, zsumowane i pogrupowane, wraz
z rekomendacją oszczędności przy duplikatach w tej samej kategorii.

Status: **MVP w budowie.** Działa logowanie (Supabase) i chroniona strona `/dashboard`;
CRUD subskrypcji i podsumowanie wydatków jeszcze nie powstały.

## Stack

| Warstwa          | Wybór                                               |
| ---------------- | --------------------------------------------------- |
| Framework        | Astro 7 SSR (`output: "server"`) z wyspami React 19 |
| Język            | TypeScript 6                                        |
| Style            | Tailwind 4 + shadcn/ui (`new-york`)                 |
| Auth i baza      | Supabase (`@supabase/ssr`, sesja w cookies)         |
| Runtime i deploy | Cloudflare Workers przez `@astrojs/cloudflare`      |

Uzasadnienie wyboru stacku i platformy: [`context/foundation/tech-stack.md`](context/foundation/tech-stack.md)
i [`context/foundation/infrastructure.md`](context/foundation/infrastructure.md).

## Wymagania

- Node 22.14.0 (`.nvmrc`)
- Docker — tylko jeśli chcesz uruchomić lokalne Supabase

## Start

```bash
npm install
cp .env.example .env        # uzupełnij SUPABASE_URL i SUPABASE_KEY
cp .env .dev.vars           # ten sam zestaw dla runtime'u workerd
npm run dev
```

Aplikacja działa też **bez Supabase** — obie zmienne są `optional` w `env.schema`
(`astro.config.mjs`), więc serwer wstaje, a `src/lib/config-status.ts` pokazuje baner
o wyłączonym uwierzytelnianiu.

Lokalne Supabase: `npx supabase start`, następnie użyj wypisanego API URL i klucza `anon`.

## Skrypty

| Polecenie                   | Co robi                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `npm run dev`               | serwer deweloperski (runtime workerd)                       |
| `npm run build`             | build produkcyjny                                           |
| `npm run preview`           | lokalny podgląd builda — na tym samym runtime co produkcja  |
| `npm run lint` / `lint:fix` | ESLint (`strictTypeChecked`)                                |
| `npx astro check`           | sprawdzenie typów w `.astro` i TS (odpowiednik `typecheck`) |
| `npm run format`            | Prettier                                                    |
| `npm run smoke`             | end-to-end test flow auth wobec działającego serwera        |

Na świeżym klonie uruchom najpierw `npx astro sync` — lint i `astro check` potrzebują
wygenerowanych typów.

`npm run smoke` sprawdza całą ścieżkę logowania (kody statusu, przekierowania, cookies) wobec
`BASE_URL` (domyślnie `http://localhost:4321`) i wymaga osiągalnego Supabase. Uruchamiaj po
zmianach w trasach auth i po aktualizacjach zależności.

## Deploy

```bash
npx wrangler deploy
```

> **Uwaga:** `wrangler deploy` i `wrangler pages deploy` **nie są zamienne**.
> `@astrojs/cloudflare` od v13 nie wspiera Cloudflare Pages — ten projekt działa wyłącznie
> na Workers. Użycie polecenia Pages daje deploy, który wygląda na udany i nie działa.

Sekrety produkcyjne trafiają do Workers Secrets, nie do repo:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
```

Wycofanie zmiany: `npx wrangler rollback`. Podgląd bez kierowania ruchu produkcyjnego:
`npx wrangler versions upload`. Logi na żywo: `npx wrangler tail`.

Pełna procedura pierwszego wdrożenia wraz z bramkami zatwierdzenia:
[`context/plans/deployment-plan.md`](context/plans/deployment-plan.md).

## Struktura

```
src/pages/          trasy Astro + endpointy API (src/pages/api/auth/*)
src/components/     komponenty Astro; React tylko tam, gdzie potrzebna interaktywność
src/lib/            klient Supabase, status konfiguracji, utils
src/middleware.ts   ustawia locals.user i chroni PROTECTED_ROUTES
context/foundation/ PRD, tech-stack, infrastructure — kontrakty projektu
scripts/smoke.mjs   test end-to-end flow auth (bez zależności)
```

Konwencje kodu, zasady pracy z Supabase i migracjami oraz szczegóły przepływu auth:
[`AGENTS.md`](AGENTS.md).
