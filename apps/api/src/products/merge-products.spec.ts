import { describe, expect, it } from 'vitest'
import { mergeProducts } from './merge-products'
import type { Catalog, ProductContent } from './product.types'

const catalog: Catalog = {
  currency: 'USD',
  items: [
    {
      id: 'ZEN-Q',
      handle: 'Zenhaven',
      name: 'Zenhaven',
      priceCents: 189900,
      compareAtPriceCents: null,
      image: { src: '/images/zen.jpg', alt: 'Zenhaven mattress' },
    },
    {
      id: 'X-1',
      handle: 'no-content',
      name: 'No Content',
      priceCents: 50000,
      compareAtPriceCents: 60000,
      image: { src: '/images/x.jpg', alt: 'No Content mattress' },
    },
  ],
}

const content = new Map<string, ProductContent>([
  [
    'zenhaven',
    {
      headline: 'Dual-sided comfort',
      descriptionHtml: '<p>Hello</p>',
      rating: { average: 4.5, count: 2140 },
    },
  ],
])

describe('mergeProducts', () => {
  it('builds products with exactly the contract fields', () => {
    const [product] = mergeProducts(catalog, content)
    expect(Object.keys(product).sort()).toEqual([
      'compareAtPriceCents',
      'currency',
      'descriptionHtml',
      'headline',
      'id',
      'image',
      'name',
      'priceCents',
      'rating',
    ])
    expect(product).toEqual({
      id: 'ZEN-Q',
      name: 'Zenhaven',
      priceCents: 189900,
      compareAtPriceCents: null,
      currency: 'USD',
      image: { src: '/images/zen.jpg', alt: 'Zenhaven mattress' },
      rating: { average: 4.5, count: 2140 },
      headline: 'Dual-sided comfort',
      descriptionHtml: '<p>Hello</p>',
    })
  })

  it('a catalog item without content gets null content fields', () => {
    const products = mergeProducts(catalog, content)
    expect(products.map((p) => p.id)).toEqual(['ZEN-Q', 'X-1'])
    expect(products[1]).toMatchObject({
      id: 'X-1',
      priceCents: 50000,
      compareAtPriceCents: 60000,
      rating: null,
      headline: null,
      descriptionHtml: null,
    })
  })

  it('C-6 null content map gives null content fields for every product', () => {
    const products = mergeProducts(catalog, null)
    expect(products).toHaveLength(2)
    for (const product of products) {
      expect(product.rating).toBeNull()
      expect(product.headline).toBeNull()
      expect(product.descriptionHtml).toBeNull()
    }
  })
})
