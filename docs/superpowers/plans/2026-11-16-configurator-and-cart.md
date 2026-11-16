# Configurator and Cart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four README shopper stories: a mattress configurator fed by a normalizing NestJS BFF, and a cookie-backed cart with a header count and a cart page.

**Architecture:** The BFF fetches catalog and content in parallel, validates both with zod, sanitizes description HTML and merges them into one BFF-owned `Product` contract. The cart lives in an HttpOnly cookie of `[productId, quantity]` pairs that only the BFF reads and writes; every read re-prices from the live catalog. The Next.js app loads the cart server-side in the root layout (forwarding the cookie), seeds a client `CartProvider`, and sends mutations through the `/api/*` rewrite.

**Tech Stack:** Node 26 · NestJS 12.3.2 · Next.js 16.4.3 / React 19.3.1 · TypeScript 6.0.3 · zod 4.6.7 · sanitize-html 2.18.2 · cookie-parser 1.4.7 · Vitest 5.1.0 + unplugin-swc 2.0.0 + @swc/core 1.16.22 · @nestjs/testing 12.5.1 · supertest 7.3.2

**Spec:** `docs/specs/00-overview.md` (decisions D1–D12, testing strategy, priorities), `docs/specs/01-configurator.md` (C-1–C-13), `docs/specs/02-cart.md` (K-1–K-15). Read the spec sections a task cites before starting it.

## Global Constraints

- Never modify anything under `services/upstream/` (a hook blocks it). Tests may **read** `services/upstream/data/*.json`.
- No upstream field names in any BFF response: `productHandle`, `displayName`, `imageKey`, `reviews`, `handle`, `salePriceCents` (D11). Build response objects field by field; never spread upstream objects.
- Pin exact dependency versions (no `^`/`~`), installed with `npm install -w apps/<app> --save-exact`; commit `package-lock.json` with any dependency change.
- Plain CSS in `apps/web/app/globals.css`, BEM-style class names, existing `:root` tokens; one breakpoint `@media (max-width: 768px)`; no CSS framework or component library (D10).
- Formatting: Prettier (no semicolons, single quotes, trailing commas, width 100). The edit hook formats automatically; `npm run format` fixes anything else.
- Every task ends with `npm run verify` passing (format check + typecheck of both apps + tests) before its commit.
- Test names start with the acceptance criterion ID when one applies (`'C-2 …'`, `'K-7 …'`).
- Commit on `feature/configurator-and-cart` only, one commit per task, imperative sentence-case subject (e.g. `Add catalog mapper`), message ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Error copy (exact): products 503 message `Product catalog is temporarily unavailable`; cart 503 message `Cart is temporarily unavailable`; configurator load failure `We couldn't load mattresses right now. Please try again in a moment.`; empty catalog `No mattresses are available right now.`; empty cart `Your cart is empty.`

## Review Focus

1. **Blank or null rating values** (`""`, `" "`, `null`) must give `rating: null`, never `0` (`Number("") === 0`). Test in Task 3.
2. **Duplicate SKU in the catalog** must keep only the first entry; duplicates would break cart lookups and React keys. Test in Task 2.
3. **Unsafe `imageKey`** (`../secret`, `a.jpg?x`) must drop the product rather than be interpolated into an image path. Test in Task 2.
4. **Oversized or hostile cart cookie** (raw value > 4096 chars, empty or > 64-char product IDs, objects instead of pairs) must decode to an empty cart without throwing. Test in Task 6.
5. **An upstream that never answers** must fail within the timeout (2 s default) so the products page degrades instead of hanging. Test in Task 2 (client timeout).

---

### Task 1: API test harness and shared app setup

Spec: 00-overview "Testing strategy" (Task 0 spike, `configureApp()`).

**Files:**

- Create: `apps/api/vitest.config.mts`, `apps/api/tsconfig.build.json`, `apps/api/src/app.setup.ts`, `apps/api/src/testing/create-test-app.ts`, `apps/api/src/testing/upstream-data.ts`
- Modify: `apps/api/package.json` (dev deps + `"test": "vitest run"`), `apps/api/nest-cli.json` (`"tsConfigPath": "tsconfig.build.json"` under `compilerOptions`), `apps/api/src/main.ts`
- Test: `apps/api/src/app.http.spec.ts`

**Interfaces:**

- Produces:
  - `configureApp(app: INestApplication): INestApplication` in `src/app.setup.ts`: sets global prefix `api` (Task 7 adds cookie parsing here). `main.ts` calls it instead of `setGlobalPrefix`.
  - `type UpstreamStub = { getCatalogProducts(): Promise<unknown>; getContentProducts(): Promise<unknown> }` and `createTestApp(upstream: UpstreamStub): Promise<INestApplication>` in `src/testing/create-test-app.ts`: compiles `AppModule` with `.overrideProvider(UpstreamClient).useValue(upstream)`, applies `configureApp`, calls `init()`.
  - `loadUpstreamData(file: 'catalog-products.json' | 'content-products.json'): unknown` (reads `services/upstream/data/<file>` via `path.resolve(__dirname, '../../../../services/upstream/data', file)`) and `failing(): Promise<never>` (rejects with `Error('Upstream request failed (503)')`) in `src/testing/upstream-data.ts`.

- [ ] **Step 1: Install dev dependencies (exact):** `vitest@5.1.0 unplugin-swc@2.0.0 @swc/core@1.16.22 @nestjs/testing@12.5.1 supertest@7.3.2 @types/supertest@7.2.1` into `apps/api`.
- [ ] **Step 2: Configure Vitest.** `vitest.config.mts`: `test.include: ['src/**/*.spec.ts']`, `environment: 'node'`, plugin `swc.vite({ module: { type: 'es6' } })` (needed for decorator metadata). Tests import `describe/it/expect` from `vitest` explicitly (no globals). `tsconfig.build.json` extends `tsconfig.json` and excludes `src/**/*.spec.ts` and `src/testing/**`, so `nest build` skips test code while `npm run typecheck` still checks it.
- [ ] **Step 3: Write the failing test** `app.http.spec.ts`:

