import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClientServer } from '@/lib/supabase/server'
import { getStoreByOwnerId } from '@/lib/stores/service'
import { getEditorStorefrontProducts } from '@/lib/storefront/editor-products'
import { loadStorefrontSchemaAction } from '@/app/actions/store'
import { StorefrontHub } from '@/components/storefront/StorefrontHub'

export default async function DashboardStorefrontPage() {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    if (process.env.NODE_ENV === 'production') redirect('/login')

    return (
      <Suspense fallback={null}>
        <StorefrontHub
          store={{ id: 'demo-store', store_name: 'Omnilink 旗舰店', store_slug: 'omnilink-flagship' }}
          storefrontSchema={await loadStorefrontSchemaAction('demo-store')}
        />
      </Suspense>
    )
  }

  const store = await getStoreByOwnerId(user.id)
  if (!store) redirect('/onboarding')

  const [storefrontSchema, storefrontProducts] = await Promise.all([
    loadStorefrontSchemaAction(store.id),
    getEditorStorefrontProducts({ id: store.id, slug: store.store_slug, currency: store.currency }),
  ])

  return (
    <Suspense fallback={null}>
      <StorefrontHub
        store={store}
        storefrontSchema={storefrontSchema}
        storefrontProducts={storefrontProducts}
      />
    </Suspense>
  )
}
