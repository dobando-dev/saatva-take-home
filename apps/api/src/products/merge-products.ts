import { normalizeHandle } from './content.mapper'
import type { Catalog, Product, ProductContent } from './product.types'

/**
 * Joins catalog items with content by normalized handle, building each `Product` field by field.
 * `content` is null when the content service is unavailable; products then carry null content.
 */
export function mergeProducts(
  catalog: Catalog,
  content: Map<string, ProductContent> | null,
): Product[] {
  return catalog.items.map((item) => {
    const itemContent = content?.get(normalizeHandle(item.handle)) ?? null
    return {
      id: item.id,
      name: item.name,
      priceCents: item.priceCents,
      compareAtPriceCents: item.compareAtPriceCents,
      currency: catalog.currency,
      image: { src: item.image.src, alt: item.image.alt },
      rating: itemContent?.rating ?? null,
      headline: itemContent?.headline ?? null,
      descriptionHtml: itemContent?.descriptionHtml ?? null,
    }
  })
}