```ts
it('boots the app with DI and serves GET /api/health', async () => {
  const app = await createTestApp({ getCatalogProducts: failing, getContentProducts: failing })
  const res = await request(app.getHttpServer()).get('/api/health')
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ status: 'ok' })
  await app.close()
})
```

- [ ] **Step 4: Run** `npm test -w apps/api`. Expected: FAIL (`configureApp` / `createTestApp` missing).
- [ ] **Step 5: Implement** `configureApp`, the two testing helpers, and switch `main.ts` to `configureApp`.
- [ ] **Step 6: Run** `npm test -w apps/api`. Expected: 1 passed. **Timebox: 15 minutes for Steps 2–6.** If decorator metadata or DI does not work with Vitest + SWC in that time, stop and report BLOCKED with the exact error; do not switch to another runner on your own.
- [ ] **Step 7: Run** `npm run build -w apps/api` and confirm `apps/api/dist` contains no `.spec.js` and no `testing/` directory. Then `npm run verify`. Expected: both pass.
- [ ] **Step 8: Commit** `Add Vitest test harness and shared app setup`.

---

### Task 2: Upstream client timeout and catalog mapper

Spec: 01-configurator "Normalization rules", "Failure behavior" (2 s timeout); D2, D5, D6.

**Files:**

- Modify: `apps/api/src/upstream/upstream.client.ts`
- Create: `apps/api/src/products/product.types.ts`, `apps/api/src/products/catalog.mapper.ts`
- Test: `apps/api/src/upstream/upstream.client.spec.ts`, `apps/api/src/products/catalog.mapper.spec.ts`

**Interfaces:**

- Produces (`product.types.ts`):

```ts
export interface ProductImage {
  src: string
  alt: string
}
export interface ProductRating {
  average: number
  count: number
} // 5-point scale (D4)
export interface Product {
  id: string
  name: string
  priceCents: number
  compareAtPriceCents: number | null
  currency: string
  image: ProductImage
  rating: ProductRating | null
  headline: string | null
  descriptionHtml: string | null
}
export interface ProductsResponse {
  products: Product[]
}
/** Internal (never serialized): a validated, active catalog item. */
export interface CatalogItem {
  id: string
  handle: string
  name: string
  priceCents: number
  compareAtPriceCents: number | null
  image: ProductImage
}
export interface Catalog {
  currency: string
  items: CatalogItem[]
}
export interface ProductContent {
  headline: string | null
  descriptionHtml: string | null
  rating: ProductRating | null
}
export class UpstreamDataError extends Error {}
export class CatalogUnavailableError extends Error {}
```

- Produces (`catalog.mapper.ts`): `parseCents(value: unknown): number | null` and `mapCatalog(raw: unknown, warn?: (message: string) => void): Catalog`.
- Produces (`UpstreamClient`): `getCatalogProducts(): Promise<unknown>`, `getContentProducts(): Promise<unknown>`. Return `unknown` on purpose: `upstream.types.ts` stays as documentation of what the provider claims, and the mappers validate what actually arrives.

- [ ] **Step 1: Write failing client tests** (`upstream.client.spec.ts`). Start a `node:http` server on port 0 per test, set `UPSTREAM_URL=http://127.0.0.1:<port>` and `UPSTREAM_TIMEOUT_MS` with `vi.stubEnv`, construct `new UpstreamClient()` after stubbing, and close the server in `afterEach` (`server.closeAllConnections()`).
  - `'rejects when the upstream does not answer within UPSTREAM_TIMEOUT_MS'`: server never responds, timeout `50` → `getCatalogProducts()` rejects, elapsed < 1000 ms.
  - `'rejects on a non-2xx response'`: server answers 503 → rejects.
  - `'returns the parsed JSON body'`: server answers `{"ok":true}` → resolves to `{ ok: true }`.
- [ ] **Step 2: Run** `npm test -w apps/api -- upstream.client`. Expected: the timeout test FAILS (it hangs until the test times out).
- [ ] **Step 3: Implement.** Read `UPSTREAM_URL` (default `http://localhost:4100`) and `UPSTREAM_TIMEOUT_MS` (default `2000`) in the constructor, not at module load; pass `signal: AbortSignal.timeout(timeoutMs)` to `fetch`; keep the existing warn log + throw on non-2xx; return `Promise<unknown>`.
- [ ] **Step 4: Run** the client tests. Expected: 3 passed.
- [ ] **Step 5: Write failing mapper tests** (`catalog.mapper.spec.ts`), using `loadUpstreamData('catalog-products.json')` for the real data and small inline objects otherwise:
  - `'C-1 maps the provided catalog in catalog order'` → `items.map(i => i.id)` equals `['SAT-CLASSIC-Q', 'LNL-Q', 'ZEN-Q']`, `currency === 'USD'`.
  - `'C-2 applies an active sale'` → LNL-Q `{ priceCents: 119900, compareAtPriceCents: 129900 }`; SAT-CLASSIC-Q `{ priceCents: 99900, compareAtPriceCents: null }`.
  - `'D5 resolves the image'` → LNL-Q `image` equals `{ src: '/images/loom-carousel.jpg', alt: 'Loom & Leaf mattress' }`; `handle === 'loom-and-leaf'`.
  - `'C-5 excludes discontinued items'` → an inline item with `status: 'discontinued'` is absent.
  - `'drops items with an invalid list price and warns'` → each of `'12.50'`, `'-100'`, `'0'`, `'abc'`, `null` drops the item; `warn` is called.
  - `'ignores a sale that is invalid or not lower than list'` → sale `'129900'` with list `'129900'` gives compare-at `null`; sale `'abc'` is ignored.
  - `'accepts integer prices sent as numbers'` → `priceCents: 99900` (number) maps to `99900`.
  - `'Review focus: duplicate SKU keeps the first'` → two items with sku `'X'`, first named `'First'` → one item named `'First'`.
  - `'Review focus: unsafe imageKey drops the product'` → `'../secret'` and `'a.jpg?x'` each drop the item.
  - `'throws UpstreamDataError when the body is not a catalog'` → `{}`, `[]`, `null`, and `{ meta: { currency: 'usd' }, data: [] }` each throw.
