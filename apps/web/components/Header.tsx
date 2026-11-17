import Link from 'next/link'
import { CartLink } from '@/components/cart/CartLink'

export function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-header__logo">
          Saatva
        </Link>
        <CartLink />
      </div>
    </header>
  )
}
