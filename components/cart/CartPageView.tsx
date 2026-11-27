'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
} from 'lucide-react'
import type { StorefrontStore } from '@/lib/storefront/types'
import { useCart } from './CartContext'

export default function CartPageView({ store }: { store: StorefrontStore }) {
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    currency,
    isHydrated,
  } = useCart()

  if (!isHydrated) {
    return (
      <main className="mx-auto max-w-[var(--th-spacing-container)] px-4 py-16 text-center">
        <div className="h-8 w-32 bg-[var(--th-color-border)]/50 rounded mx-auto animate-pulse" />
      </main>
    )
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-[var(--th-spacing-container)] px-4 py-20 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--th-color-border)]/30 text-[var(--th-color-muted)] mb-6">
          <ShoppingBag className="h-10 w-10 opacity-40" />
        </div>
        <h1 className="[font-family:var(--th-font-heading)] text-2xl [font-weight:var(--th-font-heading-weight)] text-[var(--th-color-text)] sm:text-3xl">
          Your Shopping Bag is Empty
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--th-color-muted)]">
          Discover our curated collection of architectural designs and limited editions.
        </p>
        <div className="mt-8">
          <Link
            href={`/store/${store.slug}`}
            className="inline-flex items-center gap-2 rounded-[var(--th-radius-button)] bg-[var(--th-color-primary)] px-6 py-3 text-sm font-semibold text-[var(--surface)] transition-colors hover:bg-[var(--th-color-accent)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Explore Collection</span>
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[var(--th-spacing-container)] px-4 py-10 sm:py-16">
      {/* Title Header */}
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--th-color-border)] pb-6">
        <div>
          <h1 className="[font-family:var(--th-font-heading)] text-3xl [font-weight:var(--th-font-heading-weight)] text-[var(--th-color-text)]">
            Shopping Bag
          </h1>
          <p className="text-xs text-[var(--th-color-muted)] mt-1">
            Review your selected items.
          </p>
        </div>
        <button
          type="button"
          onClick={clearCart}
          className="self-start sm:self-auto text-xs text-[var(--th-color-muted)] hover:text-[var(--plum)] transition-colors"
        >
          Clear entire bag
        </button>
      </div>

      <div className="max-w-4xl">
        {/* Items List */}
        <div className="divide-y divide-[var(--th-color-border)] border-b border-[var(--th-color-border)]">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row gap-5 py-6 first:pt-0"
            >
              {/* Image */}
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[var(--th-radius-card)] border border-[var(--th-color-border)] bg-[var(--th-color-surface)]">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.productName}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-[var(--th-color-muted)]">
                    No image
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <Link
                      href={`/store/${store.slug}/products/${item.productId}`}
                      className="[font-family:var(--th-font-heading)] text-base [font-weight:var(--th-font-heading-weight)] text-[var(--th-color-text)] hover:text-[var(--th-color-primary)] transition-colors"
                    >
                      {item.productName}
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-[var(--th-color-muted)] hover:text-[var(--plum)] transition-colors p-1"
                      aria-label={`Remove ${item.productName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {item.sku && (
                    <p className="text-[11px] text-[var(--th-color-muted)] mt-0.5">
                      SKU: {item.sku}
                    </p>
                  )}

                  {/* Selected Options */}
                  {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(item.selectedOptions).map(([key, val]) => (
                        <span
                          key={key}
                          className="rounded-[var(--th-radius-input)] bg-[var(--th-color-border)]/40 px-2 py-0.5 text-xs text-[var(--th-color-muted)]"
                        >
                          {key}: <strong className="text-[var(--th-color-text)]">{val}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Row: Quantity Stepper + Item Total */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center rounded-[var(--th-radius-input)] border border-[var(--th-color-border)] bg-[var(--th-color-surface)]">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="flex h-9 w-9 items-center justify-center text-[var(--th-color-muted)] hover:text-[var(--th-color-text)] transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-10 text-center text-xs font-semibold text-[var(--th-color-text)]">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="flex h-9 w-9 items-center justify-center text-[var(--th-color-muted)] hover:text-[var(--th-color-text)] transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="text-right">
                    <p className="[font-family:var(--th-font-heading)] text-base font-bold text-[var(--th-color-text)]">
                      {currency} {(item.price * item.quantity).toFixed(2)}
                    </p>
                    <p className="text-[11px] text-[var(--th-color-muted)]">
                      {currency} {item.price.toFixed(2)} each
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Link href={`/store/${store.slug}`} className="mt-6 inline-flex min-h-11 items-center rounded-[var(--th-radius-button)] border border-[var(--th-color-border)] px-5 text-sm text-[var(--th-color-text)] hover:bg-[var(--th-color-border)]/40 focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]">Continue Shopping</Link>
      </div>
    </main>
  )
}
