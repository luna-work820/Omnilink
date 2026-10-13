import { randomUUID } from 'node:crypto'
import { createClientServer } from '@/lib/supabase/server'
import type {
  ProductOption,
  ProductVariant,
  CreateProductOptionInput,
  UpdateProductOptionInput,
  CreateProductVariantInput,
  UpdateProductVariantInput,
} from './types'
import {
  normalizeOptionCode,
  canonicalizeOptionValues,
  isValidOptionCode,
  isValidSKU,
  isValidVariantStatus,
  validateVariantForPublish,
  validateInventory,
  validateOptionValues,
} from './validation'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function asStringRecord(value: unknown): Record<string, string> {
  const record = asRecord(value)
  return Object.fromEntries(
    Object.entries(record).filter(([, item]) => typeof item === 'string'),
  ) as Record<string, string>
}

function mapVariant(row: JsonRecord): ProductVariant {
  const details = asRecord(row.details)
  return {
    id: String(row.id),
    product_id: String(row.catalog_item_id),
    sku: typeof row.sku_code === 'string' ? row.sku_code : null,
    price: row.price == null ? null : Number(row.price),
    currency: String(row.currency_code || 'CNY'),
    inventory: row.availability_type === 'stock' && row.availability_value != null
      ? Number(row.availability_value)
      : null,
    status: typeof details.status === 'string' && isValidVariantStatus(details.status)
      ? details.status
      : 'draft',
    option_values: asStringRecord(details.option_values),
    raw_data: asRecord(details.raw_data),
    semantic_data: asRecord(details.semantic_data),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function mapOptions(detailsValue: unknown): ProductOption[] {
  if (!Array.isArray(detailsValue)) return []
  return detailsValue
    .filter((item): item is JsonRecord => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      id: String(item.id),
      product_id: String(item.product_id),
      name: String(item.name),
      code: String(item.code),
      position: Number(item.position ?? 0),
      values: Array.isArray(item.values)
        ? item.values.filter((value): value is string => typeof value === 'string')
        : [],
      created_at: String(item.created_at),
    }))
    .sort((a, b) => a.position - b.position)
}

async function getAuthenticatedContext() {
  const supabase = await createClientServer()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Unauthorized')

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, organization_id')
    .in('organization_id', (await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('role', ['owner', 'admin', 'editor'])).data?.map((row) => row.organization_id) ?? [])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (storeError) throw new Error(storeError.message)
  if (!store) throw new Error('Store not found')
  if (!store.organization_id) throw new Error('Store organization not found')

  return { supabase, organizationId: store.organization_id }
}

async function verifyProductOwnership(
  supabase: Awaited<ReturnType<typeof createClientServer>>,
  productId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from('catalog_items')
    .select('id, organization_id')
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Product not found')
  return data
}

