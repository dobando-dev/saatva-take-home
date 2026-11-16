# 00 — Overview: Mattress configurator and cart

Status: **Approved 2026-11-16** · Date: 2026-11-16 · Branch: `feature/configurator-and-cart`

Feature specs: [01-configurator](./01-configurator.md) · [02-cart](./02-cart.md)

## Intent

Saatva's take-home (README) asks for a small slice of their storefront: Next.js → NestJS BFF → third-party upstreams. The deliverable is reviewed in a live pairing session, so the goal is a **focused, well-reasoned slice that is easy to walk through and defend**, not a polished everything. Budget: 2–3 hours of build; due 2026-11-17 noon.

## Goals (the README's shopper stories)

1. Choose between mattresses and see each one's name, price, image, rating and description.
2. Add a mattress to the cart and see the cart count update.
3. View the cart, change quantities, remove items, and see an accurate total.
4. Refresh the page and still have the cart.

## Constraints

- The web app gets all data through the BFF and must not know which upstream anything comes from. No upstream field names or shapes reach the web app.
- `services/upstream/` is third-party: never modified (enforced by a hook). Its data quirks are handled in the BFF.
- No database. Cart persistence approach chosen below.
- `npm install && npm run dev` must work from a clean checkout. Node 26.
- Styling: plain CSS in `app/globals.css` with the existing tokens and BEM-style class names. No CSS framework, no component library.

## Non-goals

Checkout, accounts/auth, product variants (size, firmness), inventory, tax/shipping, multi-currency, i18n, selected-mattress-in-URL, a web-side test runner, the content API v2 migration (see below), caching/retries (talking points only).

## Anti-goals (a failure even if it "works")

- Upstream shapes or quirks leaking into the web app.
- The browser deciding prices or totals.
- Specs or abstractions bigger than the code they describe; anything we couldn't explain line by line in the pairing session.

## Architecture

```
Browser ──(relative /api/*, same-origin via Next rewrite)──┐
                                                           ▼
Next.js (apps/web, :3000)                        NestJS BFF (apps/api, :4000)
  Server Components ──(API_URL + forwarded Cookie)──▶  /api/products  ──▶ catalog v1 ┐ upstream
                                                       /api/cart/*    ──▶ catalog v1 ┘ (:4100)
                                                       (products also ─▶ content v1)
```

- **Products:** the BFF fetches catalog and content **in parallel** (2 s timeout each), validates and normalizes both, and merges them into one product list. Catalog failure → 503. Content failure → products still returned, content fields `null` (degraded, logged).
- **Cart:** stored in an **HttpOnly cookie that only the BFF reads and writes**, holding product IDs and quantities only. Every cart read re-validates the lines against the live catalog and re-prices them. The cart never depends on the content service.
- **Web:** `app/layout.tsx` loads the cart server-side (forwarding the request cookie) and seeds a client `CartProvider`; the header count and cart page read from it. Mutations go from the browser to `/api/cart/*` through the rewrite; the BFF's response (full cart + `Set-Cookie`) replaces client state. The server is always the source of truth.

## Decision log

Each entry: the decision, why, and the alternative we'd raise in the pairing session.

### D1 · Cart in a BFF-owned HttpOnly cookie

