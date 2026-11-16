'use client'

import { useState } from 'react'
import { MattressToggle } from '@/components/MattressToggle'
import { Price } from '@/components/Price'
import { Rating } from '@/components/Rating'
import type { Product } from '@/lib/types'

export function ProductConfigurator({ products }: { products: Product[] }) {
  const [selectedId, setSelectedId] = useState(products[0].id)
  const product = products.find((p) => p.id === selectedId) ?? products[0]

  return (
    <section className="configurator">
      <img
        className="configurator__image"
        src={product.image.src}
        alt={product.image.alt}
        width={1680}
        height={640}
      />
      <div className="configurator__details">
        <h1 className="configurator__title">Choose Your Mattress</h1>
        <p id="mattress-type-label" className="configurator__label">
          Select mattress type
        </p>
        <MattressToggle
          options={products.map((p) => ({ id: p.id, label: p.name }))}
          value={product.id}
          onChange={setSelectedId}
          labelledBy="mattress-type-label"
        />
        <div className="configurator__summary">
          <h2 className="configurator__name">{`${product.name} Mattress`}</h2>
          <Price
            priceCents={product.priceCents}
            compareAtPriceCents={product.compareAtPriceCents}
            currency={product.currency}
          />
        </div>
        <Rating rating={product.rating} />
        {product.headline && <p className="configurator__headline">{product.headline}</p>}
        {product.descriptionHtml && (
          <div
            className="configurator__description"
            dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
          />
        )}
        <button type="button" className="button button--primary">
          Add to Cart
        </button>
      </div>
    </section>
  )
}
