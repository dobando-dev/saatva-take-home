import type { Catalog } from '../products/product.types'
import { MAX_QUANTITY, type Cart, type CartItem, type CartLine } from './cart.types'

function clamp(quantity: number): number {
  return Math.min(MAX_QUANTITY, quantity)
}

export function addLine(lines: CartLine[], productId: string, quantity: number): CartLine[] {
  if (!lines.some(([id]) => id === productId)) {
    return [...lines, [productId, clamp(quantity)]]
  }
  return lines.map((line) =>
    line[0] === productId ? [productId, clamp(line[1] + quantity)] : line,
  )
}

/** Returns null when the product is not in the cart. */
export function setLineQuantity(
  lines: CartLine[],
  productId: string,
  quantity: number,
): CartLine[] | null {
  if (!lines.some(([id]) => id === productId)) return null
  return lines.map((line) => (line[0] === productId ? [productId, clamp(quantity)] : line))
}

export function removeLine(lines: CartLine[], productId: string): CartLine[] {
  return lines.filter(([id]) => id !== productId)
}

/** Prices come only from the catalog; lines for products not in it are dropped. */
export function priceCart(lines: CartLine[], catalog: Catalog): { cart: Cart; lines: CartLine[] } {
  const byId = new Map(catalog.items.map((item) => [item.id, item]))
  const keptLines: CartLine[] = []
  const items: CartItem[] = []
  for (const line of lines) {
    const [productId, quantity] = line
    const product = byId.get(productId)
    if (!product) continue
    keptLines.push(line)
    items.push({
      productId,
      name: product.name,
      image: { src: product.image.src, alt: product.image.alt },
      unitPriceCents: product.priceCents,
      compareAtPriceCents: product.compareAtPriceCents,
      quantity,
      lineTotalCents: product.priceCents * quantity,
    })
  }
  return {
    cart: {
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      totalCents: items.reduce((sum, item) => sum + item.lineTotalCents, 0),
      currency: catalog.currency,
    },
    lines: keptLines,
  }
}
