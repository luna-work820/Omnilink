import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api/auth'

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { supabase, user } = auth
  const { data: memberships, error: membershipError } = await supabase
    .from('organization_members').select('organization_id, role').eq('user_id', user.id).eq('status', 'active')
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 })
  const organizationIds = (memberships ?? []).map((m) => m.organization_id)
  if (!organizationIds.length) return NextResponse.json({ stores: [] })
  const { data: stores, error } = await supabase.from('stores').select('*').in('organization_id', organizationIds).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stores: stores ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { supabase } = auth
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const organizationName = typeof body.organization_name === 'string' ? body.organization_name.trim() : typeof body.store_name === 'string' ? body.store_name.trim() : ''
  const storeName = typeof body.store_name === 'string' ? body.store_name.trim() : organizationName
  const organizationSlug = typeof body.organization_slug === 'string' ? body.organization_slug.trim() : organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const storeSlug = typeof body.store_slug === 'string' ? body.store_slug.trim() : storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  if (!organizationName || !storeName || !organizationSlug || !storeSlug) return NextResponse.json({ error: 'store_name is required' }, { status: 400 })
  const { data, error } = await supabase.rpc('create_organization_and_store', {
    p_organization_name: organizationName, p_organization_slug: organizationSlug,
    p_store_name: storeName, p_store_slug: storeSlug,
    p_currency: typeof body.currency === 'string' ? body.currency : 'CNY',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const result = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ organization_id: result?.organization_id, store_id: result?.store_id }, { status: 201 })
}
