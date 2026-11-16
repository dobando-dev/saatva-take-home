export interface ProductImage {
  src: string
  alt: string
}

/** Average is on a 5-point scale (D4). */
export interface ProductRating {
  average: number
  count: number
}

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
