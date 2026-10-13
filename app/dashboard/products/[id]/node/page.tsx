import { DEMO_PRODUCTS, getDemoProductById, type DemoProduct } from '@/lib/products/demo-data'
import { ProductNodeVisualizer } from '@/components/product/node/ProductNodeVisualizer'
import { createClientServer } from '@/lib/supabase/server'

export default async function NodePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Check demo products first
  let product: DemoProduct | undefined = DEMO_PRODUCTS.find(
    (p) => p.id === id || p.sku.toLowerCase() === id.toLowerCase()
  )

  if (!product) {
    try {
      const supabase = await createClientServer()
      const { data: dbProduct } = await supabase
        .from('catalog_items')
        .select('id, title, description, status, details, created_at, updated_at, catalog_variants(id, sku_code, price, currency_code, availability_type, availability_value), catalog_media(storage_path)')
        .eq('id', id)
        .maybeSingle()

      if (dbProduct) {
        const details = dbProduct.details && typeof dbProduct.details === 'object'
          ? dbProduct.details as Record<string, any>
          : {}
        const variant = Array.isArray(dbProduct.catalog_variants)
          ? dbProduct.catalog_variants[0]
          : null
        product = {
          id: dbProduct.id,
          name: dbProduct.title,
          name_en: dbProduct.title,
          sku: variant?.sku_code || 'SKU-UNKNOWN',
          category: details.category || '通用商品',
          category_en: 'General',
          price: Number(variant?.price) || 0,
          currency: variant?.currency_code || 'CNY',
          inventory: variant?.availability_type === 'stock' ? Number(variant.availability_value) || 0 : 0,
          status: (dbProduct.status as any) || 'active',
          sales_count: 120,
          image_url: dbProduct.catalog_media?.[0]?.storage_path || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
          description: dbProduct.description || '暂无详细描述',
          description_en: dbProduct.description || 'No description available',
          created_at: dbProduct.created_at || new Date().toISOString(),
          updated_at: dbProduct.updated_at || new Date().toISOString(),
          channels: {
            shopify: true,
            amazon: true,
            tiktok: false,
            google: false,
          },
          options: [],
          variants: [],
          semantic_data: (details.attributes as any) || {
            brand: 'OmniBrand',
            category: details.category || 'General Products',
            confidence: 0.96,
            key_features: ['全网 AI 智能识别', '语义属性自动抽取', '全渠道即时同步'],
            key_features_en: ['AI agent discoverable', 'Structured attributes', 'Omni-channel ready'],
            target_audience: '大众消费群体',
            target_audience_en: 'General Consumers',
            attributes: {
              status: 'Ready',
              sku: variant?.sku_code || 'SKU',
            },
            ai_search_terms: ['商品', '推荐商品'],
            agent_reasoning: '该商品已完成基础结构化提取，支持大模型检索。',
            agent_reasoning_en: 'Base structured extraction completed, ready for LLM queries.',
          },
          evidence: [
            {
              semantic_field: 'catalog_registration',
              evidence_type: 'merchant_input',
              evidence_source: 'Merchant Catalog Admin',
              confidence: 0.99,
              field_value: 'Direct Store Submission',
            },
          ],
          agent_qa: [],
        }
      }
    } catch {
      // ignore
    }
  }

  if (!product) {
    product = getDemoProductById(id) || DEMO_PRODUCTS[0]
  }

  return <ProductNodeVisualizer product={product} />
}
