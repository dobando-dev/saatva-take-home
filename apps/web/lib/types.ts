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

export const MAX_CART_QUANTITY = 10

export interface CartItem {
  productId: string
  name: string
  image: ProductImage
  unitPriceCents: number
  compareAtPriceCents: number | null
  quantity: number
  lineTotalCents: number
}

export interface Cart {
  items: CartItem[]
  itemCount: number
  totalCents: number
  currency: string
}
