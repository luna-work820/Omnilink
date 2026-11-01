'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { StorefrontSchema } from '@/lib/storefront/schema'
import type { StorefrontProduct } from '@/lib/storefront/types'

const StorefrontEditor = dynamic(() => import('@/components/storefront/StorefrontEditor'), { ssr: false })

interface StorefrontHubProps {
  store: {
    id: string
    store_name: string
    store_slug: string
    base_currency?: string
    currency?: string
  }
  storefrontSchema?: StorefrontSchema | null
  storefrontProducts?: StorefrontProduct[]
}

export function StorefrontHub({ store, storefrontSchema, storefrontProducts = [] }: StorefrontHubProps) {
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('editor')) return
    url.searchParams.delete('editor')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  return <StorefrontEditor
    store={store}
    initialSchema={storefrontSchema}
    products={storefrontProducts}
  />
}