- [ ] **Step 6: Run** `npm test -w apps/api -- catalog.mapper`. Expected: FAIL (module missing).
- [ ] **Step 7: Install** `zod@4.6.7` into `apps/api` (exact), then **implement** `parseCents` and `mapCatalog`. Rules:
  - The top level must be `{ meta: { currency: /^[A-Z]{3}$/ }, data: unknown[] }`, else throw `UpstreamDataError`. An invalid currency would make `Intl.NumberFormat` throw in the web.
  - Each item is checked with a zod schema via `safeParse`; failures warn and skip the item.
  - Field rules: `sku` and `displayName` are non-empty trimmed strings; `productHandle` is a string; `imageKey` matches `/^[A-Za-z0-9_-]+$/`.
  - Status: only `'active'` is kept.
  - `parseCents`: accepts a string matching `/^\d+$/` or an integer number; returns null when the value is ≤ 0, not a safe integer, or anything else.
  - Sale: applied only when it parses and is lower than the list price.
  - Duplicate SKU: the later one is skipped with a warning.
- [ ] **Step 8: Run** the mapper tests, then `npm run verify`. Expected: all pass.
- [ ] **Step 9: Commit** `Add upstream timeout and catalog mapper`.

---

### Task 3: Content mapper and description sanitizer

Spec: 01-configurator "Normalization rules"; D3, D4, D7; C-3, C-4, C-9.

**Files:**

- Create: `apps/api/src/products/sanitize-description.ts`, `apps/api/src/products/content.mapper.ts`
- Test: `apps/api/src/products/sanitize-description.spec.ts`, `apps/api/src/products/content.mapper.spec.ts`

**Interfaces:**

- Consumes: `ProductContent`, `ProductRating`, `UpstreamDataError` from Task 2.
- Produces: `sanitizeDescription(html: string): string | null`; `normalizeHandle(handle: string): string` (`trim().toLowerCase()`); `mapContent(raw: unknown, warn?: (message: string) => void): Map<string, ProductContent>` keyed by normalized handle.

- [ ] **Step 1: Write failing sanitizer tests** (input → exact expected output):
  - `'C-9 keeps the provided formatting'` → the Saatva Classic `descriptionHtml` from `content-products.json` comes back unchanged (string equality).
  - `'C-9 removes <script> and its content'`: `'<p>Hi</p><script>alert(1)</script>'` → `'<p>Hi</p>'`.
  - `'C-9 removes event-handler attributes'`: `'<p onclick="x()">Hi</p><img src=x onerror="alert(1)">'` → `'<p>Hi</p>'`.
  - `'C-9 removes javascript: links and keeps their text'`: `'<a href="javascript:alert(1)">Click</a>'` → `'Click'`.
  - `'C-9 removes iframes'`: `'<iframe src="https://evil.example"></iframe><p>ok</p>'` → `'<p>ok</p>'`.
  - `'C-9 returns null when nothing is left'`: `'<script>x</script>'` and `''` → `null`.
- [ ] **Step 2: Run** `npm test -w apps/api -- sanitize-description`. Expected: FAIL.
- [ ] **Step 3: Install** `sanitize-html@2.18.2` and `@types/sanitize-html@2.16.2` (dev) into `apps/api`, then **implement** with `allowedTags: ['p', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'br']` and `allowedAttributes: {}`, keeping the library defaults for discarding (tags dropped, text kept; `script`/`style` dropped with their content). Trim the result; `''` → `null`.
- [ ] **Step 4: Run** the sanitizer tests. Expected: all pass.
- [ ] **Step 5: Write failing content tests** (`loadUpstreamData('content-products.json')` + inline):
  - `'C-3 joins Zenhaven despite the casing mismatch'` → `get('zenhaven')` has headline `'Flippable natural latex, two firmness levels in one'` and rating `{ average: 4.5, count: 2140 }`.
  - `'C-4 coerces string ratings'` → `get('loom-and-leaf')!.rating` equals `{ average: 4, count: 1876 }`.
  - `'rating is null when out of range or malformed'` → `{ average: 7, count: 10 }`, `{ average: 4, count: -1 }`, `{ average: 4, count: 1.5 }`, and a missing `reviews` each give `null`.
  - `'Review focus: blank or null rating values give null, not 0'` → `{ average: '', count: '' }`, `{ average: null, count: null }`, `{ average: ' ', count: '10' }` each give `null`.
  - `'headline is trimmed; a missing or blank headline is null'`.
  - `'descriptionHtml is sanitized'` → an entry with `'<p>Hi</p><script>x</script>'` maps to `'<p>Hi</p>'`; a non-string description → `null`.
  - `'duplicate handles: the first wins'` → entries `'Zenhaven'` then `'zenhaven'` with different headlines → the first headline.
  - `'skips entries without a string handle'`.
  - `'throws UpstreamDataError when the body is not an array'` → `{}`, `null`.