async function verifyVariantOwnership(
  supabase: Awaited<ReturnType<typeof createClientServer>>,
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

async function readProductDetails(
  supabase: Awaited<ReturnType<typeof createClientServer>>,
  productId: string,
  organizationId: string,
) {
  await verifyProductOwnership(supabase, productId, organizationId)
  const { data, error } = await supabase
    .from('catalog_items')
    .select('details')
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .single()
  if (error) throw new Error(error.message)
  return asRecord(data?.details)
}

async function updateProductDetails(
  supabase: Awaited<ReturnType<typeof createClientServer>>,
  productId: string,
  organizationId: string,
  details: JsonRecord,
) {
  const { data, error } = await supabase
    .from('catalog_items')
    .update({ details })
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .select('details')
    .single()
  if (error) throw new Error(error.message)
  return asRecord(data?.details)
}

async function checkSKUUniqueness(
  supabase: Awaited<ReturnType<typeof createClientServer>>,
  organizationId: string,
  sku: string,
  excludeVariantId?: string,
) {
  let query = supabase
    .from('catalog_variants')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('sku_code', sku)
  if (excludeVariantId) query = query.neq('id', excludeVariantId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data?.length ?? 0) === 0
}

async function checkOptionValuesUniqueness(
  supabase: Awaited<ReturnType<typeof createClientServer>>,
  productId: string,
  organizationId: string,
  optionValues: Record<string, string>,
  excludeVariantId?: string,
) {
  const { data, error } = await supabase
    .from('catalog_variants')
    .select('id, details')
    .eq('catalog_item_id', productId)
    .eq('organization_id', organizationId)
  if (error) throw new Error(error.message)
  const canonical = canonicalizeOptionValues(optionValues)
  return !(data || []).some((variant) => {
    if (excludeVariantId && variant.id === excludeVariantId) return false
    return canonicalizeOptionValues(asStringRecord(asRecord(variant.details).option_values)) === canonical
  })
}

export async function getProductOptions(productId: string): Promise<ProductOption[]> {
  const { supabase, organizationId } = await getAuthenticatedContext()
  const details = await readProductDetails(supabase, productId, organizationId)
  return mapOptions(details.options).map((option) => ({ ...option, product_id: productId }))
}

export async function createProductOption(
  productId: string,
  input: CreateProductOptionInput,
): Promise<ProductOption> {
  const { supabase, organizationId } = await getAuthenticatedContext()
  const details = await readProductDetails(supabase, productId, organizationId)
  const normalizedCode = normalizeOptionCode(input.code)
  if (!isValidOptionCode(normalizedCode)) throw new Error('Invalid option code format')
  const valuesValidation = validateOptionValues(input.values)
  if (!valuesValidation.valid) throw new Error(valuesValidation.error)

  const options = mapOptions(details.options).map((option) => ({ ...option, product_id: productId }))
  if (options.some((option) => option.code === normalizedCode)) {
    throw new Error('Option with this code already exists for this product')
  }
  const option: ProductOption = {
    id: randomUUID(),
    product_id: productId,
    name: input.name,
    code: normalizedCode,
    position: input.position ?? 0,
    values: input.values,
    created_at: new Date().toISOString(),
  }
  await updateProductDetails(supabase, productId, organizationId, {
    ...details,
    options: [...options, option],
  })
  return option
}

export async function updateProductOption(
  productId: string,
  optionId: string,
  input: UpdateProductOptionInput,
): Promise<ProductOption> {
  const { supabase, organizationId } = await getAuthenticatedContext()
  const details = await readProductDetails(supabase, productId, organizationId)
  const options = mapOptions(details.options).map((option) => ({ ...option, product_id: productId }))
  const index = options.findIndex((option) => option.id === optionId)
  if (index < 0) throw new Error('Option not found or does not belong to this product')

  const current = options[index]
  const code = input.code === undefined ? current.code : normalizeOptionCode(input.code)
  if (!isValidOptionCode(code)) throw new Error('Invalid option code format')
  if (options.some((option) => option.id !== optionId && option.code === code)) {
    throw new Error('Option with this code already exists for this product')
  }
  const values = input.values === undefined ? current.values : input.values
  const valuesValidation = validateOptionValues(values)
  if (!valuesValidation.valid) throw new Error(valuesValidation.error)

  const updated = {
    ...current,
    name: input.name ?? current.name,
    code,
    position: input.position ?? current.position,
    values,
  }
  options[index] = updated
  await updateProductDetails(supabase, productId, organizationId, { ...details, options })
  return updated
}

export async function deleteProductOption(productId: string, optionId: string): Promise<boolean> {
  const { supabase, organizationId } = await getAuthenticatedContext()
  const details = await readProductDetails(supabase, productId, organizationId)
  const options = mapOptions(details.options).map((option) => ({ ...option, product_id: productId }))
  if (!options.some((option) => option.id === optionId)) {
    throw new Error('Option not found or does not belong to this product')
  }
  await updateProductDetails(supabase, productId, organizationId, {
    ...details,
    options: options.filter((option) => option.id !== optionId),
  })
  return true
}

export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  const { supabase, organizationId } = await getAuthenticatedContext()
  await verifyProductOwnership(supabase, productId, organizationId)
  const { data, error } = await supabase
    .from('catalog_variants')
    .select('*')
    .eq('catalog_item_id', productId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || []).map((row) => mapVariant(row as JsonRecord))
}

export async function getProductVariant(productId: string, variantId: string): Promise<ProductVariant> {
  const { supabase, organizationId } = await getAuthenticatedContext()
  await verifyVariantOwnership(supabase, productId, variantId, organizationId)
  const { data, error } = await supabase
    .from('catalog_variants')
    .select('*')
    .eq('id', variantId)
    .eq('catalog_item_id', productId)
    .eq('organization_id', organizationId)
    .single()
  if (error) throw new Error(error.message)
  return mapVariant(data as JsonRecord)
}

