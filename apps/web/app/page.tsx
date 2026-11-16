import { ProductConfigurator } from '@/components/ProductConfigurator'
import { apiGet } from '@/lib/api'
import type { Product, ProductsResponse } from '@/lib/types'

async function loadProducts(): Promise<Product[] | null> {
  try {
    const { products } = await apiGet<ProductsResponse>('/api/products')
    return products
  } catch (error) {
    console.error('Failed to load products', error)
    return null
  }
}

export default async function HomePage() {
  const products = await loadProducts()

  if (!products) {
    return (
      <p className="page-message">
        We couldn&apos;t load mattresses right now. Please try again in a moment.
      </p>
    )
  }
  if (products.length === 0) {
    return <p className="page-message">No mattresses are available right now.</p>
  }
  return <ProductConfigurator products={products} />
}