- [ ] **Step 6: Run** `npm test -w apps/api -- content.mapper`. Expected: FAIL.
- [ ] **Step 7: Implement** `normalizeHandle` and `mapContent`. This file is the content-v2 swap point (D3); add a one-line comment saying a 10-point source would be divided by 2 here (D4). Rules:
  - Each field is handled independently: an invalid headline, rating or description becomes `null` without dropping the entry.
  - Rating average: a finite number, or a string matching `/^\d+(\.\d+)?$/`, within 0–5.
  - Rating count: a non-negative integer, or a string matching `/^\d+$/`.
  - If either rating part is invalid, the whole `rating` is `null`.
- [ ] **Step 8: Run** the content tests, then `npm run verify`. Expected: all pass.
- [ ] **Step 9: Commit** `Add content mapper and description sanitizer`.

---

### Task 4: Products service and `GET /api/products`

Spec: 01-configurator "API", "Failure behavior"; C-1–C-9.

**Files:**

- Create: `apps/api/src/products/merge-products.ts`
- Modify: `apps/api/src/products/products.service.ts`, `apps/api/src/products/products.controller.ts` (return type `Promise<ProductsResponse>`), `apps/api/src/products/products.module.ts` (add `exports: [ProductsService]`)
- Test: `apps/api/src/products/merge-products.spec.ts`, `apps/api/src/products/products.http.spec.ts`

**Interfaces:**

- Consumes: `mapCatalog` (Task 2), `mapContent`, `normalizeHandle` (Task 3), `createTestApp`, `loadUpstreamData`, `failing` (Task 1).
- Produces:
  - `mergeProducts(catalog: Catalog, content: Map<string, ProductContent> | null): Product[]`
  - `ProductsService.getCatalog(): Promise<Catalog>`: throws `CatalogUnavailableError` when the upstream call fails or `mapCatalog` throws. **Task 7 uses this to price the cart.**
  - `ProductsService.getProducts(): Promise<ProductsResponse>`: throws `ServiceUnavailableException('Product catalog is temporarily unavailable')` when the catalog is unavailable.

- [ ] **Step 1: Write failing merge tests:**
  - `'builds products with exactly the contract fields'` → `Object.keys(product).sort()` equals `['compareAtPriceCents', 'currency', 'descriptionHtml', 'headline', 'id', 'image', 'name', 'priceCents', 'rating']`.
  - `'a catalog item without content gets null content fields'`.
  - `'C-6 null content map gives null content fields for every product'`.
- [ ] **Step 2: Write failing HTTP tests** (`products.http.spec.ts`; real data via `createTestApp({ getCatalogProducts: async () => loadUpstreamData('catalog-products.json'), getContentProducts: async () => loadUpstreamData('content-products.json') })`):
  - `'C-1 returns the three active products in catalog order'` → 200, names `['Saatva Classic', 'Loom & Leaf', 'Zenhaven']`.
  - `'C-2 prices'` → LNL-Q 119900 / 129900; SAT-CLASSIC-Q 99900 / null.
  - `'C-3 Zenhaven has its content'` → headline set, rating `{ average: 4.5, count: 2140 }`.
  - `'C-4 Loom & Leaf rating is numeric'` → `{ average: 4, count: 1876 }`.
  - `'C-5 orphan content and discontinued items do not appear'` → the body text does not contain `'Designed for growing kids'`. With an inline catalog that adds a discontinued item, that SKU is absent.
  - `'C-6 content failing → 200 with null content'` → with `getContentProducts: failing` and again with it resolving `{}`, every product has `rating`, `headline` and `descriptionHtml` equal to `null`.
  - `'C-7 catalog failing → 503'` → with `getCatalogProducts: failing` and again resolving `{}`, status 503 and body `{ statusCode: 503, message: 'Product catalog is temporarily unavailable', error: 'Service Unavailable' }`.
  - `'C-8 no upstream field names in the response'` → `JSON.stringify(body)` contains none of `productHandle`, `displayName`, `imageKey`, `reviews`, `"handle"`, `salePriceCents`.
  - `'C-9 descriptions arrive sanitized with formatting intact'` → the Saatva Classic `descriptionHtml` equals the source string.
  - `'empty active catalog → 200 with products: []'`.
- [ ] **Step 3: Run** `npm test -w apps/api -- products`. Expected: FAIL (`mergeProducts` missing; the endpoint returns 501).
- [ ] **Step 4: Implement** `mergeProducts`. It builds each `Product` field by field (no spreading), using `currency` from the catalog and looking content up by `normalizeHandle(item.handle)`.
- [ ] **Step 5: Implement** `ProductsService`:
  - Start the catalog and the content fetch together (`Promise.allSettled`) so they run in parallel.
  - Content failing, either rejected or `mapContent` throwing, → `Logger.warn` and `content = null`.
  - Catalog failing → `Logger.error` and throw the 503.
  - Pass a `warn` callback that logs to both mappers.
  - Export `ProductsService` from `ProductsModule`.
- [ ] **Step 6: Run** the products tests, then `npm run verify`. Expected: all pass.
- [ ] **Step 7: Smoke test.** Run `npm run dev:upstream` and `npm run dev:api` in the background, then `curl -s localhost:4000/api/products`. Expected: three products, Loom & Leaf at 119900. Stop both processes.
- [ ] **Step 8: Commit** `Implement GET /api/products`.

---

### Task 5: Configurator page

Spec: 01-configurator "Web: configurator page"; D6, D7, D10; C-10–C-13. **Look at `docs/mock.png` (Read tool) before writing CSS.**

**Files:**

- Create: `apps/web/lib/types.ts`, `apps/web/lib/format.ts`, `apps/web/components/MattressToggle.tsx`, `apps/web/components/Price.tsx`, `apps/web/components/Rating.tsx`
- Modify: `apps/web/app/page.tsx`, `apps/web/components/ProductConfigurator.tsx`, `apps/web/app/globals.css`

