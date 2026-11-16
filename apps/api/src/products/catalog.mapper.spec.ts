import { describe, expect, it, vi } from 'vitest'
import { loadUpstreamData } from '../testing/upstream-data'
import { mapCatalog, parseCents } from './catalog.mapper'
import { UpstreamDataError } from './product.types'

function catalogWith(...data: unknown[]): unknown {
  return { meta: { currency: 'USD' }, data }
}

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sku: 'X-1',
    productHandle: 'x',
    displayName: 'X',
    priceCents: '10000',
    salePriceCents: null,
    imageKey: 'x-image',
    status: 'active',
    ...overrides,
  }
}

describe('mapCatalog', () => {
  const catalog = mapCatalog(loadUpstreamData('catalog-products.json'))
  const byId = (id: string) => catalog.items.find((i) => i.id === id)

  it('C-1 maps the provided catalog in catalog order', () => {
    expect(catalog.items.map((i) => i.id)).toEqual(['SAT-CLASSIC-Q', 'LNL-Q', 'ZEN-Q'])
    expect(catalog.currency).toBe('USD')
  })

  it('C-2 applies an active sale', () => {
    expect(byId('LNL-Q')).toMatchObject({ priceCents: 119900, compareAtPriceCents: 129900 })
    expect(byId('SAT-CLASSIC-Q')).toMatchObject({ priceCents: 99900, compareAtPriceCents: null })
  })

  it('D5 resolves the image', () => {
    expect(byId('LNL-Q')?.image).toEqual({
      src: '/images/loom-carousel.jpg',
      alt: 'Loom & Leaf mattress',
    })
    expect(byId('LNL-Q')?.handle).toBe('loom-and-leaf')
  })

  it('C-5 excludes discontinued items', () => {
    const result = mapCatalog(catalogWith(item({ sku: 'OLD', status: 'discontinued' }), item()))
    expect(result.items.map((i) => i.id)).toEqual(['X-1'])
  })

  it.each(['12.50', '-100', '0', 'abc', null])(
    'drops items with an invalid list price (%j) and warns',
    (priceCents) => {
      const warn = vi.fn()
      const result = mapCatalog(catalogWith(item({ priceCents })), warn)
      expect(result.items).toEqual([])
      expect(warn).toHaveBeenCalled()
    },
  )

  it('ignores a sale that is invalid or not lower than list', () => {
    const result = mapCatalog(
      catalogWith(
        item({ sku: 'A', priceCents: '129900', salePriceCents: '129900' }),
        item({ sku: 'B', priceCents: '129900', salePriceCents: 'abc' }),
      ),
    )
    expect(result.items).toHaveLength(2)
    for (const i of result.items) {
      expect(i).toMatchObject({ priceCents: 129900, compareAtPriceCents: null })
    }
  })

  it('accepts integer prices sent as numbers', () => {
    const result = mapCatalog(catalogWith(item({ priceCents: 99900 })))
    expect(result.items[0].priceCents).toBe(99900)
  })

  it('Review focus: duplicate SKU keeps the first', () => {
    const warn = vi.fn()
    const result = mapCatalog(
      catalogWith(
        item({ sku: 'X', displayName: 'First' }),
        item({ sku: 'X', displayName: 'Second' }),
      ),
      warn,
    )
    expect(result.items.map((i) => i.name)).toEqual(['First'])
    expect(warn).toHaveBeenCalled()
  })

  it.each(['../secret', 'a.jpg?x'])(
    'Review focus: unsafe imageKey %j drops the product',
    (imageKey) => {
      const warn = vi.fn()
      const result = mapCatalog(catalogWith(item({ imageKey })), warn)
      expect(result.items).toEqual([])
      expect(warn).toHaveBeenCalled()
    },
  )

  it.each([[{}], [[]], [null], [{ meta: { currency: 'usd' }, data: [] }]])(
    'throws UpstreamDataError when the body is not a catalog (%j)',
    (body) => {
      expect(() => mapCatalog(body)).toThrow(UpstreamDataError)
    },
  )
})

describe('parseCents', () => {
  it('parses digit strings and integer numbers, rejects the rest', () => {
    expect(parseCents('99900')).toBe(99900)
    expect(parseCents(500)).toBe(500)
    expect(parseCents('0')).toBeNull()
    expect(parseCents(1.5)).toBeNull()
    expect(parseCents(' 100')).toBeNull()
    expect(parseCents('99999999999999999999')).toBeNull()
    expect(parseCents(undefined)).toBeNull()
  })
})
