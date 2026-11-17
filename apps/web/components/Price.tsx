import { formatPrice } from '@/lib/format'

interface PriceProps {
  priceCents: number
  compareAtPriceCents: number | null
  currency: string
}

export function Price({ priceCents, compareAtPriceCents, currency }: PriceProps) {
  return (
    <span className="price">
      <span className="price__current">{formatPrice(priceCents, currency)}</span>
      {compareAtPriceCents !== null && (
        <s className="price__compare">
          <span className="visually-hidden">Regular price: </span>
          {formatPrice(compareAtPriceCents, currency)}
        </s>
      )}
    </span>
  )
}
