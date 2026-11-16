# Saatva Storefront Exercise

Thanks for spending time with us! This exercise is a small slice of how our storefront works: a Next.js frontend, a NestJS BFF (backend-for-frontend), and third-party "upstream" services it pulls data from.

Part of the app is already wired up. Your job is to build the rest.

**We don't expect this to take more than a few hours, however you choose to work.** We'd rather see a focused, well-reasoned slice than a polished everything. Unfinished is fine, and so are shortcuts. We'll talk about what you'd change with more time and resources in the pairing session.

## AI tools

Use whatever tools you'd normally use at work, including AI assistants. We do the same.

In the follow-up pairing session, we'll walk through your code together.

## Getting started

Requires Node 26 or later. With nvm, `nvm install` installs the latest Node 26 release from `.nvmrc`, including recent security fixes.

```bash
nvm install
npm install
npm run dev
```

This starts three processes:

| Process  | URL                                | What it is                                                       |
| -------- | ---------------------------------- | ---------------------------------------------------------------- |
| upstream | http://localhost:4100              | Mock third-party catalog + content services. **We don't control these, so don't change them.** |
| api      | http://localhost:4000/api/health   | NestJS BFF. Yours to change.                                     |
| web      | http://localhost:3000              | Next.js app. Yours to change.                                    |

Upstream endpoints:

- `GET http://localhost:4100/catalog/v1/products`: products and pricing
- `GET http://localhost:4100/content/v1/products`: marketing copy and reviews

BFF endpoints (`http://localhost:4000/api`):

- `GET /api/health`: health check
- **your routes:** add them to the BFF in `apps/api/src/`. There's a stub in `products/` to start from.

## The exercise: mattress configurator and cart

Use `docs/mock.png` as your design guide for the configurator. It's desktop only, so you decide how it adapts to mobile. There's no mock for the cart, so design it however you like.

### As a shopper, I can

- choose between the mattresses and see each one's name, price, image, rating, and description
- add a mattress to my cart and see the cart count update
- view my cart, change quantities, remove items, and see an accurate total
- refresh the page and still have my cart

### Constraints

- The web app gets its data through the BFF and doesn't know which upstream service anything comes from.
- There's no database set up for this exercise, and you don't need to add one. Pick whatever way of saving the cart fits the time you have, and be ready to talk about what you'd do differently with more time and a real data store.

Start with the TODOs in the code. Fonts are already loaded in `app/layout.tsx`, and product images live in `apps/web/public/images`.

If you have time left, add anything you think a real storefront needs.

## Submitting

Clone this repo to get started. When you're done, send us your work whichever way is easiest:

- **Your own repo:** push it to a new public repo on your GitHub account and send us the link
- **A zip:** zip the project (without `node_modules`, but with the `.git` folder) and send us a download link

Either way, make sure `npm install && npm run dev` works from a clean checkout.

Questions? Reach out anytime. Asking is encouraged, not penalized.

---

## Notes for reviewers

### Run and test

```bash
nvm install && npm install
npm run dev        # upstream :4100, BFF :4000, web :3000
npm test           # BFF unit + HTTP tests (Vitest + supertest), 136 tests
npm run verify     # Prettier check + typecheck of both apps + tests
```

Try the failure modes: `UPSTREAM_FAIL_SERVICE=content npm run dev` (products still render, without rating/description) and `UPSTREAM_FAIL_SERVICE=catalog npm run dev` (friendly error; an empty cart still renders, a cart with items shows a retry).

### What's built

- **BFF `GET /api/products`**: fetches catalog and content in parallel (2 s timeout each), validates both with zod, normalizes the upstream quirks (string prices, sale prices, discontinued items, handle casing, orphan content, string ratings), sanitizes the description HTML and merges everything into one contract the BFF owns.
- **BFF cart API** (`GET /api/cart`, `POST /api/cart/items`, `PUT|DELETE /api/cart/items/:productId`): the cart lives in an HttpOnly cookie that holds only product IDs and quantities, and every read re-prices from the live catalog.
- **Configurator** (`/`) per the mock, with an accessible segmented control (radiogroup, arrow keys), sale price with the list price struck through, star rating, and a stacked layout on mobile.
- **Header count and cart page** (`/cart`): the cart is loaded server-side in the root layout, so the count is right on first paint; quantity, remove, totals, and empty/error states.

### Key decisions (full log in [`docs/specs/00-overview.md`](docs/specs/00-overview.md))

- **Cart in a BFF-owned cookie (D1).** Survives refreshes and API restarts with no storage code, and the server can read it. The cookie never holds a price, so tampering can't change what anyone pays. It isn't signed, because the server trusts nothing in it beyond IDs and quantities (see "With more time").
- **zod at the BFF boundary (D2).** The provider types don't match the data, so upstream responses and request bodies are validated at runtime.
- **One content adapter (D3, D4).** A content API v2 is coming (renamed fields, 10-point ratings; v1 is turned off December 15). The mapping change is confined to `content.mapper.ts`, plus the endpoint path (`/content/v2/products`) in `UpstreamClient`, and the contract always uses a 5-point scale.
- **Sale pricing (D6).** The data has Loom & Leaf on sale ($1,199 vs $1,299), so the contract has `priceCents` and `compareAtPriceCents`, even though the mock shows one price.
- **Description HTML is sanitized (D7)** with a strict allowlist and no attributes, even though the provider calls it trusted. Third-party HTML rendered raw is stored XSS waiting to happen.
- **No upstream names past the BFF (D11).** Fields like `productHandle`, `imageKey` or `reviews` never reach the web app.

### Verification

BFF behavior is covered by unit and HTTP tests named after the acceptance criteria in [`docs/specs/`](docs/specs/). The web app has no test runner (a deliberate scope cut); it was checked in headless Chrome at 1280 px and 375 px against the same criteria, including double-click protection, first-paint count, keyboard navigation and the failure modes.

### With more time

Short-TTL catalog cache and one retry on upstream 503s · signed cart cookie, or a real cart store with an unguessable cart ID · content v2 migration · shared contract package or OpenAPI · Playwright smoke tests · selected mattress in the URL · observability (request IDs, upstream latency metrics) · Sass · product badges (the content service already sends them).

### Process

Built spec-first with Claude Code: specs in [`docs/specs/`](docs/specs/), the implementation plan in [`docs/superpowers/plans/`](docs/superpowers/plans/), one reviewed commit per task.
