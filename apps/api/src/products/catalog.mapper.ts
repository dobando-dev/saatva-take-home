import { z } from 'zod'
import { UpstreamDataError, type Catalog, type CatalogItem } from './product.types'

const catalogEnvelopeSchema = z.object({
  meta: z.object({ currency: z.string().regex(/^[A-Z]{3}$/) }),
  data: z.array(z.unknown()),
})

const nonEmptyTrimmed = z.string().trim().min(1)

const catalogItemSchema = z.object({
  sku: nonEmptyTrimmed,
  productHandle: z.string(),
  displayName: nonEmptyTrimmed,
  priceCents: z.unknown(),
  salePriceCents: z.unknown().optional(),
  imageKey: z.string().regex(/^[A-Za-z0-9_-]+$/),
  status: z.unknown(),
})

/** Accepts a string of digits or an integer number; anything else, or a value <= 0, is null. */
export function parseCents(value: unknown): number | null {
  let cents: number
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    cents = Number(value)
  } else if (typeof value === 'number') {
    cents = value
  } else {
    return null
  }
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

/**
 * Validates the catalog body and maps active, well-formed items to internal `CatalogItem`s in
 * catalog order. A malformed top level throws; a malformed item is skipped with a warning.
 */
export function mapCatalog(raw: unknown, warn: (message: string) => void = () => {}): Catalog {
  const envelope = catalogEnvelopeSchema.safeParse(raw)
  if (!envelope.success) {
    throw new UpstreamDataError('Catalog response is not a valid catalog')
  }

  const seen = new Set<string>()
  const items: CatalogItem[] = []

  envelope.data.data.forEach((entry, index) => {
    const parsed = catalogItemSchema.safeParse(entry)
    if (!parsed.success) {
      warn(`Skipping catalog item at index ${index}: invalid shape`)
      return
    }
    const item = parsed.data
    if (item.status !== 'active') return

    const listPrice = parseCents(item.priceCents)
    if (listPrice === null) {
      warn(`Skipping catalog item ${item.sku}: invalid list price`)
      return
    }
    if (seen.has(item.sku)) {
      warn(`Skipping catalog item ${item.sku}: duplicate SKU`)
      return
    }
    seen.add(item.sku)

    const sale = parseCents(item.salePriceCents)
    const onSale = sale !== null && sale < listPrice

    items.push({
      id: item.sku,
      handle: item.productHandle,
      name: item.displayName,
      priceCents: onSale ? sale : listPrice,
      compareAtPriceCents: onSale ? listPrice : null,
      image: { src: `/images/${item.imageKey}.jpg`, alt: `${item.displayName} mattress` },
    })
  })

  return { currency: envelope.data.meta.currency, items }
}
