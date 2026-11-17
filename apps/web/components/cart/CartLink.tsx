'use client'

import Link from 'next/link'
import { useCart } from '@/components/cart/CartProvider'

export function CartLink() {
  const { cart } = useCart()
  const count = cart?.itemCount ?? 0
  const label = cart ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Cart'

  return (
    <Link href="/cart" className="site-header__cart" aria-label={label}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="20" r="1.25" fill="currentColor" />
        <circle cx="17" cy="20" r="1.25" fill="currentColor" />
      </svg>
      <span className="site-header__badge" aria-live="polite">
        {count > 0 ? count : ''}
      </span>
    </Link>
  )
}
