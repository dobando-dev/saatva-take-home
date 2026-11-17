import { unstable_rethrow } from 'next/navigation'
import { ProductConfigurator } from '@/components/ProductConfigurator'
import { serverGet } from '@/lib/server-api'
import type { Product, ProductsResponse } from '@/lib/types'

async function loadProducts(): Promise<Product[] | null> {
  try {
    const { products } = await serverGet<ProductsResponse>('/api/products')
    return products
  } catch (error) {
    // Let Next's own control-flow errors (e.g. dynamic-rendering signals) through.
    unstable_rethrow(error)
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
