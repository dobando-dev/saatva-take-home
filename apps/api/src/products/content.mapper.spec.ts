import { describe, expect, it, vi } from 'vitest'
import { loadUpstreamData } from '../testing/upstream-data'
import { mapContent, normalizeHandle } from './content.mapper'
import { UpstreamDataError } from './product.types'

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    handle: 'x',
    headline: 'Headline',
    descriptionHtml: '<p>Hi</p>',
    reviews: { average: 4, count: 10 },
    ...overrides,
  }
}

function ratingOf(reviews: unknown) {
  return mapContent([entry({ reviews })]).get('x')!.rating
}

describe('normalizeHandle', () => {
  it('trims and lowercases', () => {
    expect(normalizeHandle('  Zenhaven ')).toBe('zenhaven')
  })
})

describe('mapContent', () => {
  const content = mapContent(loadUpstreamData('content-products.json'))

  it('C-3 joins Zenhaven despite the casing mismatch', () => {
    const zenhaven = content.get('zenhaven')!
    expect(zenhaven.headline).toBe('Flippable natural latex, two firmness levels in one')
    expect(zenhaven.rating).toEqual({ average: 4.5, count: 2140 })
  })

  it('C-4 coerces string ratings', () => {
    expect(content.get('loom-and-leaf')!.rating).toEqual({ average: 4, count: 1876 })
  })

  it.each([
    [{ average: 7, count: 10 }],
    [{ average: 4, count: -1 }],
    [{ average: 4, count: 1.5 }],
    [undefined],
  ])('rating is null when out of range or malformed (%j)', (reviews) => {
    expect(ratingOf(reviews)).toBeNull()
  })

  it.each([
    [{ average: '', count: '' }],
    [{ average: null, count: null }],
    [{ average: ' ', count: '10' }],
  ])('blank or null rating values give null, not 0 (%j)', (reviews) => {
    expect(ratingOf(reviews)).toBeNull()
  })

  it('headline is trimmed; a missing or blank headline is null', () => {
    const map = mapContent([
      entry({ handle: 'a', headline: '  Padded  ' }),
      entry({ handle: 'b', headline: undefined }),
      entry({ handle: 'c', headline: '   ' }),
    ])
    expect(map.get('a')!.headline).toBe('Padded')
    expect(map.get('b')!.headline).toBeNull()
    expect(map.get('c')!.headline).toBeNull()
  })

  it('descriptionHtml is sanitized', () => {
    const map = mapContent([
      entry({ handle: 'a', descriptionHtml: '<p>Hi</p><script>x</script>' }),
      entry({ handle: 'b', descriptionHtml: 42 }),
    ])
    expect(map.get('a')!.descriptionHtml).toBe('<p>Hi</p>')
    expect(map.get('b')!.descriptionHtml).toBeNull()
  })

  it('an invalid field does not drop the entry', () => {
    const entryWithBadFields = entry({ headline: 5, descriptionHtml: null, reviews: 'nope' })
    expect(mapContent([entryWithBadFields]).get('x')).toEqual({
      headline: null,
      descriptionHtml: null,
      rating: null,
    })
  })

  it('duplicate handles: the first wins', () => {
    const map = mapContent([
      entry({ handle: 'Zenhaven', headline: 'First' }),
      entry({ handle: 'zenhaven', headline: 'Second' }),
    ])
    expect(map.size).toBe(1)
    expect(map.get('zenhaven')!.headline).toBe('First')
  })

  it('skips entries with a blank handle', () => {
    const warn = vi.fn()
    const map = mapContent([entry({ handle: '' }), entry({ handle: '   ' }), entry()], warn)
    expect([...map.keys()]).toEqual(['x'])
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('skips entries without a string handle', () => {
    const warn = vi.fn()
    const map = mapContent(
      [entry({ handle: undefined }), entry({ handle: 7 }), null, entry()],
      warn,
    )
    expect([...map.keys()]).toEqual(['x'])
    expect(warn).toHaveBeenCalledTimes(3)
  })

  it.each([[{}], [null]])('throws UpstreamDataError when the body is not an array (%j)', (body) => {
    expect(() => mapContent(body)).toThrow(UpstreamDataError)
  })
})
