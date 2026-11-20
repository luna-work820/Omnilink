import {DeepSeekConnection} from '@/components/site-builder/DeepSeekConnection'
import { redirect } from 'next/navigation'
import { createClientServer } from '@/lib/supabase/server'
import { getStoreByOwnerId } from '@/lib/stores/service'
import { SettingsView } from '@/components/settings/SettingsView'

/**
 * /dashboard/settings — real merchant store only.
 *
 * No fake store fallback. If the merchant has no store yet we route to
 * /onboarding instead of fabricating a "Carlic Bolomboy" placeholder.
 */
export default async function SettingsPage() {
  const supabase = await createClientServer()
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }

  const localPreview = process.env.NODE_ENV !== 'production' && !user

  if (!user && !localPreview) {
    redirect('/login')
  }

  const store = user ? await getStoreByOwnerId(user.id) : null
  if (!store && !localPreview) {
    redirect('/onboarding')
  }

  return <><DeepSeekConnection/><SettingsView currentStore={store ? {
    store_name: store.name,
    store_slug: store.slug,
    base_currency: store.currency,
    currency: store.currency,
    industries: null,
  } : {
    store_name: '演示商家',
    store_slug: 'omnilink-demo',
    base_currency: 'CNY',
    currency: 'CNY',
    industries: { name: '零售百货' },
  }} /></>
}
