import { createClientServer } from '@/lib/supabase/server'
import type {
  ProductAttribute,
  CreateProductAttributeInput,
  UpdateProductAttributeInput,
  ProductComposition,
  CreateProductCompositionInput,
  ProductContent,
  CreateProductContentInput,
} from './product-attribute-domains'

type JsonRecord = Record<string, unknown>
type SupabaseClient = Awaited<ReturnType<typeof createClientServer>>

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

async function getAuthenticatedContext(productId?: string) {
  const supabase = await createClientServer()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Unauthorized')

  let organizationId: string | null = null
  if (productId) {
    const { data: item, error } = await supabase
      .from('catalog_items')
      .select('organization_id')
      .eq('id', productId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    organizationId = item?.organization_id ?? null
  }

  return { supabase, organizationId, user }
}

const ATTRIBUTE_RELATION = 'catalog_attribute_definitions!catalog_item_attributes_definition_organization_fkey'

function mapPimAttribute(value: unknown): ProductAttribute {
  const row = asRecord(value)
  const definition = asRecord(row.catalog_attribute_definitions)
  const rawValue = row.value
  const source = row.value_origin === 'ai' ? 'ai' : row.value_origin === 'system' ? 'system' : 'manual'
  return {
    id: String(row.id),
    product_id: String(row.catalog_item_id),
    variant_id: typeof row.variant_id === 'string' ? row.variant_id : null,
    field_key: String(definition.code ?? ''),
    label: typeof definition.label === 'string' ? definition.label : null,
    value: typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue ?? ''),
    value_type: definition.value_type === 'number' ? 'number' : definition.value_type === 'boolean' ? 'boolean' : definition.value_type === 'enum' ? 'select' : 'text',
    unit: typeof definition.unit === 'string' ? definition.unit : null,
    source,
    confidence: typeof row.confidence === 'number' ? row.confidence : 1,
    is_standard: true,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

async function queryPimAttributes(supabase: SupabaseClient, productId: string, variantId?: string | null) {
  let query = supabase
    .from('catalog_item_attributes')
    .select(`id, catalog_item_id, variant_id, value, value_origin, confidence, created_at, updated_at, ${ATTRIBUTE_RELATION}(code,label,value_type,unit)`)
    .eq('catalog_item_id', productId)
  query = variantId ? query.eq('variant_id', variantId) : query.is('variant_id', null)
  const { data, error } = await query.order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapPimAttribute)
}

async function writePimAttributes(
  supabase: SupabaseClient,
  productId: string,
  attributes: Array<Partial<ProductAttribute> & { field_key: string; value: string }>,
  deletions: string[] = [],
) {
  const { error } = await supabase.rpc('save_catalog_item_attributes', {
    p_item_id: productId,
    p_attributes: attributes.map((attribute) => ({
      key: attribute.field_key,
      label: attribute.label ?? attribute.field_key,
      value: attribute.value,
      variant_id: attribute.variant_id ?? null,
      type: attribute.value_type === 'select' ? 'select' : attribute.value_type ?? 'text',
      unit: attribute.unit ?? null,
      source: attribute.source ?? 'manual',
      confidence: attribute.confidence ?? 1,
    })),
    p_deletions: deletions,
    p_category_id: null,
  })
  if (error) throw new Error(error.message)
}

async function verifyVariantOwnership(
  supabase: SupabaseClient,
  productId: string,
  variantId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from('catalog_variants')
    .select('id, catalog_item_id, organization_id')
    .eq('id', variantId)
    .eq('catalog_item_id', productId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Variant not found')
  return data
}

export async function getProductAttributes(productId: string, variantId?: string | null): Promise<ProductAttribute[]> {
  const { supabase, organizationId } = await getAuthenticatedContext(productId)
  if (!organizationId) throw new Error('Product not found')
  if (variantId) await verifyVariantOwnership(supabase, productId, variantId, organizationId)
  return queryPimAttributes(supabase, productId, variantId)
}

export async function createProductAttribute(input: CreateProductAttributeInput): Promise<ProductAttribute> {
  const { supabase, organizationId } = await getAuthenticatedContext(input.product_id)
  if (!organizationId) throw new Error('Product not found')
  if (input.variant_id) await verifyVariantOwnership(supabase, input.product_id, input.variant_id, organizationId)
  await writePimAttributes(supabase, input.product_id, [{
    field_key: input.field_key,
    label: input.label,
    value: input.value,
    value_type: input.value_type,
    unit: input.unit,
    source: input.source,
    confidence: input.confidence,
  }])
  const rows = await queryPimAttributes(supabase, input.product_id, input.variant_id)
  const created = rows.find((item) => item.field_key === input.field_key)
  if (!created) throw new Error('Failed to return saved attribute')
  return created
}

export async function updateProductAttribute(attributeId: string, input: UpdateProductAttributeInput): Promise<ProductAttribute> {
  const { supabase, organizationId } = await getAuthenticatedContext()
  const { data, error } = await supabase
    .from('catalog_item_attributes')
    .select(`id, catalog_item_id, variant_id, value, value_origin, confidence, created_at, updated_at, ${ATTRIBUTE_RELATION}(code,label,value_type,unit)`)
    .eq('id', attributeId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Attribute not found')
  const previous = mapPimAttribute(data)
  const updated = {
    ...previous,
    ...input,
    field_key: previous.field_key,
    label: input.label !== undefined ? input.label : previous.label,
    value: input.value !== undefined ? input.value : previous.value,
    value_type: input.value_type !== undefined ? input.value_type : previous.value_type,
    unit: input.unit !== undefined ? input.unit : previous.unit,
    source: input.source !== undefined ? input.source : previous.source,
    confidence: input.confidence !== undefined ? input.confidence : previous.confidence,
  }
  await writePimAttributes(supabase, previous.product_id, [updated])
  const rows = await queryPimAttributes(supabase, previous.product_id, previous.variant_id)
  const saved = rows.find((item) => item.field_key === previous.field_key)
  if (!saved) throw new Error('Failed to return updated attribute')
  return saved
}

export async function deleteProductAttribute(attributeId: string): Promise<boolean> {
  const { supabase } = await getAuthenticatedContext()
  const { data, error } = await supabase
    .from('catalog_item_attributes')
    .select(`id, catalog_item_id, variant_id, value, value_origin, confidence, created_at, updated_at, ${ATTRIBUTE_RELATION}(code,label,value_type,unit)`)
    .eq('id', attributeId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Attribute not found')
  const { error: deleteError } = await supabase
    .from('catalog_item_attributes')
    .delete()
    .eq('id', attributeId)
  if (deleteError) throw new Error(deleteError.message)
  return true
}

export async function batchCreateProductAttributes(productId: string, attributes: Omit<CreateProductAttributeInput, 'product_id'>[]): Promise<ProductAttribute[]> {
  const { supabase, organizationId } = await getAuthenticatedContext(productId)
  if (!organizationId) throw new Error('Product not found')
  const normalized = attributes.map((attribute) => ({
    field_key: attribute.field_key,
    label: attribute.label,
    value: attribute.value,
    value_type: attribute.value_type,
    unit: attribute.unit,
    source: attribute.source,
    confidence: attribute.confidence,
    variant_id: attribute.variant_id ?? null,
  }))
  for (const item of normalized) {
    if (item.variant_id) await verifyVariantOwnership(supabase, productId, item.variant_id, organizationId)
  }
  await writePimAttributes(supabase, productId, normalized)
  const output: ProductAttribute[] = []
  for (const variantId of [...new Set(normalized.map((item) => item.variant_id))]) {
    output.push(...await queryPimAttributes(supabase, productId, variantId))
  }
  const keys = new Set(normalized.map((item) => `${item.variant_id ?? ''}:${item.field_key}`))
  return output.filter((item) => keys.has(`${item.variant_id ?? ''}:${item.field_key}`))
}

function mapComposition(value: unknown, productId: string, variantId: string | null): ProductComposition {
  const raw = asRecord(value)
  return {
    id: String(raw.id), product_id: productId, variant_id: variantId,
    component_name: String(raw.component_name || ''), component_type: raw.component_type as ProductComposition['component_type'],
    material_code: typeof raw.material_code === 'string' ? raw.material_code : null,
    percentage: typeof raw.percentage === 'number' ? raw.percentage : null,
    quantity: typeof raw.quantity === 'number' ? raw.quantity : null,
    quantity_unit: typeof raw.quantity_unit === 'string' ? raw.quantity_unit : null,
    supplier_name: typeof raw.supplier_name === 'string' ? raw.supplier_name : null,
    origin_country: typeof raw.origin_country === 'string' ? raw.origin_country : null,
    is_primary: raw.is_primary === true, notes: typeof raw.notes === 'string' ? raw.notes : null,
    created_at: String(raw.created_at || new Date(0).toISOString()), updated_at: String(raw.updated_at || new Date(0).toISOString()),
  }
}

function mapContent(value: unknown, productId: string): ProductContent {
  const raw = asRecord(value)
  const metadata = asRecord(raw.content_metadata)
  return {
    id: String(raw.id), product_id: productId, content_type: raw.content_type as ProductContent['content_type'],
    language: String(raw.locale || 'zh'), title: typeof raw.title === 'string' ? raw.title : null,
    body: typeof raw.body === 'string' ? raw.body : null, position: Number(raw.position || 0),
    meta_title: typeof metadata.meta_title === 'string' ? metadata.meta_title : null,
    meta_description: typeof metadata.meta_description === 'string' ? metadata.meta_description : null,
    keywords: Array.isArray(raw.keywords) ? raw.keywords.filter((item): item is string => typeof item === 'string') : null,
    is_visible: metadata.is_visible !== false, created_at: String(raw.created_at || new Date(0).toISOString()), updated_at: String(raw.updated_at || new Date(0).toISOString()),
  }
}

export async function getProductCompositions(productId: string, variantId?: string | null): Promise<ProductComposition[]> {
  const { supabase, organizationId } = await getAuthenticatedContext(productId)
  if (!organizationId) throw new Error('Product not found')
  let query = supabase.from('catalog_item_compositions').select('*').eq('catalog_item_id', productId)
  query = variantId ? query.eq('variant_id', variantId) : query.is('variant_id', null)
  const { data, error } = await query.order('is_primary', { ascending: false }).order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapComposition(row, productId, variantId ?? null))
}

export async function createProductComposition(input: CreateProductCompositionInput): Promise<ProductComposition> {
  const { supabase, organizationId, user } = await getAuthenticatedContext(input.product_id)
  if (!organizationId) throw new Error('Product not found')
  if (input.variant_id) await verifyVariantOwnership(supabase, input.product_id, input.variant_id, organizationId)
  const { data, error } = await supabase.from('catalog_item_compositions').insert({
    organization_id: organizationId,
    catalog_item_id: input.product_id,
    variant_id: input.variant_id ?? null,
    component_name: input.component_name,
    component_type: input.component_type,
    material_code: input.material_code ?? null,
    percentage: input.percentage ?? null,
    quantity: input.quantity ?? null,
    quantity_unit: input.quantity_unit ?? null,
    supplier_name: input.supplier_name ?? null,
    origin_country: input.origin_country ?? null,
    is_primary: input.is_primary ?? false,
    notes: input.notes ?? null,
    created_by: user.id,
  }).select('*').single()
  if (error) throw new Error(error.message)
  return mapComposition(data, input.product_id, input.variant_id ?? null)
}

export async function getProductContents(productId: string, contentType?: string): Promise<ProductContent[]> {
  const { supabase, organizationId } = await getAuthenticatedContext(productId)
  if (!organizationId) throw new Error('Product not found')
  let query = supabase.from('catalog_contents').select('*').eq('catalog_item_id', productId).is('variant_id', null)
  if (contentType) query = query.eq('content_type', contentType as ProductContent['content_type'])
  const { data, error } = await query.order('position').order('locale')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapContent(row, productId))
}

export async function createProductContent(input: CreateProductContentInput): Promise<ProductContent> {
  const { supabase, organizationId, user } = await getAuthenticatedContext(input.product_id)
  if (!organizationId) throw new Error('Product not found')
  const { data, error } = await supabase.from('catalog_contents').insert({
    organization_id: organizationId,
    catalog_item_id: input.product_id,
    locale: input.language || 'zh-CN',
    content_type: input.content_type,
    title: input.title ?? null,
    body: input.body ?? null,
    keywords: input.keywords ?? [],
    position: input.position ?? 0,
    status: 'draft',
    content_metadata: {
      meta_title: input.meta_title ?? null,
      meta_description: input.meta_description ?? null,
      is_visible: input.is_visible ?? true,
    },
    created_by: user.id,
  }).select('*').single()
  if (error) throw new Error(error.message)
  return mapContent(data, input.product_id)
}
