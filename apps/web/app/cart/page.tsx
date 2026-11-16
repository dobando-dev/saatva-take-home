import type { Metadata } from 'next'
import { CartView } from '@/components/cart/CartView'

export const metadata: Metadata = {
  title: 'Saatva | Your Cart',
}

export default function CartPage() {
  return (
    <section className="cart">
      <h1 className="cart__title">Your Cart</h1>
      <CartView />
    </section>
  )
}
