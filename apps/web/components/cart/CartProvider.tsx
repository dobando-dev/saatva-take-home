'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { apiGet, apiSend } from '@/lib/api'
import type { Cart } from '@/lib/types'

const CART_ERROR = "We couldn't update your cart. Please try again."

interface CartContextValue {
  cart: Cart | null
  pending: boolean
  error: string | null
  add(productId: string): Promise<void>
  setQuantity(productId: string, quantity: number): Promise<void>
  remove(productId: string): Promise<void>
  refresh(): Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({
  initialCart,
  children,
}: {
  initialCart: Cart | null
  children: React.ReactNode
}) {
  const [cart, setCart] = useState<Cart | null>(initialCart)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pathname = usePathname()
  // State updates late, so two fast clicks could both pass a state check (K-11).
  const inFlight = useRef(false)

  // `error` is provider-global; don't let one page's failure show on the next page.
  useEffect(() => {
    setError(null)
  }, [pathname])

  const run = useCallback(async (request: () => Promise<Cart>) => {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      setCart(await request())
    } catch {
      setError(CART_ERROR)
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }, [])

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      pending,
      error,
      add: (productId) => run(() => apiSend<Cart>('POST', '/api/cart/items', { productId })),
      setQuantity: (productId, quantity) =>
        run(() =>
          apiSend<Cart>('PUT', `/api/cart/items/${encodeURIComponent(productId)}`, { quantity }),
        ),
      remove: (productId) =>
        run(() => apiSend<Cart>('DELETE', `/api/cart/items/${encodeURIComponent(productId)}`)),
      refresh: () => run(() => apiGet<Cart>('/api/cart')),
    }),
    [cart, pending, error, run],
  )

  return <CartContext value={value}>{children}</CartContext>
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart must be used within a CartProvider')
  return value
}
