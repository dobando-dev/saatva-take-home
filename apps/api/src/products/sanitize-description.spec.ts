import { describe, expect, it } from 'vitest'
import { loadUpstreamData } from '../testing/upstream-data'
import { sanitizeDescription } from './sanitize-description'

describe('sanitizeDescription', () => {
  it('C-9 keeps the provided formatting', () => {
    const content = loadUpstreamData('content-products.json') as {
      handle: string
      descriptionHtml: string
    }[]
    const classic = content.find((entry) => entry.handle === 'saatva-classic')!
    expect(sanitizeDescription(classic.descriptionHtml)).toBe(classic.descriptionHtml)
  })

  it('C-9 removes <script> and its content', () => {
    expect(sanitizeDescription('<p>Hi</p><script>alert(1)</script>')).toBe('<p>Hi</p>')
  })

  it('C-9 removes event-handler attributes', () => {
    expect(sanitizeDescription('<p onclick="x()">Hi</p><img src=x onerror="alert(1)">')).toBe(
      '<p>Hi</p>',
    )
  })

  it('C-9 removes javascript: links and keeps their text', () => {
    expect(sanitizeDescription('<a href="javascript:alert(1)">Click</a>')).toBe('Click')
  })

  it('C-9 removes iframes', () => {
    expect(sanitizeDescription('<iframe src="https://evil.example"></iframe><p>ok</p>')).toBe(
      '<p>ok</p>',
    )
  })

  it('C-9 drops script inside svg', () => {
    expect(sanitizeDescription('<svg><script>alert(1)</script></svg><p>ok</p>')).toBe('<p>ok</p>')
  })

  it('C-9 drops style blocks and their content', () => {
    expect(sanitizeDescription('<style>p{color:red}</style><p>ok</p>')).toBe('<p>ok</p>')
  })

  it('C-9 keeps entity-encoded markup escaped', () => {
    const html = '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'
    expect(sanitizeDescription(html)).toBe(html)
  })

  it.each([['<script>x</script>'], ['']])('C-9 returns null when nothing is left (%j)', (html) => {
    expect(sanitizeDescription(html)).toBeNull()
  })
})
