import type { Metadata } from 'next'
import { CartView } from '@/components/cart/CartView'

export const metadata: Metadata = {
  title: 'Saatva | Your Cart',
}

export default function CartPage() {
  return (
    <section className="cart">
      <h1 id="cart-title" className="cart__title" tabIndex={-1}>
        Your Cart
      </h1>
      <CartView />
    </section>
  )
}
