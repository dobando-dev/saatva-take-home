import { MAX_LINES, MAX_QUANTITY, type CartLine } from './cart.types'

export const CART_COOKIE = 'cart'

const MAX_RAW_LENGTH = 4096
const MAX_PRODUCT_ID_LENGTH = 64
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function parseLine(entry: unknown): [string, number] | null {
  if (!Array.isArray(entry) || entry.length !== 2) return null
  const [productId, quantity] = entry as unknown[]
  if (
    typeof productId !== 'string' ||
    productId.length < 1 ||
    productId.length > MAX_PRODUCT_ID_LENGTH ||
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity)
  ) {
    return null
  }
  return [productId, Math.min(MAX_QUANTITY, Math.max(1, quantity))]
}

/** Defensive: anything malformed decodes to an empty cart, never throws. */
export function decodeCart(raw: unknown): CartLine[] {
  if (typeof raw !== 'string' || raw.length > MAX_RAW_LENGTH) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const merged = new Map<string, number>()
  for (const entry of parsed) {
    const line = parseLine(entry)
    if (!line) return []
    merged.set(line[0], Math.min(MAX_QUANTITY, (merged.get(line[0]) ?? 0) + line[1]))
  }
  return [...merged].slice(0, MAX_LINES)
}

export function encodeCart(lines: CartLine[]): string {
  return JSON.stringify(lines)
}

export function cartCookieOptions(): {
  httpOnly: true
  sameSite: 'lax'
  path: '/'
  maxAge: number
  secure: boolean
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS_MS,
    secure: process.env.NODE_ENV === 'production',
  }
}
