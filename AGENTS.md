# AGENTS.md

Guidance for AI coding agents working in this repository.

## Leftovers to be aware of

`dist/` is build output (gitignored) — the Astro build overwrites it. The earlier plain-TypeScript scaffold's `src/index.ts` was deleted and `README.md` rewritten for this app. `CLAUDE.md` imports this file via `@AGENTS.md`; edit guidance here, not there (the 10x-cli block in `CLAUDE.md` is managed by that tool).

## Conventions

- Import via the `@/*` alias (→ `src/*`).
- Astro components for static markup; React only where interactivity is needed. No `"use client"` directives. Put extracted hooks in `src/components/hooks/`.
- Merge Tailwind classes with `cn()` from `@/lib/utils`, not string concatenation.
- Add shadcn components with `npx shadcn@latest add <name>` (lands in `src/components/ui/`).
- Server secrets come from `astro:env/server`, never `import.meta.env`/`process.env`. New env vars must be added to `env.schema` in `astro.config.mjs`.
- Business logic goes in `src/lib/services/`; shared entity/DTO types in `src/types.ts` (neither exists yet).
- Supabase migrations: `supabase/migrations/YYYYMMDDHHmmss_short_description.sql`; enable RLS on every new table with per-operation, per-role policies.

## Architecture

Astro 7 SSR app (`output: "server"`, `@astrojs/cloudflare` adapter → Cloudflare Workers via `wrangler.jsonc`) with React 19 islands, Tailwind 4, shadcn/ui ("new-york"), and Supabase auth.

### Auth flow

- `src/lib/supabase.ts` — `createClient(headers, cookies)` builds a `@supabase/ssr` server client with cookie sessions. **Returns `null` when `SUPABASE_URL`/`SUPABASE_KEY` are unset** — both are declared `optional` in `astro.config.mjs` `env.schema`, so the app must keep working without Supabase. Every caller handles the `null` case.
- `src/lib/config-status.ts` — reports missing config, which `src/layouts/Layout.astro` shows to users (UI copy is in Polish).
- `src/middleware.ts` — per request, sets `context.locals.user` (or `null`) and redirects anonymous users from any path starting with an entry in `PROTECTED_ROUTES` to `/auth/signin`.
- `src/pages/api/auth/{signin,signup,signout}.ts` — `POST` handlers that read `formData()` and respond with redirects; errors go back as `?error=<message>` on the auth page, not as JSON.
- Pages: `src/pages/auth/*.astro` render React forms from `src/components/auth/`; `src/pages/dashboard.astro` is the protected example.

`scripts/smoke.mjs` (with its matcher `scripts/smoke-match.mjs`) encodes the expected behavior of this flow (status codes, redirect targets, cookies) — update them when changing auth routes.

## Commands

- `npm run dev` — dev server (Astro + Cloudflare adapter, workerd runtime)
- `npm run build` / `npm run preview` — production build and local preview of it
- `npm run lint` / `npm run lint:fix` — ESLint with `strictTypeChecked` typescript-eslint rules (lint needs generated types: run `npx astro sync` first on a fresh checkout)
- `npx astro check` — type-check `.astro` + TS files (CI runs it; there is no `typecheck` script)
- `npm run format` — Prettier (astro + tailwind plugins)
- `npm run smoke` — dependency-free end-to-end auth smoke test (`scripts/smoke.mjs`) against a running server; `BASE_URL` defaults to `http://localhost:4321`. Needs a reachable Supabase. Run after dependency upgrades.
- `npm run test:smoke` — unit tests for the smoke matcher (`scripts/*.test.mjs`, `node --test`); no server needed.
- `npm run smoke:remote` — same smoke test against a hosted environment, loading `.env.smoke` (copy `.env.smoke.example`; gitignored, never commit it). `SMOKE_EMAIL`/`SMOKE_PASSWORD` select remote mode: signs in to an existing confirmed account and never signs up. `CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET` add Cloudflare Access service-token headers. Pass `BASE_URL` (and `SMOKE_EXPECT_ACCESS=1` to first assert anonymous requests are blocked by Access) per run, e.g. `BASE_URL=https://<preview> SMOKE_EXPECT_ACCESS=1 npm run smoke:remote`. Half-set credential pairs exit 1 before any request.

## Environment

- Secrets: copy `.env.example` to `.env` (Node) and/or `.dev.vars` (workerd dev/preview); both gitignored.
- Local Supabase: `npx supabase start` (Docker), then use its API URL + anon key.
- Deploy: `npx wrangler deploy`.

## CI

@`.github/workflows/ci.yml`
CI needs the repo secrets
