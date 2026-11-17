import { formatCount } from '@/lib/format'
import type { ProductRating } from '@/lib/types'

const STARS = '★★★★★'

export function Rating({ rating }: { rating: ProductRating | null }) {
  if (!rating) return null

  const { average, count } = rating
  const fill = ((Math.round(average * 2) / 2 / 5) * 100).toFixed(0)
  const average1 = average.toFixed(1)
  const reviews = `${formatCount(count)} ${count === 1 ? 'review' : 'reviews'}`

  return (
    <div className="rating" role="img" aria-label={`Rated ${average1} out of 5, ${reviews}`}>
      <span className="rating__stars" aria-hidden="true">
        <span className="rating__stars-empty">{STARS}</span>
        <span className="rating__stars-filled" style={{ width: `${fill}%` }}>
          {STARS}
        </span>
      </span>
      <span className="rating__text" aria-hidden="true">
        {average1} ({reviews})
      </span>
    </div>
  )
}
