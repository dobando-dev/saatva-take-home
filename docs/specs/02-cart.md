# 02 — Cart: cart API, header count, cart page, persistence

Status: **Approved 2026-11-16** · Parent: [00-overview](./00-overview.md)

Covers shopper stories 2–4. Persistence approach: BFF-owned HttpOnly cookie, re-priced on every read (D1).

## API

All endpoints return the full `Cart`. Mutations always set the updated cookie; `GET` sets it only when re-validation changed the lines (see Cookie). The browser reaches them same-origin through the Next rewrite (`/api/*` → BFF), so the cookie lands on the web origin.

#### `GET /api/cart`

- **Body:** none.
- **Behavior:** returns the current cart; empty cart if the cookie is missing or invalid.

#### `POST /api/cart/items`

- **Body:** `{ productId: string, quantity?: int }` (quantity defaults to 1).
- **Behavior:** adds to the line, **clamped** to the max of 10.
- **Errors:** unknown or inactive product → 400.

#### `PUT /api/cart/items/:productId`

- **Body:** `{ quantity: int }` (1–10).
- **Behavior:** sets the line to that **absolute** quantity (D9).
- **Errors:** out of range or not an integer → 400; product not in the cart → 404.

#### `DELETE /api/cart/items/:productId`

- **Body:** none.
- **Behavior:** removes the line. Idempotent: if the product isn't in the cart → 200 with the unchanged cart.

Bodies are validated with zod at the controller boundary (D2). Error shape is Nest's default `{ statusCode, message, error }`.

### Response contract

```ts
interface Cart {
  items: CartItem[] // order of first add
  itemCount: number // sum of quantities (the header badge)
  totalCents: number // sum of line totals; no tax/shipping (non-goal)
  currency: string // "USD"
}

interface CartItem {
  productId: string
  name: string
  image: { src: string; alt: string }
  unitPriceCents: number // current price from the catalog
  compareAtPriceCents: number | null
  quantity: number // 1–10
  lineTotalCents: number // unitPriceCents × quantity
}
```

Name, image and price come from the catalog-only product method (01-configurator), so the cart works when the content service is down.

### Cookie

- Name `cart`; value: JSON `[[productId, quantity], …]` (Express encodes it). Holds no prices or names.
- Attributes: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 30 days, `Secure` only when `NODE_ENV=production`.
- Read with `cookie-parser`, registered in the shared `configureApp()`.
- **Decoding is defensive:** malformed JSON, wrong shape, non-integer quantities → treated as an empty cart. Quantities are clamped to 1–10, duplicate product IDs merged, at most 20 lines kept.
- **Every read re-validates against the live catalog:** lines whose product is unknown or discontinued are dropped, prices are current. If anything was dropped or corrected, the response rewrites the cookie.
- The cookie is not signed: tampering can only change which catalog products and quantities (within bounds) are in your own cart, never a price. Signing is listed under "With more time" in 00-overview (D1).

### Failure behavior

- **Empty cart short-circuits:** with no lines (no cookie, empty or garbage cookie), `GET /api/cart` returns the empty cart without calling the catalog, using the BFF's default currency `"USD"`. The header keeps working for new shoppers during a catalog outage.
- **Catalog unavailable and the cart has lines (or any mutation)** → 503 via `ServiceUnavailableException` (`{ statusCode: 503, message: "Cart is temporarily unavailable", error: "Service Unavailable" }`), no `Set-Cookie` (we never drop lines because of an outage).

### Structure

```
cart/
  cart.module.ts      imports ProductsModule (catalog-only method)
  cart.controller.ts  HTTP + cookie read/write only
  cart.service.ts     pure operations: add, setQuantity, remove, price(lines, catalog) → Cart
  cart.cookie.ts      encode/decode + cookie options
  cart.types.ts
```

Operations are pure functions over `[productId, quantity][]` so they're unit tested without HTTP. With a real data store, only the controller's read/write of lines changes (cart ID cookie + repository).

## Web

### Cart state

