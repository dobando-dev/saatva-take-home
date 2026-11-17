import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestApp, type UpstreamStub } from '../testing/create-test-app'
import { failing, loadUpstreamData } from '../testing/upstream-data'

const realCatalog = async () => loadUpstreamData('catalog-products.json')
const realContent = async () => loadUpstreamData('content-products.json')

interface ProductBody {
  id: string
  name: string
  priceCents: number
  compareAtPriceCents: number | null
  rating: { average: number; count: number } | null
  headline: string | null
  descriptionHtml: string | null
}

describe('GET /api/products', () => {
  let app: INestApplication | undefined

  afterEach(async () => {
    await app?.close()
    app = undefined
  })

  async function get(overrides: Partial<UpstreamStub> = {}) {
    app = await createTestApp({
      getCatalogProducts: realCatalog,
      getContentProducts: realContent,
      ...overrides,
    })
    return request(app.getHttpServer()).get('/api/products')
  }

  const productById = (body: { products: ProductBody[] }, id: string) =>
    body.products.find((p) => p.id === id)

  it('C-1 returns the three active products in catalog order', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(res.body.products.map((p: ProductBody) => p.name)).toEqual([
      'Saatva Classic',
      'Loom & Leaf',
      'Zenhaven',
    ])
  })

  it('C-2 prices', async () => {
    const res = await get()
    expect(productById(res.body, 'LNL-Q')).toMatchObject({
      priceCents: 119900,
      compareAtPriceCents: 129900,
    })
    expect(productById(res.body, 'SAT-CLASSIC-Q')).toMatchObject({
      priceCents: 99900,
      compareAtPriceCents: null,
    })
  })

  it('C-3 Zenhaven has its content', async () => {
    const res = await get()
    const zenhaven = productById(res.body, 'ZEN-Q')
    expect(zenhaven?.headline).toEqual(expect.any(String))
    expect(zenhaven?.rating).toEqual({ average: 4.5, count: 2140 })
  })

  it('C-4 Loom & Leaf rating is numeric', async () => {
    const res = await get()
    expect(productById(res.body, 'LNL-Q')?.rating).toEqual({ average: 4, count: 1876 })
  })

  it('C-5 orphan content does not appear', async () => {
    const res = await get()
    expect(res.text).not.toContain('Designed for growing kids')
  })

  it('C-5 discontinued items do not appear', async () => {
    const catalog = loadUpstreamData('catalog-products.json') as { data: object[] }
    const withDiscontinued = {
      ...catalog,
      data: [
        ...catalog.data,
        {
          sku: 'OLD-Q',
          productHandle: 'old-mattress',
          displayName: 'Old Mattress',
          priceCents: '10000',
          salePriceCents: null,
          imageKey: 'old-image',
          status: 'discontinued',
        },
      ],
    }
    const res = await get({ getCatalogProducts: async () => withDiscontinued })
    expect(res.status).toBe(200)
    expect(res.body.products.map((p: ProductBody) => p.id)).toEqual([
      'SAT-CLASSIC-Q',
      'LNL-Q',
      'ZEN-Q',
    ])
  })

  it.each([
    ['rejects', failing],
    ['resolves an invalid body', async () => ({})],
  ])('C-6 content failing → 200 with null content (%s)', async (_label, getContentProducts) => {
    const res = await get({ getContentProducts })
    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(3)
    for (const product of res.body.products as ProductBody[]) {
      expect(product.rating).toBeNull()
      expect(product.headline).toBeNull()
      expect(product.descriptionHtml).toBeNull()
    }
  })

  it.each([
    ['rejects', failing],
    ['resolves an invalid body', async () => ({})],
  ])('C-7 catalog failing → 503 (%s)', async (_label, getCatalogProducts) => {
    const res = await get({ getCatalogProducts })
    expect(res.status).toBe(503)
    expect(res.body).toEqual({
      statusCode: 503,
      message: 'Product catalog is temporarily unavailable',
      error: 'Service Unavailable',
    })
  })

  it('C-8 no upstream field names in the response', async () => {
    const res = await get()
    const text = JSON.stringify(res.body)
    for (const name of [
      'productHandle',
      'displayName',
      'imageKey',
      'reviews',
      '"handle"',
      'salePriceCents',
    ]) {
      expect(text).not.toContain(name)
    }
  })

  it('C-9 descriptions arrive sanitized with formatting intact', async () => {
    const content = loadUpstreamData('content-products.json') as {
      handle: string
      descriptionHtml: string
    }[]
    const source = content.find((c) => c.handle === 'saatva-classic')?.descriptionHtml
    const res = await get()
    expect(productById(res.body, 'SAT-CLASSIC-Q')?.descriptionHtml).toBe(source)
  })

  it('empty active catalog → 200 with products: []', async () => {
    const res = await get({
      getCatalogProducts: async () => ({ meta: { currency: 'USD' }, data: [] }),
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ products: [] })
  })
})
