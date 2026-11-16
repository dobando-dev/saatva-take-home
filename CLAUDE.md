# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Saatva storefront take-home: a mattress configurator + cart. Three npm workspaces:

| Workspace           | Port | Role                                                           |
| ------------------- | ---- | -------------------------------------------------------------- |
| `services/upstream` | 4100 | Mock third-party catalog + content services. **Never modify.** |
| `apps/api`          | 4000 | NestJS BFF (global prefix `/api`). Ours to change.             |
| `apps/web`          | 3000 | Next.js App Router frontend. Ours to change.                   |

Requirements live in `README.md` (shopper stories + constraints); design guide is `docs/mock.png` (desktop only, no cart mock). Specs and decisions live in `docs/specs/`.

## Commands

Requires Node 26 (`nvm install` reads `.nvmrc`).

```bash
npm install
npm run dev            # all three processes via concurrently
npm run dev:api        # or dev:upstream / dev:web individually
npm run build -w apps/api
npm run build -w apps/web
npm run verify         # format:check + typecheck (both apps) + tests — must pass before any task is "done" or committed
npm run format         # prettier --write . (respects .prettierignore)
```

Upstream failure simulation (env vars on the upstream process):
`UPSTREAM_LATENCY_MS` (default 150), `UPSTREAM_FAILURE_RATE` (0..1, random 503s), `UPSTREAM_FAIL_SERVICE=catalog|content` (always 503 one service).

Formatting follows `.prettierrc` (no semicolons, single quotes, trailing commas, width 100). `.prettierignore` excludes `services/upstream/`, `README.md` and `apps/web/tsconfig.json` so provided files don't get formatting-only churn. The web typecheck runs `next typegen` first because `next-env.d.ts` is gitignored.

## Guardrails (`.claude/settings.json` hooks)

- Edits under `services/upstream/` are blocked (`.claude/hooks/guard-upstream.mjs`).
- `git commit|merge|rebase|push` while on `main`/`master` is blocked (`.claude/hooks/guard-main-branch.mjs`).
- Every Edit/Write is auto-formatted with the pinned Prettier (`.claude/hooks/format.mjs`).

## Architecture

**Request flow.** Browser → Next.js. Client-side calls use relative `/api/*` URLs, which `apps/web/next.config.mjs` rewrites (proxies) to the BFF, so browser requests are same-origin (cookies set by the BFF land on the web origin). Server Components can't use the rewrite; `apps/web/lib/api.ts` calls `API_URL` (default `http://localhost:4000`) directly when `window` is undefined. Server-side fetches must forward the incoming request's cookies explicitly if the BFF needs them.

**Hard constraint:** the web app talks only to the BFF and must not know which upstream a field came from. Upstream shapes and upstream-only concepts (`productHandle`, `displayName`, `imageKey`, `reviews`, `salePriceCents`, …) must not leak past the BFF; the BFF owns the response shape (see decision D11 in `docs/specs/00-overview.md`).

**BFF.** `UpstreamModule` exports `UpstreamClient` (thin `fetch` wrapper for `/catalog/v1/products` and `/content/v1/products`; throws on non-2xx). `ProductsModule` imports it: `ProductsService` fetches catalog and content in parallel, validates them in `catalog.mapper.ts` / `content.mapper.ts` (zod; the content mapper is the v2 swap point), sanitizes descriptions and merges them (`merge-products.ts`); `getCatalog()` is reused by the cart. `CartModule` (`cart/`) owns the cookie cart: pure operations and the injectable `CartService` in `cart.service.ts`, cookie codec in `cart.cookie.ts`, zod bodies in `cart.schemas.ts`. Shared app setup (prefix, cookie parsing) is `configureApp()` in `app.setup.ts`, used by `main.ts` and tests. New feature modules get registered in `app.module.ts`.

**Tests.** Vitest + SWC, specs next to the code (`apps/api/src/**/*.spec.ts`). HTTP tests boot the real app with a stubbed `UpstreamClient` via `createTestApp()` and read the real upstream JSON via `loadUpstreamData()` (`src/testing/`). Run one file with `npm test -w apps/api -- <name>`.

**Web.** `app/layout.tsx` loads fonts (`--font-serif` Source Serif 4, `--font-body` Questrial) and renders `Header` (a Server Component) around every page. `app/page.tsx` loads products server-side and renders the client `ProductConfigurator`. The layout also loads the cart server-side (`lib/server-api.ts` forwards the request cookie) and seeds `components/cart/CartProvider.tsx`; the header's `CartLink` and the `/cart` page (`CartView`) read it via `useCart()`, and mutations go through the `/api/*` rewrite. Styling is plain CSS in `app/globals.css` using `:root` color tokens and BEM-style class names (`site-header__cart`); keep to that, no CSS framework. Product images: `public/images/<imageKey>.jpg`.

## Upstream data gotchas

`apps/api/src/upstream/upstream.types.ts` documents provider shapes, but the actual data in `services/upstream/data/` deviates. Validate/normalize at runtime in the BFF rather than trusting the types:

- Catalog prices are **strings of cents**; `salePriceCents` may be set (active promotion) or `null`.
- Catalog items can be `status: "discontinued"`.
- Content joins on `handle` ↔ catalog `productHandle`, but casing differs (`"Zenhaven"` vs `"zenhaven"`).
- Content includes products with no catalog entry (`saatva-youth`).
- Some `reviews.average` / `reviews.count` values are strings (`"4.0"`, `"1876"`).
- `descriptionHtml` is declared "trusted HTML authored in the CMS", but the BFF sanitizes it anyway with an allowlist (decision D7); never render it unsanitized.
- A content API v2 is known to be coming (renamed fields, lowercase slugs, ratings on a 10-point scale). Keep content mapping isolated in one adapter so a version change doesn't ripple into the web app.

## Working agreements

- Spec-driven: specs in `docs/specs/` are reviewed and approved by the user before implementation starts. Implementation follows the approved spec; scope changes go back to the spec first.
- Work happens on a feature branch, never directly on `main`.
- Keep scope to the README's shopper stories; extras only if time allows and noted as such.
- `npm install && npm run dev` must work from a clean checkout; commit `package-lock.json` changes with any dependency change.
