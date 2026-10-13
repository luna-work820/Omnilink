import { createClientServer } from '@/lib/supabase/server'

type StoreCurrency = 'CNY' | 'USD'

/** Create an organization and its first store through the transactional RPC. */
export async function initializeMerchantStore(params: {
  owner_id: string
  store_name: string
  industry_id?: string | null
  industry_category?: string | null
  logo_url?: string | null
  description?: string | null
  currency?: string | null
}): Promise<string> {
  const supabase = await createClientServer()
  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData.user || userData.user.id !== params.owner_id) {
    throw new Error('Cannot create a store for a different user')
  }

  const name = params.store_name.trim()
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!name || !slug) throw new Error('A valid store name is required')

  const { data, error } = await supabase.rpc('create_organization_and_store', {
    p_organization_name: name,
    p_organization_slug: slug,
    p_store_name: name,
    p_store_slug: slug,
    p_currency: params.currency === 'USD' ? 'USD' : 'CNY',
  })
  if (error) throw new Error(`Failed to create store: ${error.message}`)
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.store_id) throw new Error('Failed to create store: no store returned')
  return result.store_id
}

/** Resolve the user's first editable store through active organization membership. */
export async function getStoreByOwnerId(userId: string) {
  const supabase = await createClientServer()
  const { data: memberships, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('role', ['owner', 'admin', 'editor'])
  if (membershipError || !memberships?.length) return null

  const { data, error } = await supabase
    .from('stores')
    .select('id, organization_id, name, slug, currency')
    .in('organization_id', memberships.map((membership) => membership.organization_id))
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return {
    ...data,
    // Compatibility DTOs for existing dashboard/editor components.
    store_name: data.name,
    store_slug: data.slug,
    base_currency: data.currency,
    industries: null,
  }
}

export async function updateStoreBaseCurrency(userId: string, currency: StoreCurrency) {
  const supabase = await createClientServer()
  const store = await getStoreByOwnerId(userId)
  if (!store) throw new Error('No editable store found for this user')

  const { data, error } = await supabase
    .from('stores')
    .update({ currency })
    .eq('id', store.id)
    .select('id, organization_id, name, slug, currency')
    .single()
  if (error) throw new Error(`Failed to update store currency: ${error.message}`)
  return data
}