**Interfaces:**

- Consumes: `GET /api/products` → `ProductsResponse` (Task 4).
- Produces:
  - `lib/types.ts`: `ProductImage`, `ProductRating`, `Product` and `ProductsResponse`, identical to `apps/api/src/products/product.types.ts`'s contract types (D8: duplicated on purpose; do not copy internal types).
  - `lib/format.ts`: `formatPrice(cents: number, currency: string): string` (`Intl.NumberFormat('en-US', { style: 'currency', currency })`, 0 fraction digits when `cents % 100 === 0`, else 2 → `'$1,199'`) and `formatCount(n: number): string` (`'1,876'`).
  - `<Price priceCents compareAtPriceCents currency />`: current price, plus the compare-at price in `<s>` preceded by visually hidden text `Regular price:` when set. Reused by the cart page.
  - `<MattressToggle options={{ id: string; label: string }[]} value={string} onChange={(id: string) => void} />`
  - `<ProductConfigurator products={Product[]} />`, which renders an "Add to Cart" `<button type="button" className="button button--primary">` with no handler yet; Task 8 wires it.

- [ ] **Step 1: Write the data loading.** `page.tsx` calls `apiGet<ProductsResponse>('/api/products')` in try/catch. On failure it renders `<p className="page-message">` with the exact load-failure copy. With an empty list it renders the empty copy. Otherwise it renders `<ProductConfigurator products={products} />`.
- [ ] **Step 2: Build the components** per the spec layout:
  - The `<h1>Choose Your Mattress</h1>`, a "SELECT MATTRESS TYPE" label tied to the toggle with `aria-labelledby`, and `"{name} Mattress"` as the product heading.
  - **MattressToggle:** `role="radiogroup"` with `role="radio"` buttons and `aria-checked`. Roving tabindex: the selected option is `0`, the others `-1`. Left/Up selects and focuses the previous option, Right/Down the next, wrapping around. Default selection is the first product.
  - **Rating:** hidden when `null`. Stars are an empty layer and a filled layer, with the filled layer's width set to `(Math.round(average * 2) / 2 / 5) * 100%`, plus text `4.5 (2,140 reviews)`. Stars are `aria-hidden`; the wrapper has `aria-label="Rated 4.5 out of 5, 2,140 reviews"`.
  - **Headline:** hidden when `null`.
  - **Description:** `dangerouslySetInnerHTML` (already sanitized by the BFF, D7), hidden when `null`.
  - **Image:** a plain `<img src alt>` from `product.image`. The images are 1680×640, so give `width`/`height` attributes and CSS `height: auto`.
- [ ] **Step 3: Write the CSS** in `globals.css`:
  - Desktop: two columns (image | details) as in the mock. The toggle is a segmented control with the selected option in the muted filled style. The primary button is full width in `--color-accent`.
  - `@media (max-width: 768px)`: a single column (image above details), the toggle stays on one row with options sharing the width (labels may wrap), and nothing overflows horizontally at 375 px.
  - Add a `.visually-hidden` utility.
- [ ] **Step 4: Run** `npm run verify`. Expected: pass.
- [ ] **Step 5: Smoke test.** Run `npm run dev` in the background, then `curl -s localhost:3000 | grep -c 'Saatva Classic Mattress'`. Expected: ≥ 1. Then restart with `UPSTREAM_FAIL_SERVICE=catalog npm run dev`; the page contains `We couldn&#x27;t load mattresses right now` (or the unescaped text). Stop the processes. The full visual check happens in Task 10.
- [ ] **Step 6: Commit** `Build the configurator page`.

---

### Task 6: Cart operations and cookie codec

Spec: 02-cart "Response contract", "Cookie"; D1, D9; K-7, K-8.

**Files:**

- Create: `apps/api/src/cart/cart.types.ts`, `apps/api/src/cart/cart.service.ts` (pure functions only in this task), `apps/api/src/cart/cart.cookie.ts`
- Test: `apps/api/src/cart/cart.service.spec.ts`, `apps/api/src/cart/cart.cookie.spec.ts`

**Interfaces:**

- Consumes: `Catalog`, `ProductImage` (Task 2); `mapCatalog` for test data.
- Produces (`cart.types.ts`): `type CartLine = readonly [productId: string, quantity: number]`; `MAX_QUANTITY = 10`; `MAX_LINES = 20`; `DEFAULT_CURRENCY = 'USD'`; `CartItem` and `Cart` exactly as in 02-cart "Response contract"; `emptyCart(currency: string): Cart`.
- Produces (`cart.service.ts`, pure):
  - `addLine(lines: CartLine[], productId: string, quantity: number): CartLine[]`: adds to an existing line or appends, clamped to `MAX_QUANTITY`; first-add order is kept.
  - `setLineQuantity(lines: CartLine[], productId: string, quantity: number): CartLine[] | null`: `null` when the product is not in the cart.
  - `removeLine(lines: CartLine[], productId: string): CartLine[]`
  - `priceCart(lines: CartLine[], catalog: Catalog): { cart: Cart; lines: CartLine[] }`: drops lines whose ID is not in `catalog.items` and returns the kept lines; prices come only from the catalog.
- Produces (`cart.cookie.ts`):
  - `CART_COOKIE = 'cart'`
  - `decodeCart(raw: unknown): CartLine[]`
  - `encodeCart(lines: CartLine[]): string` (`JSON.stringify`)
  - `cartCookieOptions(): { httpOnly: true; sameSite: 'lax'; path: '/'; maxAge: number; secure: boolean }`: `maxAge` is `30 * 24 * 60 * 60 * 1000` (Express takes ms); `secure` is `process.env.NODE_ENV === 'production'`.

