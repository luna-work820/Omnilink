'use server'

import { revalidatePath } from 'next/cache'
import { createClientServer } from '@/lib/supabase/server'
import type { Json } from '@/lib/database.types'
import type { StorefrontSchema } from '@/lib/storefront/schema'
import { normalizeStorefrontSchema, validateSchema } from '@/lib/storefront/schema'
import { ownsStore } from '@/lib/api/auth'

export async function saveStorefrontSchemaAction(storeId: string, schema: StorefrontSchema) {
  if (storeId === 'demo-store') {
    return { success: false, error: '演示模式仅供预览，请登录商家账户后保存' }
  }

  try {
    const supabase = await createClientServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await ownsStore(supabase, user, storeId))) {
      return { success: false, error: 'Store not found or forbidden' }
    }
    if (!validateSchema(schema)) {
      return { success: false, error: 'Invalid storefront schema' }
    }

    const normalized = normalizeStorefrontSchema(schema)
    if (!normalized) return { success: false, error: 'Invalid storefront schema' }
    const draftSchema: StorefrontSchema = {
      ...normalized,
      meta: { ...normalized.meta, published: false, lastModified: new Date().toISOString() },
    }

    const { error } = await supabase.rpc('save_storefront_version', {
      p_store_id: storeId,
      p_schema: draftSchema as unknown as Json,
      p_publish: false,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save schema' }
  }
}

export async function loadStorefrontSchemaAction(storeId: string): Promise<StorefrontSchema | null> {
  if (storeId === 'demo-store') {
    return normalizeStorefrontSchema({ theme_id: 'minimal' })
  }

  try {
    const supabase = await createClientServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await ownsStore(supabase, user, storeId))) return null

    const { data: storefront, error: storefrontError } = await supabase
      .from('storefronts')
      .select('draft_version_id, published_version_id')
      .eq('store_id', storeId)
      .maybeSingle()
    if (storefrontError) throw new Error(storefrontError.message)

    const versionId = storefront?.draft_version_id ?? storefront?.published_version_id
    if (versionId) {
      const { data: version, error: versionError } = await supabase
        .from('storefront_versions')
        .select('schema_document')
        .eq('id', versionId)
        .eq('store_id', storeId)
        .maybeSingle()
      if (versionError) throw new Error(versionError.message)
      if (version) return normalizeStorefrontSchema(version.schema_document)
    }

    // Older stores have not yet created a version. The first save or publish
    // moves them to storefront_versions without changing their live page.
    const { data: settings, error: settingsError } = await supabase
      .from('store_settings')
      .select('theme_config')
      .eq('store_id', storeId)
      .maybeSingle()
    if (settingsError) throw new Error(settingsError.message)
    return normalizeStorefrontSchema(settings?.theme_config)
  } catch (err) {
    console.error('loadStorefrontSchemaAction error:', err)
    return null
  }
}

export async function publishStorefrontAction(storeId: string, schema: StorefrontSchema) {
  if (storeId === 'demo-store') {
    return { success: false, error: '演示模式仅供预览，请登录商家账户后发布' }
  }

  try {
    const supabase = await createClientServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await ownsStore(supabase, user, storeId))) {
      return { success: false, error: 'Store not found or forbidden' }
    }
    if (!validateSchema(schema)) {
      return { success: false, error: 'Invalid storefront schema' }
    }
    const normalized = normalizeStorefrontSchema(schema)
    if (!normalized) return { success: false, error: 'Invalid storefront schema' }

    const publishedSchema: StorefrontSchema = {
      ...normalized,
      meta: { ...normalized.meta, published: true, lastModified: new Date().toISOString() },
    }
    const { error } = await supabase.rpc('save_storefront_version', {
      p_store_id: storeId,
      p_schema: publishedSchema as unknown as Json,
      p_publish: true,
    })
    if (error) return { success: false, error: error.message }

    const { data: store } = await supabase.from('stores').select('slug').eq('id', storeId).maybeSingle()
    if (store?.slug) revalidatePath(`/store/${store.slug}`)
    revalidatePath('/discover')
    return { success: true, published: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Publish action failed' }
  }
}

export async function unpublishStorefrontAction(storeId: string) {
  if (storeId === 'demo-store') {
    return { success: false, error: '演示模式仅供预览，请登录商家账户后操作' }
  }

  try {
    const supabase = await createClientServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await ownsStore(supabase, user, storeId))) {
      return { success: false, error: 'Store not found or forbidden' }
    }
    const { error } = await supabase.rpc('unpublish_storefront_version', { p_store_id: storeId })
    if (error) return { success: false, error: error.message }

    const { data: store } = await supabase.from('stores').select('slug').eq('id', storeId).maybeSingle()
    if (store?.slug) revalidatePath(`/store/${store.slug}`)
    revalidatePath('/discover')
    return { success: true, published: false }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unpublish action failed' }
  }
}
