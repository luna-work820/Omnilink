import { ProductWorkspace } from '@/components/products/ProductWorkspace'
import { createClientServer } from '@/lib/supabase/server'
import { ownsProduct } from '@/lib/api/auth'
import { DEMO_PRODUCTS } from '@/lib/products/demo-data'
import { notFound } from 'next/navigation'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const demoProduct = DEMO_PRODUCTS.find(
    (p) => p.id === id || p.sku.toLowerCase() === id.toLowerCase()
  )

  let dbProduct = null
  if (!demoProduct) {
    const supabase = await createClientServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await ownsProduct(supabase, user, id)).owned) notFound()
    try {
      const { data } = await supabase
        .from('catalog_items')
        .select('id, title, description, status, details, catalog_variants(id, sku_code, price, currency_code, availability_type, availability_value), catalog_media(id, storage_path, media_type, alt_text)')
        .eq('id', id)
        .maybeSingle()
      dbProduct = data
    } catch (err) {
      console.error('Failed to fetch product from db:', err)
    }
  }

  let initialData = undefined

  if (dbProduct) {
    const rawData =
      dbProduct.details && typeof dbProduct.details === 'object'
        ? (dbProduct.details as Record<string, unknown>)
        : {}
    const variant = Array.isArray(dbProduct.catalog_variants)
      ? dbProduct.catalog_variants[0]
      : null
    const category =
      (typeof rawData.category === 'string' && rawData.category.trim() ? rawData.category : null) ||
      (typeof rawData.category_id === 'string' && rawData.category_id.trim() ? rawData.category_id : null) ||
      ''

    const imageUrl =
      (typeof rawData.image_url === 'string' && rawData.image_url.trim() ? rawData.image_url : null) ||
      (Array.isArray(dbProduct.catalog_media) && dbProduct.catalog_media[0]?.storage_path
        ? dbProduct.catalog_media[0].storage_path
        : null) ||
      null

    const existingAssets = Array.isArray(dbProduct.catalog_media) && dbProduct.catalog_media.length > 0
      ? dbProduct.catalog_media.map((media: any) => ({
          id: media.id,
          url: media.storage_path,
          asset_type: media.media_type === 'video' ? 'video' as const : 'image' as const,
        }))
      : imageUrl
      ? [{ id: 'main-asset', url: imageUrl, asset_type: 'image' as const }]
      : []

    initialData = {
      name: dbProduct.title,
      description: dbProduct.description || '',
      price: Number(variant?.price) || 0,
      currency: variant?.currency_code || 'CNY',
      inventory: variant?.availability_type === 'stock' ? Number(variant.availability_value) || 0 : 0,
      sku: variant?.sku_code || '',
      category: category,
      categoryId: typeof rawData.category_id === 'string' ? rawData.category_id : null,
      detailContent: typeof rawData.detail_content === 'string' ? rawData.detail_content : '',
      status: (dbProduct.status || 'draft') as 'draft' | 'active' | 'archived',
      existingAssets,
    }
  } else {
    // Fallback to demo/sample product
    if (demoProduct) {
      initialData = {
        name: demoProduct.name,
        description: demoProduct.description || '',
        price: Number(demoProduct.price) || 0,
        currency: demoProduct.currency || 'CNY',
        inventory: Number(demoProduct.inventory) || 0,
        sku: demoProduct.sku || '',
        category: demoProduct.category || 'Electronics & Acoustics',
        detailContent: '',
      }
    }
  }

  return (
    <div className="min-h-screen bg-[var(--surface-muted)]/50 py-8 px-4 sm:px-6 lg:px-8">
      <ProductWorkspace productId={id} initialData={initialData} />
    </div>
  )
}
