import { afterEach, describe, expect, it, vi } from 'vitest'
import { cartCookieOptions, decodeCart, encodeCart } from './cart.cookie'
import type { CartLine } from './cart.types'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('cart cookie codec', () => {
  it('encodes and decodes a round trip', () => {
    const lines: CartLine[] = [
      ['SAT-CLASSIC-Q', 1],
      ['LNL-Q', 4],
    ]
    expect(decodeCart(encodeCart(lines))).toEqual(lines)
  })

  it.each([
    [undefined],
    [''],
    ['not json'],
    ['{}'],
    ['[["LNL-Q","2"]]'],
    ['[["LNL-Q",1.5]]'],
    ['[[1,2]]'],
    ['[["LNL-Q"]]'],
    ['[["LNL-Q",1,100]]'],
    ['[{"productId":"LNL-Q","priceCents":1}]'],
  ])('K-7 garbage decodes to an empty cart: %s', (raw) => {
    expect(decodeCart(raw)).toEqual([])
  })

  it('K-7 clamps quantities to 1–10', () => {
    expect(decodeCart('[["LNL-Q",999]]')).toEqual([['LNL-Q', 10]])
    expect(decodeCart('[["LNL-Q",0]]')).toEqual([['LNL-Q', 1]])
  })

  it('merges duplicate product IDs', () => {
    expect(decodeCart('[["LNL-Q",6],["LNL-Q",7]]')).toEqual([['LNL-Q', 10]])
  })

  it('keeps at most 20 lines', () => {
    const lines = Array.from({ length: 25 }, (_, i) => [`P-${i}`, 1])
    const decoded = decodeCart(JSON.stringify(lines))
    expect(decoded).toHaveLength(20)
    expect(decoded[0]).toEqual(['P-0', 1])
    expect(decoded[19]).toEqual(['P-19', 1])
  })

  it.each([
    ['an oversized raw value', `[["LNL-Q",1]${' '.repeat(4100)}]`],
    ['an empty product ID', '[["",1]]'],
    ['a 65-char product ID', JSON.stringify([['x'.repeat(65), 1]])],
  ])('hostile values decode to an empty cart: %s', (_name, raw) => {
    expect(decodeCart(raw)).toEqual([])
  })

  it.each([[{ a: 1 }], [42], [null]])('non-string raw value %j decodes to an empty cart', (raw) => {
    expect(decodeCart(raw)).toEqual([])
  })

  it('decodes a valid raw string of exactly 4096 chars (the guard is > 4096)', () => {
    const head = '[["LNL-Q",1]'
    const raw = head + ' '.repeat(4096 - head.length - 1) + ']'
    expect(raw).toHaveLength(4096)
    expect(decodeCart(raw)).toEqual([['LNL-Q', 1]])
  })

  it.each([
    ['1e400 (Infinity)', '[["LNL-Q",1e400]]', []],
    ['1e21 (huge integer)', '[["LNL-Q",1e21]]', [['LNL-Q', 10]]],
    ['a negative quantity', '[["LNL-Q",-5]]', [['LNL-Q', 1]]],
    ['a __proto__ product ID', '[["__proto__",1]]', [['__proto__', 1]]],
    ['a null entry', '[null]', []],
    ['a boolean quantity', '[["LNL-Q",true]]', []],
  ])('hostile value decodes predictably: %s', (_name, raw, expected) => {
    expect(decodeCart(raw)).toEqual(expected)
  })

  it('cookie options', () => {
    expect(cartCookieOptions()).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 2592000000,
      secure: false,
    })
    vi.stubEnv('NODE_ENV', 'production')
    expect(cartCookieOptions().secure).toBe(true)
  })
})
