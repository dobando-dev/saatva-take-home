import type { ProductImage } from '../products/product.types'

/** One cart line as stored in the cookie: [productId, quantity]. */
export type CartLine = readonly [productId: string, quantity: number]

export const MAX_QUANTITY = 10
export const MAX_LINES = 20
export const DEFAULT_CURRENCY = 'USD'

export interface CartItem {
  productId: string
  name: string
  image: ProductImage
  /** Current price from the catalog. */
  unitPriceCents: number
  compareAtPriceCents: number | null
  /** 1-10. */
  quantity: number
  /** unitPriceCents x quantity. */
  lineTotalCents: number
}

export interface Cart {
  /** Order of first add. */
  items: CartItem[]
  /** Sum of quantities (the header badge). */
  itemCount: number
  /** Sum of line totals; no tax or shipping. */
  totalCents: number
  currency: string
}

export function emptyCart(currency: string): Cart {
  return { items: [], itemCount: 0, totalCents: 0, currency }
}
