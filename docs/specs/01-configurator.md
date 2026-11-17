# 01 — Configurator: products endpoint + configurator page

Status: **Approved 2026-11-16** · Parent: [00-overview](./00-overview.md)

Covers shopper story 1 and the "Add to Cart" button of story 2 (cart behavior itself is in [02-cart](./02-cart.md)).

## API: `GET /api/products`

### Response contract (BFF-owned)

```ts
interface ProductsResponse {
  products: Product[] // catalog order
}

interface Product {
  id: string // catalog SKU, e.g. "SAT-CLASSIC-Q"; opaque to the web
  name: string // "Loom & Leaf"
  priceCents: number // what the shopper pays (sale price if active)
  compareAtPriceCents: number | null // list price, only when on sale
  currency: string // "USD" (from catalog meta)
  image: { src: string; alt: string } // src "/images/loom-carousel.jpg", alt "Loom & Leaf mattress"
  rating: { average: number; count: number } | null // average on a 5-point scale
  headline: string | null
  descriptionHtml: string | null
}
```

`null` content fields mean "content unavailable for this product" (no content entry, invalid content, or content service down). The web renders without them.

### Normalization rules (BFF)

Each item: what the upstream sends → what the BFF does.

- **Prices are strings of cents** (`"99900"`) → parse to integer cents. Non-integer or ≤ 0 → drop the product and log a warning.
- **`salePriceCents` set** (`"119900"`) **or `null`** → if valid and lower than list: `priceCents` = sale, `compareAtPriceCents` = list. Otherwise ignore the sale.
- **`status: "discontinued"`** → excluded.
- **Content `handle` casing differs from catalog** (`"Zenhaven"` vs `"zenhaven"`) → join on `trim().toLowerCase()`; on duplicate handles the first wins.
- **Content with no catalog entry** (`saatva-youth`) → ignored.
- **Catalog item with no content entry** → included, content fields `null`.
- **`reviews.average` / `count` as strings** (`"4.0"`, `"1876"`) → coerce to numbers. Average must be within 0–5 and count a non-negative integer, else `rating: null`.
- **`descriptionHtml` is "trusted HTML"** → sanitized anyway with the D7 allowlist (`p`, `strong`, `em`, `b`, `i`, `ul`, `ol`, `li`, `br`; no attributes). Empty after sanitizing → `null`. Lives in `products/sanitize-description.ts`, called from `content.mapper.ts`.
- **Unknown extra fields** (e.g. `badges`) → dropped; not part of the contract.

Mapping code lives in `products/catalog.mapper.ts` and `products/content.mapper.ts` (the v2 swap point, D3). Both are pure functions, unit tested.

### Failure behavior

"Fails" means a non-2xx response, a timeout, or an invalid body.

- **Both upstreams OK** → 200, merged products.
- **Content fails** → 200, products with content fields `null`; warning logged.
- **Catalog fails** → 503 via `ServiceUnavailableException`, Nest default shape:
  ```json
  {
    "statusCode": 503,
    "message": "Product catalog is temporarily unavailable",
    "error": "Service Unavailable"
  }
  ```
- **Catalog OK but zero active valid products** → 200 with `products: []`.

Upstream calls run in parallel with a 2 s timeout each (`AbortSignal.timeout` in `UpstreamClient`). No retries or caching (talking points).

`ProductsService` also exposes a catalog-only method (active products with name, price, image) for the cart to price lines without touching content.

## Web: configurator page (`/`)

### Data loading

`app/page.tsx` (Server Component) fetches `/api/products` and passes `products` to `ProductConfigurator`. If the request fails, the page renders a friendly message ("We couldn't load mattresses right now. Please try again in a moment.") instead of the configurator. If `products` is empty, it renders "No mattresses are available right now."

### Layout (desktop, per `docs/mock.png`)

```
┌──────────────────────────────┬───────────────────────────────────┐
│                              │ Choose Your Mattress        (h1)  │
│                              │ SELECT MATTRESS TYPE              │
│   [ product image ]          │ [Saatva Classic|Loom & Leaf|Zen…] │
│                              │ Loom & Leaf Mattress   $1,199     │
│                              │                       ~~$1,299~~  │
│                              │ ★★★★☆ 4.0 (1,876 reviews)         │
│                              │ Ultra-premium memory foam         │
│                              │ <description html>                │
│                              │ [        Add to Cart         ]    │
└──────────────────────────────┴───────────────────────────────────┘
```

The mock omits rating, headline and description; they go between the name/price row and the button, as above.

- **Toggle:** built from scratch as a segmented control with `role="radiogroup"` and `role="radio"` / `aria-checked` options. Click selects; arrow keys move selection; selected option uses the muted filled style from the mock. Default selection: first product.
- **Name:** `"{name} Mattress"` (as in the mock). **Price:** formatted with `Intl.NumberFormat` in the product currency, no decimals for whole-dollar amounts. When `compareAtPriceCents` is set, show it struck through next to the sale price.
- **Rating:** stars (rounded to the nearest half) + average to one decimal + count with thousands separator. Hidden when `rating` is `null`.
- **Image:** `next/image` or `<img>` with `alt` from the API; swaps with selection.
- **Description:** rendered as HTML (already sanitized by the BFF, D7); hidden when `null`.
- **Add to Cart:** gold full-width button (`--color-accent`). Calls the cart provider's `add(productId)` (see 02-cart). While pending it shows "Adding…" and is disabled; on error a short inline message appears under the button.

### Mobile (≤ 768 px)

Single column: image on top, details below. Toggle stays one row with options sharing the width (text may wrap to two lines). Button full width. No horizontal scroll at 375 px.

## Acceptance criteria

API (automated):

- **C-1** Given both upstreams return the provided data, `GET /api/products` returns exactly Saatva Classic, Loom & Leaf and Zenhaven, in catalog order, matching the contract.
- **C-2** Loom & Leaf has `priceCents: 119900`, `compareAtPriceCents: 129900`; Saatva Classic has `priceCents: 99900`, `compareAtPriceCents: null`.
- **C-3** Zenhaven has its content (headline, rating 4.5 / 2140) despite the handle casing mismatch.
- **C-4** Loom & Leaf's rating is `{ average: 4, count: 1876 }` (numbers, not strings).
- **C-5** `saatva-youth` does not appear; a catalog item with `status: "discontinued"` does not appear.
- **C-6** With the content service failing, the response is 200 and every product has `rating`, `headline`, `descriptionHtml` = `null`.
- **C-7** With the catalog failing, the response is 503 with the Nest default error shape and the message above.
- **C-8** No upstream field names (`productHandle`, `displayName`, `imageKey`, `reviews`, `handle`, `salePriceCents`) appear in the response.
- **C-9** Description sanitization (D7): the provided descriptions come through with their formatting intact (`<p>`, `<strong>`, `<ul>`, `<li>`); a description containing `<script>`, an `onerror`/`onclick` attribute, a `javascript:` link or an `<iframe>` comes out with all of those removed and its text kept; one that sanitizes to empty becomes `null`.

Web (manual, browser):

- **C-10** The page matches the mock's layout at desktop width, with rating, headline and description added as specified.
- **C-11** Selecting each option updates name, price (incl. struck-through list price for Loom & Leaf), image, rating and description; keyboard arrow keys work.
- **C-12** With `UPSTREAM_FAIL_SERVICE=content`, the page still renders products without rating/description; with `UPSTREAM_FAIL_SERVICE=catalog`, the friendly error message shows.
- **C-13** At 375 px width the layout stacks with no horizontal scroll.
