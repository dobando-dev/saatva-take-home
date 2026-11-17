'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { Price } from '@/components/Price'
import { formatPrice } from '@/lib/format'
import { MAX_CART_QUANTITY } from '@/lib/types'

const CART_TITLE_ID = 'cart-title'

export function CartView() {
  const { cart, pending, error, setQuantity, remove, refresh } = useCart()
  const lineCount = cart?.items.length ?? 0
  const previousLineCount = useRef(lineCount)

  // A removed row takes keyboard focus with it; hand focus to the page heading.
  useEffect(() => {
    if (lineCount < previousLineCount.current) {
      document.getElementById(CART_TITLE_ID)?.focus()
    }
    previousLineCount.current = lineCount
  }, [lineCount])

  if (!cart) {
    return (
      <div className="cart__message">
        <p role="alert">We couldn&apos;t load your cart.</p>
        <button
          type="button"
          className="button button--secondary"
          disabled={pending}
          onClick={() => refresh()}
        >
          Try again
        </button>
      </div>
    )
  }

  if (cart.items.length === 0) {
    return (
      <div className="cart__message">
        <p>Your cart is empty.</p>
        <Link href="/" className="cart__link">
          Continue shopping
        </Link>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="cart__message cart__message--error">
          <p role="alert">{error}</p>
          <button
            type="button"
            className="button button--secondary"
            disabled={pending}
            onClick={() => refresh()}
          >
            Try again
          </button>
        </div>
      )}
      <ul className="cart__list">
        {cart.items.map((item) => (
          <li key={item.productId} className="cart-line">
            <img
              className="cart-line__image"
              src={item.image.src}
              alt={item.image.alt}
              width={1680}
              height={640}
            />
            <div className="cart-line__details">
              <h2 className="cart-line__name">{`${item.name} Mattress`}</h2>
              <Price
                priceCents={item.unitPriceCents}
                compareAtPriceCents={item.compareAtPriceCents}
                currency={cart.currency}
              />
            </div>
            <div className="cart-line__actions">
              <div className="cart-line__quantity">
                <button
                  type="button"
                  className="button button--secondary button--small"
                  aria-label={`Decrease quantity of ${item.name}`}
                  disabled={pending || item.quantity <= 1}
                  onClick={() => setQuantity(item.productId, item.quantity - 1)}
                >
                  −
                </button>
                <span className="cart-line__count">{item.quantity}</span>
                <button
                  type="button"
                  className="button button--secondary button--small"
                  aria-label={`Increase quantity of ${item.name}`}
                  disabled={pending || item.quantity >= MAX_CART_QUANTITY}
                  onClick={() => setQuantity(item.productId, item.quantity + 1)}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="cart-line__remove"
                disabled={pending}
                onClick={() => remove(item.productId)}
              >
                Remove
              </button>
            </div>
            <p className="cart-line__total">{formatPrice(item.lineTotalCents, cart.currency)}</p>
          </li>
        ))}
      </ul>
      <p className="cart__total">
        <span>Total</span>
        <span>{formatPrice(cart.totalCents, cart.currency)}</span>
      </p>
      <Link href="/" className="cart__link">
        Continue shopping
      </Link>
    </>
  )
}
