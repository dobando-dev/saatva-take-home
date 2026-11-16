import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestApp, type UpstreamStub } from '../testing/create-test-app'
import { failing, loadUpstreamData } from '../testing/upstream-data'

const realCatalog = async () => loadUpstreamData('catalog-products.json')
const realContent = async () => loadUpstreamData('content-products.json')

const cookieHeader = (lines: unknown) => `cart=${encodeURIComponent(JSON.stringify(lines))}`

function setCookies(res: request.Response): string[] {
  const header = res.headers['set-cookie'] as unknown
  return Array.isArray(header) ? (header as string[]) : []
}

/** The `cart=…` name/value pair (no attributes) from `set-cookie`, ready to send back. */
function cartCookie(res: request.Response): string {
  const cookie = setCookies(res).find((c) => c.startsWith('cart='))
  if (!cookie) throw new Error('no cart cookie in response')
  return cookie.split(';')[0]
}

describe('cart API', () => {
  let app: INestApplication | undefined

  afterEach(async () => {
    await app?.close()
    app = undefined
  })

  async function server(overrides: Partial<UpstreamStub> = {}) {
    app = await createTestApp({
      getCatalogProducts: realCatalog,
      getContentProducts: realContent,
      ...overrides,
    })
    return app.getHttpServer()
  }

  it('K-1 no cookie → empty cart', async () => {
    const res = await request(await server()).get('/api/cart')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ items: [], itemCount: 0, totalCents: 0, currency: 'USD' })
    expect(setCookies(res)).toEqual([])
  })

  it('K-2 adding twice gives one line of 2 and an HttpOnly cookie', async () => {
    const http = await server()
    const first = await request(http).post('/api/cart/items').send({ productId: 'LNL-Q' })
    expect(first.status).toBe(200)
    const second = await request(http)
      .post('/api/cart/items')
      .set('Cookie', cartCookie(first))
      .send({ productId: 'LNL-Q' })
    expect(second.status).toBe(200)
    expect(second.body.items).toHaveLength(1)
    expect(second.body.items[0]).toMatchObject({
      productId: 'LNL-Q',
      quantity: 2,
      unitPriceCents: 119900,
      lineTotalCents: 239800,
    })
    const header = setCookies(second)[0]
    expect(header).toMatch(/^cart=/)
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=Lax')
    expect(header).toContain('Path=/')
    expect(header).toContain('Max-Age=2592000')
  })

  it('K-3 cookie round trip', async () => {
    const http = await server()
    const added = await request(http).post('/api/cart/items').send({ productId: 'ZEN-Q' })
    const res = await request(http).get('/api/cart').set('Cookie', cartCookie(added))
    expect(res.status).toBe(200)
    expect(res.body).toEqual(added.body)
    expect(setCookies(res)).toEqual([])
  })

  describe('K-4 PUT', () => {
    it('sets the absolute quantity', async () => {
      const http = await server()
      const res = await request(http)
        .put('/api/cart/items/LNL-Q')
        .set('Cookie', cookieHeader([['LNL-Q', 1]]))
        .send({ quantity: 3 })
      expect(res.status).toBe(200)
      expect(res.body.items[0]).toMatchObject({ productId: 'LNL-Q', quantity: 3 })
      expect(res.body.itemCount).toBe(3)
      expect(decodeURIComponent(cartCookie(res))).toBe('cart=[["LNL-Q",3]]')
    })

    it.each([[0], [11], [1.5], ['3']])('rejects quantity %j with 400', async (quantity) => {
      const http = await server()
      const res = await request(http)
        .put('/api/cart/items/LNL-Q')
        .set('Cookie', cookieHeader([['LNL-Q', 1]]))
        .send({ quantity })
      expect(res.status).toBe(400)
      expect(setCookies(res)).toEqual([])
    })

    it('404 when the product is not in the cart', async () => {
      const http = await server()
      const res = await request(http)
        .put('/api/cart/items/ZEN-Q')
        .set('Cookie', cookieHeader([['LNL-Q', 1]]))
        .send({ quantity: 2 })
      expect(res.status).toBe(404)
      expect(res.body.message).toBe('Product is not in the cart')
    })
  })

  it('K-5 DELETE removes the line; repeating it returns 200 unchanged', async () => {
    const http = await server()
    const cookie = cookieHeader([
      ['LNL-Q', 2],
      ['ZEN-Q', 1],
    ])
    const first = await request(http).delete('/api/cart/items/LNL-Q').set('Cookie', cookie)
    expect(first.status).toBe(200)
    expect(first.body.items.map((i: { productId: string }) => i.productId)).toEqual(['ZEN-Q'])
    const again = await request(http)
      .delete('/api/cart/items/LNL-Q')
      .set('Cookie', cartCookie(first))
    expect(again.status).toBe(200)
    expect(again.body).toEqual(first.body)
  })

  describe('POST validation', () => {
    it('K-6 rejects unknown products', async () => {
      const res = await request(await server())
        .post('/api/cart/items')
        .send({ productId: 'NOPE' })
      expect(res.status).toBe(400)
      expect(res.body.message).toBe('Unknown product')
      expect(setCookies(res)).toEqual([])
    })

    it('K-6 rejects discontinued products', async () => {
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
      const res = await request(await server({ getCatalogProducts: async () => withDiscontinued }))
        .post('/api/cart/items')
        .send({ productId: 'OLD-Q' })
      expect(res.status).toBe(400)
    })

    it('K-6 clamps the quantity at 10', async () => {
      const http = await server()
      const first = await request(http)
        .post('/api/cart/items')
        .send({ productId: 'LNL-Q', quantity: 7 })
      const second = await request(http)
        .post('/api/cart/items')
        .set('Cookie', cartCookie(first))
        .send({ productId: 'LNL-Q', quantity: 7 })
      expect(second.status).toBe(200)
      expect(second.body.items[0].quantity).toBe(10)
    })

    it.each([[{ productId: 123 }], [{}], [{ productId: 'LNL-Q', quantity: 0 }]])(
      'rejects the malformed body %j',
      async (body) => {
        const res = await request(await server())
          .post('/api/cart/items')
          .send(body)
        expect(res.status).toBe(400)
        expect(setCookies(res)).toEqual([])
      },
    )
  })

  describe('K-7 hostile cookies never yield a wrong price', () => {
    it('garbage → empty cart', async () => {
      const res = await request(await server())
        .get('/api/cart')
        .set('Cookie', 'cart=garbage')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ items: [], itemCount: 0, totalCents: 0, currency: 'USD' })
    })

    it('unknown products are dropped and the cookie is rewritten', async () => {
      const res = await request(await server())
        .get('/api/cart')
        .set(
          'Cookie',
          cookieHeader([
            ['NOPE', 1],
            ['LNL-Q', 1],
          ]),
        )
      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0]).toMatchObject({ productId: 'LNL-Q', unitPriceCents: 119900 })
      expect(decodeURIComponent(cartCookie(res))).toBe('cart=[["LNL-Q",1]]')
    })

    it('oversized quantity is clamped', async () => {
      const res = await request(await server())
        .get('/api/cart')
        .set('Cookie', cookieHeader([['LNL-Q', 999]]))
      expect(res.body.items[0].quantity).toBe(10)
    })
  })

  it('K-8 totals', async () => {
    const http = await server()
    const first = await request(http).post('/api/cart/items').send({ productId: 'SAT-CLASSIC-Q' })
    const second = await request(http)
      .post('/api/cart/items')
      .set('Cookie', cartCookie(first))
      .send({ productId: 'LNL-Q', quantity: 2 })
    expect(second.body.itemCount).toBe(3)
    expect(second.body.totalCents).toBe(339700)
    expect(second.body.currency).toBe('USD')
  })

  describe('K-9 catalog down', () => {
    const unavailable = {
      statusCode: 503,
      message: 'Cart is temporarily unavailable',
      error: 'Service Unavailable',
    }

    it('GET with lines → 503 and no cookie', async () => {
      const http = await server({ getCatalogProducts: failing })
      const res = await request(http)
        .get('/api/cart')
        .set('Cookie', cookieHeader([['LNL-Q', 1]]))
      expect(res.status).toBe(503)
      expect(res.body).toEqual(unavailable)
      expect(setCookies(res)).toEqual([])
    })

    it('POST → 503 and no cookie', async () => {
      const http = await server({ getCatalogProducts: failing })
      const res = await request(http)
        .post('/api/cart/items')
        .set('Cookie', cookieHeader([['LNL-Q', 1]]))
        .send({ productId: 'LNL-Q' })
      expect(res.status).toBe(503)
      expect(res.body).toEqual(unavailable)
      expect(setCookies(res)).toEqual([])
    })

    it('PUT → 503 and no cookie', async () => {
      const http = await server({ getCatalogProducts: failing })
      const res = await request(http)
        .put('/api/cart/items/LNL-Q')
        .set('Cookie', cookieHeader([['LNL-Q', 1]]))
        .send({ quantity: 2 })
      expect(res.status).toBe(503)
      expect(res.body).toEqual(unavailable)
      expect(setCookies(res)).toEqual([])
    })

    it('DELETE → 503 and no cookie', async () => {
      const http = await server({ getCatalogProducts: failing })
      const res = await request(http)
        .delete('/api/cart/items/LNL-Q')
        .set('Cookie', cookieHeader([['LNL-Q', 1]]))
      expect(res.status).toBe(503)
      expect(res.body).toEqual(unavailable)
      expect(setCookies(res)).toEqual([])
    })

    it('GET without a cookie → 200 with the empty cart', async () => {
      const http = await server({ getCatalogProducts: failing })
      const res = await request(http).get('/api/cart')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ items: [], itemCount: 0, totalCents: 0, currency: 'USD' })
    })
  })

  it('K-10 content down does not affect the cart', async () => {
    const http = await server({ getContentProducts: failing })
    const res = await request(http).post('/api/cart/items').send({ productId: 'LNL-Q' })
    expect(res.status).toBe(200)
    expect(res.body.items[0]).toMatchObject({ productId: 'LNL-Q', quantity: 1 })
  })
})
