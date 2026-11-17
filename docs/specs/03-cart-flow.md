# Cart flow

How an item gets into the cart, how the cart page shows it and how it is updated there. It describes the code as built; the decisions behind it are in [00-overview.md](00-overview.md) and [02-cart.md](02-cart.md).

The browser only talks to Next.js. Browser calls go to `/api/*`, which Next.js proxies to the BFF unchanged (`next.config.mjs`), so the `cart` cookie the BFF sets lands on the web origin. Paths are shortened in the diagram: `/cart/items` is `/api/cart/items`, `/items/:id` is `/api/cart/items/:productId`, and the BFF's `GET /cart` is `GET /api/cart`.

```text
    Browser              Next.js :3000             BFF :4000            Upstream
 CartProvider            rewrite + SSR          CartController            :4100
       |                       |                       |                    |

A. ADD TO CART (configurator page, /) =========================================
       |                       |                       |                    |
(1)    | click Add to Cart     |                       |                    |
       | button: Adding...     |                       |                    |
(2)    |- POST /cart/items --->|                       |                    |
       |                       |- proxied as is ------>|                    |
(3)    |                       |                       | guard, zod body    |
       |                       |                       | decode cookie      |
(4)    |                       |                       |- GET catalog ----->|
       |                       |                       |< catalog ----------|
(5)    |                       |                       | add line, price it |
(6)    |                       |< cart + Set-Cookie ---|                    |
       |< cart + Set-Cookie ---|                       |                    |
(7)    | replace cart state    |                       |                    |
       | header badge: 1       |                       |                    |

B. SHOW THE CART (click the cart icon) ========================================
       |                       |                       |                    |
(8)    | click cart icon       |                       |                    |
       |- GET /cart (RSC) ---->|                       |                    |
       |                       | render /cart only     |                    |
       |< cart page -----------|                       |                    |
(9)    | CartView reads the    |                       |                    |
       | cart state: no fetch  |                       |                    |
       |                       |                       |                    |
(10)   | reload or open /cart  |                       |                    |
       |- GET /cart + cookie ->|                       |                    |
       |                       |- GET /cart + cookie ->|                    |
       |                       |                       | decode, price it   |
       |                       |                       |- GET catalog ----->|
       |                       |                       |< catalog ----------|
       |                       |< cart ----------------|                    |
       |< HTML with the cart --|                       |                    |
       | seeds CartProvider    |                       |                    |

C. UPDATE THE CART (on /cart) =================================================
       |                       |                       |                    |
(11)   | click + or -          |                       |                    |
       | buttons disabled      |                       |                    |
(12)   |- PUT /items/:id ----->|                       |                    |
       |                       |- proxied as is ------>|                    |
(13)   |                       |                       | guard, zod body    |
       |                       |                       | decode cookie      |
       |                       |                       |- GET catalog ----->|
       |                       |                       |< catalog ----------|
       |                       |                       | set qty, price it  |
(14)   |                       |< cart + Set-Cookie ---|                    |
       |< cart + Set-Cookie ---|                       |                    |
(15)   | replace cart state    |                       |                    |
       | lines, total and      |                       |                    |
       | badge update          |                       |                    |
       |                       |                       |                    |
(16)   | click Remove          |                       |                    |
       |- DELETE /items/:id -->|                       |                    |
       |                       |- proxied as is ------>|                    |
       |                       |                       | drop line, price   |
       |                       |                       | (catalog as above) |
       |                       |< cart + Set-Cookie ---|                    |
       |< cart + Set-Cookie ---|                       |                    |
       | line gone; last one   |                       |                    |
       | shows "Your cart is   |                       |                    |
       | empty."               |                       |                    |
```

## Steps

1. `ProductConfigurator` calls `useCart().add(productId)`. `CartProvider` disables the button and ignores further clicks until the request ends, so a double click adds one item.
2. `lib/api.ts` sends `POST /api/cart/items` with `{"productId"}` as JSON. Next.js forwards it, cookie included.
3. `CartController`: `JsonOnlyGuard` rejects anything that isn't JSON (415), the zod schema checks the body (400), and `decodeCart` reads the cookie defensively. A missing or garbage cookie is an empty cart.
4. `CartService` asks `ProductsService.getCatalog()` for the live catalog. Prices only ever come from here, never from the cookie.
5. Unknown product → 400. Otherwise the line is added (quantity capped at 10) and the cart is priced; lines for products no longer in the catalog are dropped.
6. The BFF returns the priced cart and sets `cart=[[productId, quantity]]` (HttpOnly, SameSite=Lax, 30 days).
7. `CartProvider` replaces its state with that cart. `CartLink` re-renders, so the header badge shows the new count.
8. The cart icon is a `next/link`, so it's a client-side navigation: Next.js renders only the `/cart` page. The root layout, and the `CartProvider` in it, stay mounted.
9. `CartView` reads the cart that's already in `CartProvider`. No request is needed.
10. On a reload or a direct visit, the server renders everything. The layout calls `serverGet('/api/cart')` (`lib/server-api.ts`), forwarding the browser's cookie, and seeds `CartProvider` with the result, so the page and the badge are right in the first HTML.
11. `CartView` disables the quantity and Remove buttons while a request is in flight. `−` is disabled at 1 and `+` at 10.
12. `PUT /api/cart/items/:productId` with `{"quantity"}`.
13. Same checks as step 3, then the catalog. A product that isn't in the cart → 404. Otherwise the quantity is set (1–10) and the cart re-priced.
14. Priced cart and the rewritten cookie, as in step 6.
15. `CartProvider` replaces its state: the line, the total and the header badge update together.
16. Remove sends `DELETE /api/cart/items/:productId` with no body. The BFF drops the line and re-prices; when the last line goes, `CartView` shows "Your cart is empty."

## When something fails

- **Catalog down:** every cart request answers 503 "Cart is temporarily unavailable" and the cookie is not touched, so nothing is lost. The configurator or cart page shows "We couldn't update your cart" and the shopper can try again.
- **BFF down on a reload:** the layout's cart fetch times out after 3 s, the header shows no count, and the cart page shows its error state with Try again.
- **Errors are per page:** `CartProvider` clears its error on navigation, so a failed add doesn't follow the shopper to `/cart`.