- [ ] **Step 1: Write failing operation tests** (catalog = `mapCatalog(loadUpstreamData('catalog-products.json'))`):
  - `'addLine appends a new product with the given quantity'`; `'addLine adds to an existing line'`; `'addLine clamps at 10'` (`[['LNL-Q', 9]]` + 5 → `[['LNL-Q', 10]]`); `'addLine keeps first-add order'`.
  - `'setLineQuantity sets the absolute quantity'`; `'setLineQuantity returns null when the product is not in the cart'`.
  - `'removeLine removes the line'`; `'removeLine is a no-op when absent'`.
  - `'K-8 priceCart totals'` → lines `[['SAT-CLASSIC-Q', 1], ['LNL-Q', 2]]` give `itemCount: 3`, `totalCents: 339700`, `currency: 'USD'`, and `items[1]` equals `{ productId: 'LNL-Q', name: 'Loom & Leaf', image: { src: '/images/loom-carousel.jpg', alt: 'Loom & Leaf mattress' }, unitPriceCents: 119900, compareAtPriceCents: 129900, quantity: 2, lineTotalCents: 239800 }`.
  - `'priceCart drops unknown products and returns the kept lines'`.
- [ ] **Step 2: Write failing cookie tests:**
  - `'encodes and decodes a round trip'`.
  - `'K-7 garbage decodes to an empty cart'` → `undefined`, `''`, `'not json'`, `'{}'`, `'[["LNL-Q","2"]]'`, `'[["LNL-Q",1.5]]'`, `'[[1,2]]'`, `'[["LNL-Q"]]'`, `'[["LNL-Q",1,100]]'` (a smuggled price) and `'[{"productId":"LNL-Q","priceCents":1}]'` each give `[]`.
  - `'K-7 clamps quantities to 1–10'` → `'[["LNL-Q",999]]'` gives `[['LNL-Q', 10]]`; `'[["LNL-Q",0]]'` gives `[['LNL-Q', 1]]`.
  - `'merges duplicate product IDs'` → `'[["LNL-Q",6],["LNL-Q",7]]'` gives `[['LNL-Q', 10]]`.
  - `'keeps at most 20 lines'` → 25 distinct IDs give the first 20.
  - `'Review focus: hostile values decode to an empty cart'` → a raw string longer than 4096 chars, an empty product ID, and a 65-char product ID each give `[]`.
  - `'cookie options'` → `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 2592000000`, `secure: false`; with `vi.stubEnv('NODE_ENV', 'production')`, `secure: true`.
- [ ] **Step 3: Run** `npm test -w apps/api -- cart`. Expected: FAIL.
- [ ] **Step 4: Implement** the types, pure operations and codec. Decoding rules:
  - Return `[]` without parsing when the raw value is not a string or is longer than 4096 chars.
  - Every entry must be exactly `[string of 1–64 chars, integer]`; any violation empties the whole cart, as the spec says.
  - Clamp quantities to 1–10, merge duplicates (sum, then clamp), keep the first 20.
- [ ] **Step 5: Run** the cart tests, then `npm run verify`. Expected: all pass.
- [ ] **Step 6: Commit** `Add cart operations and cookie codec`.

---

### Task 7: Cart API endpoints

Spec: 02-cart "API", "Failure behavior", "Structure"; D2; K-1–K-10.

**Files:**

- Create: `apps/api/src/cart/cart.schemas.ts`, `apps/api/src/cart/cart.controller.ts`, `apps/api/src/cart/cart.module.ts`
- Modify: `apps/api/src/cart/cart.service.ts` (add the injectable `CartService`), `apps/api/src/app.setup.ts` (`app.use(cookieParser())`), `apps/api/src/app.module.ts` (import `CartModule`)
- Test: `apps/api/src/cart/cart.http.spec.ts`

**Interfaces:**

