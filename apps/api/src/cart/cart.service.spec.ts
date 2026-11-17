import { describe, expect, it } from 'vitest'
import { mapCatalog } from '../products/catalog.mapper'
import { loadUpstreamData } from '../testing/upstream-data'
import type { CartLine } from './cart.types'
import { addLine, priceCart, removeLine, setLineQuantity } from './cart.service'

const catalog = mapCatalog(loadUpstreamData('catalog-products.json'))

describe('cart operations', () => {
  it('addLine appends a new product with the given quantity', () => {
    expect(addLine([], 'LNL-Q', 2)).toEqual([['LNL-Q', 2]])
  })

  it('addLine adds to an existing line', () => {
    expect(addLine([['LNL-Q', 2]], 'LNL-Q', 3)).toEqual([['LNL-Q', 5]])
  })

  it('addLine clamps at 10', () => {
    expect(addLine([['LNL-Q', 9]], 'LNL-Q', 5)).toEqual([['LNL-Q', 10]])
  })

  it('addLine keeps first-add order', () => {
    const lines: CartLine[] = [
      ['SAT-CLASSIC-Q', 1],
      ['LNL-Q', 1],
    ]
    expect(addLine(lines, 'SAT-CLASSIC-Q', 1)).toEqual([
      ['SAT-CLASSIC-Q', 2],
      ['LNL-Q', 1],
    ])
    expect(lines).toEqual([
      ['SAT-CLASSIC-Q', 1],
      ['LNL-Q', 1],
    ])
  })

  it('addLine clamps a zero quantity on a new line up to 1', () => {
    expect(addLine([], 'LNL-Q', 0)).toEqual([['LNL-Q', 1]])
  })

  it('setLineQuantity sets the absolute quantity', () => {
    const lines: CartLine[] = [['LNL-Q', 2]]
    expect(setLineQuantity(lines, 'LNL-Q', 7)).toEqual([['LNL-Q', 7]])
    expect(lines).toEqual([['LNL-Q', 2]])
  })

  it('setLineQuantity returns null when the product is not in the cart', () => {
    expect(setLineQuantity([['LNL-Q', 2]], 'SAT-CLASSIC-Q', 3)).toBeNull()
  })

  it('removeLine removes the line', () => {
    const lines: CartLine[] = [
      ['SAT-CLASSIC-Q', 1],
      ['LNL-Q', 2],
    ]
    expect(removeLine(lines, 'LNL-Q')).toEqual([['SAT-CLASSIC-Q', 1]])
    expect(lines).toHaveLength(2)
  })

  it('removeLine is a no-op when absent', () => {
    expect(removeLine([['LNL-Q', 2]], 'SAT-CLASSIC-Q')).toEqual([['LNL-Q', 2]])
  })
})

describe('priceCart', () => {
  it('K-8 priceCart totals', () => {
    const { cart, lines } = priceCart(
      [
        ['SAT-CLASSIC-Q', 1],
        ['LNL-Q', 2],
      ],
      catalog,
    )
    expect(cart.itemCount).toBe(3)
    expect(cart.totalCents).toBe(339700)
    expect(cart.currency).toBe('USD')
    expect(cart.items[1]).toEqual({
      productId: 'LNL-Q',
      name: 'Loom & Leaf',
      image: { src: '/images/loom-carousel.jpg', alt: 'Loom & Leaf mattress' },
      unitPriceCents: 119900,
      compareAtPriceCents: 129900,
      quantity: 2,
      lineTotalCents: 239800,
    })
    expect(lines).toEqual([
      ['SAT-CLASSIC-Q', 1],
      ['LNL-Q', 2],
    ])
  })

  it('priceCart drops unknown products and returns the kept lines', () => {
    const { cart, lines } = priceCart(
      [
        ['NOPE', 3],
        ['LNL-Q', 1],
      ],
      catalog,
    )
    expect(lines).toEqual([['LNL-Q', 1]])
    expect(cart.items.map((item) => item.productId)).toEqual(['LNL-Q'])
    expect(cart.itemCount).toBe(1)
  })
})
