import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { CatalogUnavailableError, type Catalog } from '../products/product.types'
import { ProductsService } from '../products/products.service'
import {
  DEFAULT_CURRENCY,
  MAX_QUANTITY,
  emptyCart,
  type Cart,
  type CartItem,
  type CartLine,
} from './cart.types'

function clamp(quantity: number): number {
  return Math.min(MAX_QUANTITY, Math.max(1, quantity))
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
export type CartResult = { cart: Cart; lines: CartLine[] }

export function priceCart(lines: CartLine[], catalog: Catalog): CartResult {
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

@Injectable()
export class CartService {
  constructor(private readonly products: ProductsService) {}

  async view(lines: CartLine[]): Promise<CartResult> {
    if (lines.length === 0) return { cart: emptyCart(DEFAULT_CURRENCY), lines: [] }
    const catalog = await this.catalog()
    return priceCart(lines, catalog)
  }

  async add(lines: CartLine[], productId: string, quantity: number): Promise<CartResult> {
    const catalog = await this.catalog()
    if (!catalog.items.some((item) => item.id === productId)) {
      throw new BadRequestException('Unknown product')
    }
    return priceCart(addLine(reconcile(lines, catalog), productId, quantity), catalog)
  }

  async setQuantity(lines: CartLine[], productId: string, quantity: number): Promise<CartResult> {
    const catalog = await this.catalog()
    const updated = setLineQuantity(reconcile(lines, catalog), productId, quantity)
    if (!updated) throw new NotFoundException('Product is not in the cart')
    return priceCart(updated, catalog)
  }

  async remove(lines: CartLine[], productId: string): Promise<CartResult> {
    const catalog = await this.catalog()
    return priceCart(removeLine(reconcile(lines, catalog), productId), catalog)
  }

  private async catalog(): Promise<Catalog> {
    try {
      return await this.products.getCatalog()
    } catch (error) {
      // ProductsService has already logged the cause.
      if (error instanceof CatalogUnavailableError) {
        throw new ServiceUnavailableException('Cart is temporarily unavailable')
      }
      throw error
    }
  }
}

/** Drops lines whose product is no longer in the catalog. */
function reconcile(lines: CartLine[], catalog: Catalog): CartLine[] {
  const ids = new Set(catalog.items.map((item) => item.id))
  return lines.filter(([id]) => ids.has(id))
}