export async function createProductVariant(
  productId: string,
  input: CreateProductVariantInput,
): Promise<ProductVariant> {
  const { supabase, organizationId } = await getAuthenticatedContext()
  await verifyProductOwnership(supabase, productId, organizationId)
  if (input.sku && !isValidSKU(input.sku)) throw new Error('Invalid SKU format')
  if (input.sku && !(await checkSKUUniqueness(supabase, organizationId, input.sku))) {
    throw new Error('SKU already exists in this store')
  }
  if (input.inventory !== undefined) {
    const validation = validateInventory(input.inventory)
    if (!validation.valid) throw new Error(validation.error)
  }
  if (input.status && !isValidVariantStatus(input.status)) throw new Error('Invalid variant status')
  if (input.status === 'active') {
    const validation = validateVariantForPublish({ sku: input.sku ?? null, price: input.price ?? null, option_values: input.option_values })
    if (!validation.valid) throw new Error(validation.error)
  }
  if (!(await checkOptionValuesUniqueness(supabase, productId, organizationId, input.option_values))) {
    throw new Error('Variant with these option values already exists')
  }

  const { data, error } = await supabase
    .from('catalog_variants')
    .insert({
      organization_id: organizationId,
      catalog_item_id: productId,
      sku_code: input.sku || null,
      title: input.sku || 'Variant',
      price: input.price ?? 0,
      currency_code: input.currency || 'CNY',
      availability_type: 'stock',
      availability_value: input.inventory ?? null,
      details: {
        option_values: input.option_values,
        raw_data: input.raw_data ?? {},
        semantic_data: input.semantic_data ?? {},
        status: input.status || 'draft',
      },
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapVariant(data as JsonRecord)
}

export async function updateProductVariant(
  productId: string,
  variantId: string,
  input: UpdateProductVariantInput,
): Promise<ProductVariant> {
  const { supabase, organizationId } = await getAuthenticatedContext()
  await verifyVariantOwnership(supabase, productId, variantId, organizationId)
  const { data: current, error: currentError } = await supabase
    .from('catalog_variants')
    .select('*')
    .eq('id', variantId)
    .eq('catalog_item_id', productId)
    .eq('organization_id', organizationId)
    .single()
  if (currentError) throw new Error(currentError.message)

  const currentVariant = mapVariant(current as JsonRecord)
  if (input.sku && !isValidSKU(input.sku)) throw new Error('Invalid SKU format')
  if (input.sku && !(await checkSKUUniqueness(supabase, organizationId, input.sku, variantId))) {
    throw new Error('SKU already exists in this store')
  }
  if (input.inventory !== undefined) {
    const validation = validateInventory(input.inventory)
    if (!validation.valid) throw new Error(validation.error)
  }
  if (input.status !== undefined && !isValidVariantStatus(input.status)) throw new Error('Invalid variant status')
  const optionValues = input.option_values ?? currentVariant.option_values
  if (input.option_values && !(await checkOptionValuesUniqueness(supabase, productId, organizationId, optionValues, variantId))) {
    throw new Error('Variant with these option values already exists')
  }
  const status = input.status ?? currentVariant.status
  if (status === 'active') {
    const validation = validateVariantForPublish({ sku: input.sku ?? currentVariant.sku, price: input.price ?? currentVariant.price, option_values: optionValues })
    if (!validation.valid) throw new Error(validation.error)
  }

  const { data, error } = await supabase
    .from('catalog_variants')
    .update({
      sku_code: input.sku !== undefined ? input.sku : current.sku_code,
      price: input.price !== undefined ? input.price : current.price,
      currency_code: input.currency !== undefined ? input.currency : current.currency_code,
      availability_value: input.inventory !== undefined ? input.inventory : current.availability_value,
      details: {
        ...asRecord(current.details),
        option_values: optionValues,
        status,
        ...(input.raw_data !== undefined ? { raw_data: input.raw_data } : {}),
        ...(input.semantic_data !== undefined ? { semantic_data: input.semantic_data } : {}),
      },
    })
    .eq('id', variantId)
    .eq('catalog_item_id', productId)
    .eq('organization_id', organizationId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapVariant(data as JsonRecord)
}

export async function deleteProductVariant(productId: string, variantId: string): Promise<boolean> {
  const { supabase, organizationId } = await getAuthenticatedContext()
  await verifyVariantOwnership(supabase, productId, variantId, organizationId)
  const { error } = await supabase
    .from('catalog_variants')
    .delete()
    .eq('id', variantId)
    .eq('catalog_item_id', productId)
    .eq('organization_id', organizationId)
  if (error) throw new Error(error.message)
  return true
}
