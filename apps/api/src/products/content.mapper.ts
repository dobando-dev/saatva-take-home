import { z } from 'zod'
import { sanitizeDescription } from './sanitize-description'
import { UpstreamDataError, type ProductContent, type ProductRating } from './product.types'

const contentEntrySchema = z.object({
  handle: z.string().trim().min(1),
  headline: z.unknown().optional(),
  descriptionHtml: z.unknown().optional(),
  reviews: z.unknown().optional(),
})

const ratingSchema = z.object({ average: z.unknown(), count: z.unknown() })

export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase()
}

function parseHeadline(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function parseAverage(value: unknown): number | null {
  let average: number
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)) {
    average = Number(value)
  } else if (typeof value === 'number') {
    average = value
  } else {
    return null
  }
  return Number.isFinite(average) && average >= 0 && average <= 5 ? average : null
}

function parseCount(value: unknown): number | null {
  let count: number
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    count = Number(value)
  } else if (typeof value === 'number') {
    count = value
  } else {
    return null
  }
  return Number.isSafeInteger(count) && count >= 0 ? count : null
}

function parseRating(value: unknown): ProductRating | null {
  const reviews = ratingSchema.safeParse(value)
  if (!reviews.success) return null
  const average = parseAverage(reviews.data.average)
  const count = parseCount(reviews.data.count)
  if (average === null || count === null) return null
  return { average, count }
}

/**
 * Validates the content body and maps each entry to internal `ProductContent`, keyed by
 * normalized handle. This is the content-v2 swap point (D3): a 10-point source would be divided
 * by 2 here (D4). A non-array body throws; an entry without a non-blank string handle is skipped with a
 * warning; an invalid field becomes null without dropping the entry. The first duplicate wins.
 */
export function mapContent(
  raw: unknown,
  warn: (message: string) => void = () => {},
): Map<string, ProductContent> {
  if (!Array.isArray(raw)) {
    throw new UpstreamDataError('Content response is not a valid content list')
  }

  const content = new Map<string, ProductContent>()

  raw.forEach((entry: unknown, index) => {
    const parsed = contentEntrySchema.safeParse(entry)
    if (!parsed.success) {
      warn(`Skipping content entry at index ${index}: missing or blank handle`)
      return
    }
    const item = parsed.data
    const key = normalizeHandle(item.handle)
    if (content.has(key)) {
      warn(`Skipping content entry ${item.handle}: duplicate handle`)
      return
    }
    content.set(key, {
      headline: parseHeadline(item.headline),
      descriptionHtml:
        typeof item.descriptionHtml === 'string' ? sanitizeDescription(item.descriptionHtml) : null,
      rating: parseRating(item.reviews),
    })
  })

  return content
}
