/**
 * Server-side API authorization helpers.
 *
 * Contract:
 *   1. Every merchant/private route calls requireUser() → 401 if not signed in.
 *   2. Resource access is verified by explicit ownership checks below (NEVER
 *      trust client-supplied store_id / product_id / page_id).
 *   3. RLS remains a second line of defense (defense-in-depth); these checks
 *      must not be replaced by "rely on RLS only".
 *
 * Ownership resolves through:
 *   organization_members.user_id = auth.uid()
 *   store_settings / store_pages / catalog_items / imports / ai_jobs / store_plugins
 *     / agent_api_keys  →  store_id  →  stores.organization_id → organization_members
 *   catalog_media  →  catalog_item_id  →  catalog_items.organization_id
 */

import { NextResponse } from 'next/server'
import { createClientServer } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

type SbClient = Awaited<ReturnType<typeof createClientServer>>

export type AuthResult =
  | { ok: true; supabase: SbClient; user: User }
  | { ok: false; response: NextResponse }

/** Require an authenticated user; return the SSR client + user, or a 401. */
export async function requireUser(): Promise<AuthResult> {
  // Create the SSR client up-front so a misconfigured env surfaces as a
  // diagnosable error instead of a silent 401.
  let supabase: SbClient
  try {
    supabase = await createClientServer()
  } catch (initErr) {
    console.error('[requireUser] Failed to initialise server Supabase client', {
      error: initErr instanceof Error ? initErr.message : String(initErr),
    })
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_CLIENT_INIT_FAILED' },
        { status: 401 },
      ),
    }
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (!error && user) {
      return { ok: true, supabase, user }
    }
    // Previously this branch was a black hole. Log the real reason so a 401
    // becomes actionable: usually `error` is null because the auth cookie is
    // simply absent / not sent by the browser.
    console.error('[requireUser] No authenticated user', {
      hasUser: Boolean(user),
      authError: error ? error.message : null,
    })
  } catch (getUserErr) {
    console.error('[requireUser] getUser() threw', {
      error: getUserErr instanceof Error ? getUserErr.message : String(getUserErr),
    })
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Unauthorized', code: 'NO_SESSION' },
      { status: 401 },
    ),
  }
}

/** Resolve the caller's owned store id, or null if not found. */
export async function getOwnedStoreId(
  supabase: SbClient,
  user: User
): Promise<string | null> {
  const { data, error } = await supabase
    .from('stores')
    .select('id')
    .in('organization_id', (await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).eq('status', 'active').in('role', ['owner', 'admin', 'editor'])).data?.map((row) => row.organization_id) ?? [])
    .limit(1)
    .maybeSingle()
  
  if (error) {
    console.error('[getOwnedStoreId] Store lookup failed', { userId: user.id, error: error.message })
    return null
  }
  
  return data?.id ?? null
}

/** Resolve the caller's owned store with base_currency, or null if not found. */
export async function getOwnedStore(
  supabase: SbClient,
  user: User
): Promise<{ id: string; owner_id: string; base_currency: string } | null> {
  const memberships = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('role', ['owner', 'admin', 'editor'])
    .limit(1)
  const organizationId = memberships.data?.[0]?.organization_id
  if (!organizationId) return null

  const { data, error } = await supabase
    .from('stores')
    .select('id, currency')
    .eq('organization_id', organizationId)
    .limit(1)
    .maybeSingle()
  
  if (error) {
    console.error('[getOwnedStore] Store lookup failed', { userId: user.id, error: error.message })
    return null
  }
  
  if (!data) {
    return null
  }
  
  if (!data.currency) {
    console.error('[getOwnedStore] Store found but base_currency is missing', { storeId: data.id })
    return null
  }
  
  return {
    id: data.id,
    owner_id: user.id,
    base_currency: data.currency,
  }
}

/** Verify the caller owns the given store. (RLS also enforces this.) */
export async function ownsStore(
  supabase: SbClient,
  user: User,
  storeId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .maybeSingle()
  if (error || !data) return false
  const { data: store } = await supabase.from('stores').select('organization_id').eq('id', storeId).single()
  const { data: membership } = store
    ? await supabase.from('organization_members').select('id').eq('organization_id', store.organization_id).eq('user_id', user.id).eq('status', 'active').in('role', ['owner', 'admin', 'editor']).maybeSingle()
    : { data: null }
  return Boolean(membership)
}

/**
 * Verify the caller owns the store that owns the product.
 * Returns { owned, storeId }. storeId is null if the product is not found or
 * not owned (so callers can 404 without leaking existence).
 */
import { isUuid, toValidUuid } from '@/lib/utils/uuid'

export async function ownsProduct(
  supabase: SbClient,
  user: User,
  productId: string
): Promise<{ owned: boolean; storeId: string | null }> {
  const targetId = isUuid(productId) ? productId : toValidUuid(productId)
  const { data, error } = await supabase
    .from('catalog_items')
    .select('organization_id')
    .eq('id', targetId)
    .maybeSingle()
  
  if (error || !data) {
    return { owned: false, storeId: null }
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', data.organization_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('role', ['owner', 'admin', 'editor'])
    .maybeSingle()
  return { owned: Boolean(membership), storeId: null }
}

/** Verify the caller owns the store that owns the store_page. */
export async function ownsStorePage(
  supabase: SbClient,
  user: User,
  pageId: string
): Promise<{ owned: boolean; storeId: string | null }> {
  const { data, error } = await supabase
    .from('store_pages')
    .select('store_id')
    .eq('id', pageId)
    .maybeSingle()
  if (error || !data) return { owned: false, storeId: null }
  const storeId = data.store_id
  const owned = await ownsStore(supabase, user, storeId)
  return { owned, storeId: owned ? storeId : null }
}