- **Decision:** the cookie holds `[[productId, qty], …]` only; every read re-prices from the catalog.
- **Why:** survives API restarts and dev-server reloads (important mid-pairing), needs no storage code, is server-readable so the header count is right on first paint, and tampering can't change prices.
- **Alternatives:** in-memory BFF store keyed by cart ID (lost on restart); localStorage (count flashes 0, server can't see it). With a real store, the cookie shrinks to a cart ID and lines move to Redis/Postgres behind a repository.

### D2 · zod for runtime validation in the BFF

- **Decision:** normalize upstream data with **zod** schemas; reuse them for request bodies.
- **Why:** `upstream.types.ts` doesn't match reality (string numbers, casing); one tool covers both upstream responses and request bodies.
- **Alternatives:** hand-rolled guards; class-validator (DTO-only, doesn't help with upstream parsing).

### D3 · Content mapping isolated in `content.mapper.ts`

- **Decision:** all content-API field mapping lives in one adapter.
- **Why:** a content API v2 (renamed fields, 10-point ratings) is coming (`origin/v2-migration-doc`); the migration should be a one-file change the web never sees.
- **Alternatives:** implement v2 now (not possible: the mock only serves v1).

### D4 · Ratings always on a 5-point scale

- **Decision:** `rating.average` in the public contract is always out of 5.
- **Why:** the BFF owns the scale; a v2 10-point source gets divided by 2 in the adapter.

### D5 · Product `id` = SKU; image as `{ src, alt }`

- **Decision:** `id` is the catalog SKU; `image.src` = `/images/<imageKey>.jpg`, resolved in the BFF.
- **Why:** the BFF is _for_ this frontend; resolving the path there keeps `imageKey` (an upstream concept) out of the web.
- **Alternatives:** return `imageKey` and resolve in the web (leaks an upstream concept).

### D6 · Sale pricing

- **Decision:** `priceCents` = what the shopper pays; `compareAtPriceCents` = list price when on sale, else `null`.
- **Why:** matches the data (Loom & Leaf $1,199 sale vs $1,299 list); the UI shows the struck-through list price.
- **Alternatives:** the mock shows $1,299 only; we treat the mock as layout guidance and the data as truth.

### D7 · `descriptionHtml` sanitized in the BFF

- **Decision:** the BFF sanitizes `descriptionHtml` with **`sanitize-html`** and a strict allowlist before it reaches the web: tags `p`, `strong`, `em`, `b`, `i`, `ul`, `ol`, `li`, `br`; **no attributes**. Everything else is stripped (tags removed, text kept; `script`/`style` removed with their content). An empty result becomes `null`. The web renders the sanitized HTML.
- **Why:** the provider calls it "trusted HTML authored in the CMS", but that trust is outside our control: a compromised or careless CMS edit would otherwise become stored XSS on the storefront. Rendering third-party HTML unsanitized is a security debt that tends to stay on the todo list, so it's done now. The allowlist covers every tag the real data uses (`p`, `strong`, `ul`, `li`).
- **Alternatives:** DOMPurify (needs a DOM, i.e. jsdom, on the server; heavier); sanitizing in the web (the BFF owns the contract, so the web should receive safe HTML); rendering as plain text (loses the formatting).

### D8 · Contract types duplicated in both apps

- **Decision:** `*.types.ts` copies in `apps/api` and `apps/web`.
- **Why:** two small interfaces; a shared package is overhead at this size.
- **Alternatives:** shared `packages/contracts` or OpenAPI codegen.

### D9 · Absolute quantities, controls disabled while pending

- **Decision:** quantity changes send the **absolute** quantity; the UI disables cart controls while a request is in flight.
- **Why:** two quick clicks against a cookie cart are last-write-wins; absolute values plus disabled controls make that safe.
- **Alternatives:** optimistic updates with reconciliation.

### D10 · Plain CSS + BEM, mobile at ≤ 768 px

- **Decision:** stacked layout below 768 px.
- **Why:** matches the existing code; the mock is desktop-only.

### D11 · Contract naming rule

- **Decision:** no upstream **shapes or upstream-only concepts** in our API (`productHandle`, `displayName`, `imageKey`, `reviews`, `salePriceCents`, `handle`). Names that are simply accurate in our domain (`priceCents`, `headline`, `descriptionHtml`) are kept.
- **Why:** the point is decoupling, not avoiding every word the upstream also uses; `descriptionHtml` honestly says the field is HTML.
- **Alternatives:** rename everything (churn with no decoupling benefit).

### D12 · Header logo restyled to the mock

- **Decision:** lowercase, accent color; CSS only.
- **Why:** C-10 compares against the mock; it's a two-line change.
- **Alternatives:** keep the existing uppercase serif.

## Testing strategy

- **Task 0 (timeboxed 15 min):** prove a test runner works with Nest 12 + TypeScript 6, including one test that boots a Nest testing module (DI + decorators). Preference: Vitest (with an SWC plugin for decorator metadata); fallback Jest + ts-jest; last resort Node's built-in `node:test` for pure functions only. Wire it into `npm test` so `npm run verify` runs it.
- **BFF unit tests** for the pure parts: catalog/content normalization (one test per data quirk), description sanitization, merge, cart operations, pricing, cookie encode/decode.
- **BFF HTTP tests** (supertest against the Nest app with a stubbed `UpstreamClient`): products happy path, catalog-down 503, content-down degraded; cart cookie round trip and validation errors. App setup (global prefix, cookie parsing) lives in one `configureApp()` used by `main.ts` and the tests so they can't drift.
- **Web:** no test runner (non-goal). Verified in a real browser against the acceptance criteria at desktop and mobile widths, including upstream failure modes (`UPSTREAM_FAIL_SERVICE`, `UPSTREAM_FAILURE_RATE`).
- Acceptance criteria IDs (`C-*`, `K-*`) appear in test names for traceability.
- **Fixtures:** happy-path tests read the provided JSON in `services/upstream/data/` (read-only) so they test the real quirks; edge cases the data doesn't contain (discontinued item, invalid prices, out-of-range ratings) use small inline fixtures through the stubbed `UpstreamClient`.

## Priorities and build order

Build in vertical slices so the branch is demo-able after each one: **products BFF → configurator UI → cart API → header count + cart page → README notes**. If time runs short, cut from the bottom:

- **Must:** everything in the four shopper stories; description sanitization (D7); normalization and cart-operation unit tests; persistence across refresh and API restart.
- **Should:** HTTP tests for upstream failure modes; struck-through compare-at price; mobile layouts for both pages.
- **Could:** arrow-key navigation on the toggle; the cart page's "Try again" flow; header logo restyle (D12).

## Delivery

- One commit per plan task on the feature branch, each passing `npm run verify`.
- Finish with a short **"Notes for reviewers"** section appended to the README: how to run and test, the decision log summary, and "with more time".
- Before sending: fresh clone → `npm install && npm run dev` works; repo flipped public.

## With more time (pairing-session talking points)

Short-TTL catalog cache and one retry on upstream 503s · signed cart cookie (D1: not needed while the server trusts nothing in it beyond product IDs and quantities, but required the moment it carries anything trusted) / real cart store with an unguessable cart ID · content v2 migration · shared contract package or OpenAPI · Playwright smoke test · selected mattress in the URL · observability (request IDs, upstream latency metrics) · Sass for styling (partials per component, a breakpoint variable/mixin instead of the repeated `768px` literal; any CSS is valid SCSS, so the switch is `npm i sass` + renaming files) · product badges on the configurator (content already sends `badges`, e.g. "Best seller", "Natural latex"; add `badges: string[]` to the contract, map it in `content.mapper.ts`, and render pills next to the product name).