- Consumes: `ProductsService.getCatalog()` and `CatalogUnavailableError` (Task 4); pure functions, `decodeCart`, `encodeCart`, `cartCookieOptions` and `CART_COOKIE` (Task 6).
- Produces:
  - `cart.schemas.ts`: `addItemSchema` (`{ productId: string 1–64, quantity?: positive int, default 1 }`), `setQuantitySchema` (`{ quantity: int 1–10 }`), and `parseBody<T>(schema: z.ZodType<T>, body: unknown): T`, which throws `BadRequestException` with a readable zod issue message. Use strict ints, so `"3"` and `1.5` are rejected.
  - `CartService` (`@Injectable`, injects `ProductsService`), where `type CartResult = { cart: Cart; lines: CartLine[] }`:
    - `view(lines): Promise<CartResult>`: empty lines → `{ cart: emptyCart(DEFAULT_CURRENCY), lines: [] }` without calling the catalog.
    - `add(lines, productId, quantity): Promise<CartResult>`: unknown or inactive product → `BadRequestException('Unknown product')`.
    - `setQuantity(lines, productId, quantity): Promise<CartResult>`: not in the cart → `NotFoundException('Product is not in the cart')`.
    - `remove(lines, productId): Promise<CartResult>`
    - Every method that needs the catalog: reconcile (drop lines that aren't in the catalog), then apply the operation, then `priceCart`. `CatalogUnavailableError` → `ServiceUnavailableException('Cart is temporarily unavailable')`.
  - `CartController` (`@Controller('cart')`), routes: `GET /`, `POST /items` (`@HttpCode(200)`), `PUT /items/:productId`, `DELETE /items/:productId`. Use `@Req()` and `@Res({ passthrough: true })` with express types.
    - Mutations always call `res.cookie(CART_COOKIE, encodeCart(result.lines), cartCookieOptions())`.
    - `GET` sets the cookie only when the incoming cookie was present and `raw !== encodeCart(result.lines)`.
    - The cookie is written only after the service succeeds, so a 503 never sets a cookie.

- [ ] **Step 1: Install** `cookie-parser@1.4.7`, plus dev `@types/cookie-parser@1.4.10` and `@types/express@5.0.6`, into `apps/api`.
- [ ] **Step 2: Write failing HTTP tests** (`cart.http.spec.ts`). Real data stubs as in Task 4. Add a helper `cartCookie(res): string` that returns the `cart=…` pair from `set-cookie`, and send test cookies URL-encoded (`cart=${encodeURIComponent(json)}`).
  - `'K-1 no cookie → empty cart'` → `{ items: [], itemCount: 0, totalCents: 0, currency: 'USD' }`.
  - `'K-2 adding twice gives one line of 2 and an HttpOnly cookie'` → `unitPriceCents: 119900`, `lineTotalCents: 239800`. The `set-cookie` header matches `/^cart=/` and contains `HttpOnly`, `SameSite=Lax` and `Path=/`.
  - `'K-3 cookie round trip'` → `GET` with the returned cookie gives the same cart and **no** `set-cookie`.
  - `'K-4 PUT sets the quantity and validates it'` → `3` → quantity 3; `0`, `11`, `1.5`, `"3"` → 400; `ZEN-Q` not in the cart → 404.
  - `'K-5 DELETE removes the line; repeating it returns 200 unchanged'`.
  - `'K-6 POST rejects unknown and discontinued products and clamps at 10'` → `NOPE` → 400. With an inline catalog that contains a discontinued SKU, that SKU → 400. Quantity 7 twice → 10.
  - `'POST rejects a malformed body'` → `{ productId: 123 }`, `{}` and `{ productId: 'LNL-Q', quantity: 0 }` → 400.
  - `'K-7 hostile cookies never yield a wrong price'` → `garbage` → empty cart. `[["NOPE",1],["LNL-Q",1]]` → only LNL-Q at 119900, with `set-cookie` rewritten to `[["LNL-Q",1]]`. `[["LNL-Q",999]]` → quantity 10.
  - `'K-8 totals'` → POST SAT-CLASSIC-Q ×1 and LNL-Q ×2 → `itemCount: 3`, `totalCents: 339700`.
  - `'K-9 catalog down'` → with a cookie holding lines, `GET` and `POST` return 503 with body `{ statusCode: 503, message: 'Cart is temporarily unavailable', error: 'Service Unavailable' }` and no `set-cookie`. Without a cookie, `GET` returns 200 with the empty cart.
  - `'K-10 content down does not affect the cart'` → `getContentProducts: failing`, POST works.
- [ ] **Step 3: Run** `npm test -w apps/api -- cart.http`. Expected: FAIL (404s, no route).
- [ ] **Step 4: Implement** the schemas, `CartService`, controller and module (`imports: [ProductsModule]`); register `CartModule` and `cookieParser()`.
- [ ] **Step 5: Run** `npm test -w apps/api`, then `npm run verify`. Expected: all pass.
- [ ] **Step 6: Commit** `Add cart API with cookie persistence`.

---

### Task 8: Cart state, header count and Add to Cart

Spec: 02-cart "Web: Cart state", "Header"; 01-configurator "Add to Cart"; D9, D12; K-11, K-13, K-14.

**Files:**

- Create: `apps/web/lib/server-api.ts`, `apps/web/components/cart/CartProvider.tsx`, `apps/web/components/cart/CartLink.tsx`
- Modify: `apps/web/lib/types.ts` (add `Cart`, `CartItem`, `MAX_CART_QUANTITY = 10`), `apps/web/lib/api.ts`, `apps/web/app/layout.tsx`, `apps/web/components/Header.tsx`, `apps/web/components/ProductConfigurator.tsx`, `apps/web/app/globals.css`

**Interfaces:**

- Consumes: the cart endpoints (Task 7); `ProductConfigurator`'s inert button (Task 5).
- Produces:
  - `serverGet<T>(path: string): Promise<T>` in `lib/server-api.ts`: `fetch(API_URL + path, { headers: { Cookie: (await cookies()).toString() }, cache: 'no-store' })` using `cookies` from `next/headers`; throws on non-2xx.
  - `apiSend<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T>` in `lib/api.ts`: browser-only relative fetch with a JSON body; throws on non-2xx.
  - `CartProvider` (`'use client'`, prop `initialCart: Cart | null`) and `useCart(): { cart: Cart | null; pending: boolean; error: string | null; add(productId: string): Promise<void>; setQuantity(productId: string, quantity: number): Promise<void>; remove(productId: string): Promise<void>; refresh(): Promise<void> }`. `useCart` throws outside the provider. **Task 9 uses `setQuantity`, `remove` and `refresh`.**

- [ ] **Step 1: Implement `CartProvider`.**
  - All four actions go through one `run(request: () => Promise<Cart>)` helper.
  - If a request is already in flight, ignore the call. Guard with a `useRef`, because React state updates late and two fast clicks would both get through (K-11).
  - Otherwise set `pending`, clear `error`, and **replace** `cart` with the response. There are no optimistic updates (D9).
  - On failure, keep the previous cart and set `error` to `We couldn't update your cart. Please try again.`
  - `refresh` calls `GET /api/cart` through the rewrite.
- [ ] **Step 2: Load the cart server-side.** `layout.tsx` runs `const cart = await serverGet<Cart>('/api/cart').catch(() => null)` and wraps `<Header />` and `<main>` in `<CartProvider initialCart={cart}>`.
- [ ] **Step 3: Header.**
  - `Header` stays a Server Component and renders the logo plus `<CartLink />`.
  - `CartLink`: a `next/link` to `/cart` with the existing icon.
  - `aria-label`: `Cart` when the cart is unknown, otherwise `Cart, 1 item` / `Cart, N items`.
  - Badge: a `<span className="site-header__badge" aria-live="polite">` showing the count, empty (and hidden by CSS) when the count is 0 or the cart is unknown. Style it as the mock's small circle on the icon.
  - D12: restyle `.site-header__logo` to match the mock (lowercase, `--color-accent`) in CSS only.
- [ ] **Step 4: Wire Add to Cart.** In `ProductConfigurator`, take `add`, `pending` and `error` from `useCart()`. While pending the button is disabled and reads `Adding…`. Show `error` in a `<p role="alert">` under the button.
- [ ] **Step 5: Run** `npm run verify`. Expected: pass.
- [ ] **Step 6: Smoke test.** With `npm run dev` running, `curl -s -c /tmp/c.txt -X POST -H 'Content-Type: application/json' -d '{"productId":"LNL-Q"}' localhost:3000/api/cart/items` returns a cart with `itemCount: 1`. Then `curl -s -b /tmp/c.txt localhost:3000 | grep -o 'Cart, 1 item'` matches, which shows the count is right on the first server render. Stop the processes.
- [ ] **Step 7: Commit** `Add cart state, header count and Add to Cart`.

---

### Task 9: Cart page

Spec: 02-cart "Cart page"; K-12, K-15.

**Files:**

- Create: `apps/web/app/cart/page.tsx`, `apps/web/components/cart/CartView.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**

- Consumes: `useCart()` (Task 8), `<Price />` and `formatPrice` (Task 5), `MAX_CART_QUANTITY` (Task 8).

- [ ] **Step 1: Write `page.tsx`.** A Server Component with `metadata.title = 'Saatva | Your Cart'` that renders `<h1>Your Cart</h1>` and `<CartView />`.
- [ ] **Step 2: Build `CartView`** (`'use client'`), one state at a time:
  - **`cart === null`:** `<p role="alert">We couldn't load your cart.</p>` plus a "Try again" button that calls `refresh()`.
  - **Empty cart:** `Your cart is empty.` and a link back to `/`.
  - **Cart with lines:** a `<ul>` with one row per line: image, `"{name} Mattress"`, `<Price>` (unit price, with compare-at when set), then the quantity controls and the line total via `formatPrice`.
    - Quantity controls: `−` with `aria-label="Decrease quantity of {name}"`, disabled at 1; the quantity; `+` with `aria-label="Increase quantity of {name}"`, disabled at `MAX_CART_QUANTITY`. Each calls `setQuantity(id, q ± 1)`, sending the absolute quantity (D9).
    - A `Remove` button calls `remove(id)`.
    - Every control is also disabled while `pending`.
  - Below the list: a total row (`Total` + `formatPrice(cart.totalCents, cart.currency)`) and a "Continue shopping" link to `/`.
  - **When `error` is set:** show it in a `<p role="alert">` with "Try again" (`refresh()`), above the list.
- [ ] **Step 3: Write the CSS.**
  - Desktop: a grid row (image | details | quantity + Remove | line total), using the configurator's tokens and button styles.
  - `≤ 768px`: image and details on one row, quantity and line total below; no horizontal overflow at 375 px.
- [ ] **Step 4: Run** `npm run verify`. Expected: pass.
- [ ] **Step 5: Smoke test.** With `npm run dev` and the cookie jar from Task 8 Step 6, `curl -s -b /tmp/c.txt localhost:3000/cart | grep -o 'Loom &amp; Leaf Mattress'` matches. Stop the processes.
- [ ] **Step 6: Commit** `Add cart page`.

---

### Task 10: Reviewer notes and final verification

Spec: 00-overview "Delivery"; manual criteria C-10–C-13 and K-11–K-15. The controller runs this task, using a browser (claude-in-chrome) or the user's help for the visual checks.

**Files:**

- Modify: `README.md` (append only; it is excluded from Prettier)

- [ ] **Step 1: Run the manual browser checklist** against `npm run dev` at 1280 px and 375 px, and record pass/fail for each:
  - **C-10:** the page matches the mock's layout, with rating, headline and description added.
  - **C-11:** each option updates name, price (Loom & Leaf shows its struck-through list price), image, rating and description; the arrow keys work.
  - **C-12:** `UPSTREAM_FAIL_SERVICE=content` → products without content; `=catalog` → the friendly error.
  - **C-13:** stacked layout at 375 px with no horizontal scroll.
  - **K-11:** Add to Cart updates the count without a reload; a fast double-click adds 1.
  - **K-12:** `+`, `−` and Remove update the line, the total and the count; controls disable while a request is in flight.
  - **K-13:** a hard refresh on `/` and on `/cart` keeps the count right on first paint.
  - **K-14:** restarting the API keeps the cart.
  - **K-15:** the empty and error states render (stop the upstream to see the error state), and the layout works at 375 px.

  Fix any failure in a separate commit before continuing.

- [ ] **Step 2: Append `## Notes for reviewers` to `README.md`:**
  - How to run (`npm install && npm run dev`) and test (`npm test`, `npm run verify`).
  - How to try the failure modes.
  - What was built.
  - Five to six bullets summarizing the key decisions (D1 cookie cart, D2 zod, D3/D4 content adapter, D6 sale price, D7 sanitization, D11 naming), linking `docs/specs/`.
  - The "With more time" list from 00-overview.
  - One line on process: spec-driven with Claude Code; specs and plan in `docs/`.
- [ ] **Step 3: Check a clean clone.** `git clone` the pushed branch into the scratchpad, then `npm install && npm run dev`. `curl` `localhost:4000/api/health`, `localhost:4000/api/products` and `localhost:3000` should all respond. Then run `npm run verify` in the clone. Expected: all pass.
- [ ] **Step 4: Commit** `Add notes for reviewers` and push.
