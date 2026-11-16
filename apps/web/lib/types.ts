// The BFF's response contract. Duplicated from the API on purpose (D8).
export interface ProductImage {
  src: string
  alt: string
}

/** Average is on a 5-point scale. */
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
