import { describe, expect, it } from 'vitest'
import type { UpstreamClient } from '../upstream/upstream.client'
import { failing, loadUpstreamData } from '../testing/upstream-data'
import { CatalogUnavailableError } from './product.types'
import { ProductsService } from './products.service'

function serviceWith(getCatalogProducts: () => Promise<unknown>) {
  const upstream = { getCatalogProducts, getContentProducts: failing }
  return new ProductsService(upstream as unknown as UpstreamClient)
}

describe('ProductsService.getCatalog', () => {
  it('returns the active catalog items', async () => {
    const catalog = await serviceWith(async () =>
      loadUpstreamData('catalog-products.json'),
    ).getCatalog()
    expect(catalog.items.map((i) => i.id)).toEqual(['SAT-CLASSIC-Q', 'LNL-Q', 'ZEN-Q'])
  })

  it.each([
    ['the upstream call rejects', failing],
    ['the body is not a catalog', async () => ({})],
  ])('throws CatalogUnavailableError when %s', async (_label, getCatalogProducts) => {
    await expect(serviceWith(getCatalogProducts).getCatalog()).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    )
  })
})