- `app/layout.tsx` fetches `/api/cart` server-side, forwarding the incoming `Cookie` header (`lib/server-api.ts`, using `cookies()` from `next/headers`). The result seeds a client `CartProvider` that wraps the page. If this fetch fails, the provider starts with `cart: null`.
- `CartProvider` exposes `cart`, `pending`, `error`, and `add(productId)`, `setQuantity(productId, qty)`, `remove(productId)`. Each action calls the BFF via the `/api/*` rewrite and **replaces** state with the returned cart (no optimistic updates, D9). While any action is pending, cart-mutating controls are disabled. Errors set a short message and leave the previous cart in place.
- Set-Cookie from server-side fetches is discarded (Server Components can't set cookies); the next client mutation rewrites the cookie. Harmless by design.

### Header

`Header` stays a Server Component but renders a small client `CartLink`: cart icon + count badge (the mock's small circle on the icon), linking to `/cart`. `aria-label="Cart, N items"`, count in an `aria-live="polite"` region. Badge hidden when the count is 0 or the cart is unknown.

### Cart page (`/cart`)

No mock; design consistent with the configurator (same tokens, fonts, button style).

```
Your Cart (h1)
┌───────┬──────────────────────────┬──────────────┬───────────┐
│ [img] │ Loom & Leaf Mattress     │ [−] 2 [+]    │  $2,398   │
│       │ $1,199  ~~$1,299~~       │ Remove       │           │
├───────┼──────────────────────────┼──────────────┼───────────┤
│ [img] │ Saatva Classic Mattress  │ [−] 1 [+]    │    $999   │
└───────┴──────────────────────────┴──────────────┴───────────┘
                                         Total     $3,397
```

- `−` disabled at 1 (removal is the explicit Remove button); `+` disabled at 10.
- Empty cart: "Your cart is empty." with a link back to the configurator.
- Cart unknown (`null`) or a failed action: inline error with a "Try again" that re-fetches `/api/cart`.
- A "Continue shopping" link back to `/`.
- Mobile (≤ 768 px): each line stacks as image + details on one row, quantity and line total below. No horizontal scroll at 375 px.

## Acceptance criteria

API (automated):

- **K-1** With no cookie, `GET /api/cart` returns `{ items: [], itemCount: 0, totalCents: 0, currency: "USD" }`.
- **K-2** `POST /api/cart/items {productId: "LNL-Q"}` twice → one line, quantity 2, `unitPriceCents: 119900`, `lineTotalCents: 239800`, and a `Set-Cookie: cart=…; HttpOnly` header.
- **K-3** Sending the returned cookie back on `GET /api/cart` returns the same cart (round trip).
- **K-4** `PUT` quantity 3 → quantity 3; `PUT` quantity 0, 11 or 1.5 → 400; `PUT` for a product not in the cart → 404.
- **K-5** `DELETE` removes the line and totals update; repeating it → 200, cart unchanged.
- **K-6** `POST` with an unknown or discontinued product → 400; adding beyond 10 → quantity stays 10.
- **K-7** A cookie containing a price, a garbage value, an unknown SKU, or quantity 999 never yields a wrong price: garbage → empty cart; unknown SKU → line dropped and cookie rewritten; 999 → clamped to 10.
- **K-8** Totals: Classic ×1 + Loom & Leaf ×2 → `itemCount: 3`, `totalCents: 339700`.
- **K-9** With the catalog failing: a cart with lines → `GET` and mutations return 503 with no `Set-Cookie`; no cookie → `GET` still returns the empty cart (200).
- **K-10** With the content service failing, cart endpoints still work.

Web (manual, browser):

- **K-11** Clicking Add to Cart updates the header count without a page reload. The button is disabled while the request is in flight, so a rapid double-click adds 1; clicking again after it completes adds another (no lost or duplicated updates).
- **K-12** On `/cart`, `+`/`−`/Remove update the line, the total and the header count; controls disable while a request is in flight.
- **K-13** After a hard refresh on `/` or `/cart`, the cart and header count are unchanged and correct on first paint (no flash of 0).
- **K-14** Restarting the API process (`npm run dev` restart) keeps the cart.
- **K-15** Empty and error states render as specified; layout works at 375 px.
