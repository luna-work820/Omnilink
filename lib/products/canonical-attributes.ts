import { createClientServer } from '@/lib/supabase/server'
import { getCategoryTemplate } from '@/lib/product/category-templates'
import {
  resolveCategorySemanticMappings,
  type CategorySemanticMappingResult,
} from '@/lib/product/category-semantic-mapping'
import {
  resolveCategoryAttributeRules,
} from '@/lib/product/attribute-rules'
import {
  validateProductAttributes,
} from '@/lib/product/attribute-validation'
import {
  ProductAttributeValidationError,
} from '@/lib/product/errors'
import {
  getCategoryConditionalRules,
} from '@/lib/product/category-conditional-rules'
import {
  resolveEffectiveAttributeRules,
} from '@/lib/product/effective-attribute-rules'

export interface CanonicalProductAttribute {
  fieldKey: string
  label?: string
  value: string
  type: 'text' | 'number' | 'boolean' | 'select'
  unit?: string | null
  required?: boolean
  allowedValues?: string[]
  min?: number
  max?: number
  source?: 'ai' | 'manual' | 'system'
  confidence?: number
  isStandard: boolean
  visible?: boolean
  conditional?: boolean
  triggeredRuleIds?: string[]
}

export interface CanonicalProductAttributesResponse {
  product_id: string
  category: string | null
  schema_id: string | null
  schema_version: string | null
  attributes: CanonicalProductAttribute[]
  is_complete: boolean
  is_legacy?: boolean
  missing_required_fields: string[]
}

export interface SaveCanonicalProductAttributesInput {
  categoryId?: string | null
  category?: string | null
  attributes: CanonicalProductAttribute[]
  deletions?: string[]
}

export interface SaveCanonicalProductAttributesResult {
  mapping: {
    semanticData: Record<string, unknown>
    unknownFields: Array<{ raw_field: string; raw_value: unknown; reason: string }>
    accepted: Array<{ sourceKey: string; semanticField: string; value: unknown; confidence: number }>
    rejected: Array<{ sourceKey: string; reason: string }>
  }
  canonical: CanonicalProductAttributesResponse
}

type JsonRecord = Record<string, unknown>

interface InputAttribute {
  key: string
  label?: string
  value: string
  type?: CanonicalProductAttribute['type']
  unit?: string | null
  confidence?: number
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function unwrapSemanticValue(value: unknown): unknown {
  if (isRecord(value) && 'value' in value) {
    return value.value
  }
  return value
}

function normalizeSemanticMap(value: unknown): JsonRecord {
  if (!isRecord(value)) return {}

  // Legacy nested form:
  // { attributes: { field: value } }
  if (isRecord(value.attributes)) {
    return normalizeSemanticMap(value.attributes)
  }

  const output: JsonRecord = {}

  for (const [key, raw] of Object.entries(value)) {
    output[key] = unwrapSemanticValue(raw)
  }

  return output
}

function inferSource(
  generatedBy?: string | null,
): 'ai' | 'manual' | 'system' {
  const source = (generatedBy || '').toLowerCase()

  if (source.includes('ai')) return 'ai'
  if (source.includes('merchant') || source.includes('human') || source.includes('manual')) return 'manual'

  return 'system'
}

function normalizeType(
  value: unknown,
  fallback: CanonicalProductAttribute['type'] = 'text',
): CanonicalProductAttribute['type'] {
  if (
    value === 'text' ||
    value === 'number' ||
    value === 'boolean' ||
    value === 'select'
  ) {
    return value
  }

  return fallback
}

function getRawAttributes(rawData: unknown): CanonicalProductAttribute[] {
  if (!isRecord(rawData)) return []

  const attrs = rawData.attributes ?? rawData.ai_draft

  const source = Array.isArray(attrs)
    ? attrs
    : isRecord(attrs) && Array.isArray(attrs.attributes)
      ? attrs.attributes
      : []

  const results: CanonicalProductAttribute[] = []

  // 1. Array-based attributes (attributes / ai_draft.attributes)
  for (const attr of source) {
    if (!isRecord(attr)) continue
    const fieldKey = String(attr.key ?? attr.fieldKey ?? attr.field_key ?? '').trim()
    const value = String(attr.value ?? '')
    if (fieldKey && value) {
      results.push({
        fieldKey,
        label: attr.label ? String(attr.label) : undefined,
        value,
        type: normalizeType(attr.type),
        unit: attr.unit ? String(attr.unit) : null,
        source:
          attr.source === 'ai' ||
          attr.source === 'manual' ||
          attr.source === 'system'
            ? attr.source
            : 'ai',
        confidence:
          typeof attr.confidence === 'number'
            ? attr.confidence
            : undefined,
        isStandard: false,
      })
    }
  }

  // 2. Fallback: core_attributes in raw_data
  if (isRecord(rawData.core_attributes)) {
    const coreMap: Record<string, string> = {
      material: 'material',
      dimensions: 'dimensions',
      weight: 'weight',
      country_of_origin: 'country_of_origin',
    }
    for (const [prop, canonicalKey] of Object.entries(coreMap)) {
      const val = rawData.core_attributes[prop]
      if (val && !results.some((r) => r.fieldKey.toLowerCase() === canonicalKey.toLowerCase())) {
        results.push({
          fieldKey: canonicalKey,
          label: prop,
          value: String(val),
          type: 'text',
          source: 'manual',
          confidence: 1.0,
          isStandard: false,
        })
      }
    }
  }

  // 3. Fallback: custom_attributes in raw_data
  if (Array.isArray(rawData.custom_attributes)) {
    for (const custom of rawData.custom_attributes) {
      if (!isRecord(custom)) continue
      const name = String(custom.name || custom.id || '').trim()
      const key = name.toLowerCase().replace(/\s+/g, '_')
      const val = String(custom.value ?? '')
      if (key && val && !results.some((r) => r.fieldKey.toLowerCase() === key.toLowerCase())) {
        results.push({
          fieldKey: key,
          label: name,
          value: val,
          type: normalizeType(custom.type),
          source: 'manual',
          confidence: 1.0,
          isStandard: false,
        })
      }
    }
  }

  return results
}

function normalizeMappingKey(
  value: unknown,
): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function buildMappedInputAttributes(
  attributes: CanonicalProductAttribute[],
  mappings: CategorySemanticMappingResult,
): InputAttribute[] {
  const mappingByTemplateKey = new Map(
    mappings.mappings.map((mapping) => [
      mapping.templateKey.toLowerCase(),
      mapping,
    ]),
  )

  return attributes.map((attribute) => {
    const mapping = mappingByTemplateKey.get(
      attribute.fieldKey.trim().toLowerCase(),
    )

    if (!mapping) {
      return {
        key: attribute.fieldKey,
        label: attribute.label,
        value: attribute.value,
        type: attribute.type,
        unit: attribute.unit ?? null,
        confidence: attribute.confidence ?? 1,
      }
    }

    return {
      key: mapping.semanticFieldName,
      label: attribute.label,
      value: attribute.value,
      type: attribute.type,
      unit: attribute.unit ?? null,
      confidence: attribute.confidence ?? 1,
    }
  })
}

function mergeLegacyAttributes(
  existing: CanonicalProductAttribute[],
  legacy: CanonicalProductAttribute[],
): CanonicalProductAttribute[] {
  const map = new Map<string, CanonicalProductAttribute>()

  for (const attr of legacy) {
    map.set(attr.fieldKey.toLowerCase(), attr)
  }

  for (const attr of existing) {
    map.set(attr.fieldKey.toLowerCase(), attr)
  }

  return [...map.values()]
}

import { isUuid, toValidUuid } from '@/lib/utils/uuid'

async function loadProductContext(productId: string) {
  const supabase = await createClientServer()
  const targetId = isUuid(productId) ? productId : toValidUuid(productId)

  const { data: product, error } = await supabase
    .from('catalog_items')
    .select('id, details, title, description, organization_id, category_id')
    .eq('id', targetId)
    .maybeSingle()

  if (error || !product) {
    throw new Error('Product not found')
  }

  const persistedDetails = isRecord(product.details) ? product.details : {}
  const { data: pimRows, error: pimError } = await supabase
    .from('catalog_item_attributes')
    .select('value, value_origin, confidence, catalog_attribute_definitions!catalog_item_attributes_definition_organization_fkey(code)')
    .eq('catalog_item_id', product.id)
    .is('variant_id', null)
  if (pimError) throw new Error(`Failed to load PIM attributes: ${pimError.message}`)

  const persistedAttributes = Object.fromEntries((pimRows ?? []).flatMap((row) => {
    const definition = row.catalog_attribute_definitions as { code?: string } | null
    const code = definition?.code
    if (!code) return []
    return [[code, row.value]]
  }))
  // Prefer normalized PIM values. Legacy JSON is a read-only fallback while
  // older records are being migrated; all new writes go through the RPC.
  const rawData: JsonRecord = {
    ...persistedDetails,
    category_id: product.category_id,
    attributes: Object.keys(persistedAttributes).length
      ? persistedAttributes
      : persistedDetails.attributes,
  }

  const category =
    typeof rawData.category === 'string'
      ? rawData.category
      : null

  const schemaVersion = '1.0'
  const fields: Array<{
    id: string
    field_name: string
    display_name?: string | null
    field_type?: string | null
    required?: boolean
    aliases?: string[]
  }> = []

  return {
    supabase,
    rawData,
    persistedDetails,
    details: rawData,
    category,
    schemaVersion,
    fields,
  }
}

export async function getCanonicalProductAttributes(
  productId: string,
): Promise<CanonicalProductAttributesResponse> {
  const {
    category,
    schemaVersion,
    fields,
    rawData,
    details,
  } = await loadProductContext(productId)

  const template = getCategoryTemplate(
    category || '',
  )

  const templateFields = template?.fields ?? []

  const templateMap = new Map(
    templateFields.map((field) => [
      normalizeMappingKey(field.key),
      field,
    ]),
  )

  const mappingResult = resolveCategorySemanticMappings(
    category || '',
    templateFields,
    fields,
  )

  const rulesResult = resolveCategoryAttributeRules(
    templateFields,
    fields,
    mappingResult.mappings,
  )

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[category-semantic-mapping]', mappingResult.diagnostics)
    console.debug('[category-attribute-rules]', rulesResult.diagnostics)
  }

  const templateMappingByTemplateKey = new Map(
    mappingResult.mappings.map((mapping) => [
      normalizeMappingKey(mapping.templateKey),
      mapping,
    ]),
  )

  const templateMappingBySemanticName = new Map(
    mappingResult.mappings.map((mapping) => [
      normalizeMappingKey(mapping.semanticFieldName),
      mapping,
    ]),
  )

  const hasCatalogAttributes = isRecord(details.attributes)
  const semanticMap = normalizeSemanticMap(
    details.attributes ?? details.semantic_data,
  )
  const source: 'canonical' | 'legacy' = hasCatalogAttributes ? 'canonical' : 'legacy'

  const attributes: CanonicalProductAttribute[] = []

  for (const [key, rawValue] of Object.entries(
    semanticMap,
  )) {
    if (
      rawValue === null ||
      rawValue === undefined ||
      rawValue === ''
    ) {
      continue
    }

    const canonicalKey = normalizeMappingKey(key)

    // Check if there is a category semantic mapping for this semantic_data key
    const mapping =
      templateMappingBySemanticName.get(canonicalKey) ||
      templateMappingByTemplateKey.get(canonicalKey)

    const semanticField = mapping
      ? fields.find((f) => f.id === mapping.semanticFieldId)
      : fields.find((f) => normalizeMappingKey(f.field_name) === canonicalKey)

    const directTemplateField = templateMap.get(
      normalizeMappingKey(mapping?.templateKey ?? key),
    )

    const templateField = directTemplateField

    attributes.push({
      fieldKey: mapping?.templateKey ?? key,
      label:
        templateField?.nameZh ||
        templateField?.nameEn ||
        semanticField?.display_name ||
        key,
      value: String(rawValue),
      type: normalizeType(
        templateField?.type ||
          semanticField?.field_type,
      ),
      unit:
        templateField?.unit ??
        null,
      source:
        source === 'canonical'
          ? inferSource(isRecord(rawValue) && typeof rawValue.source === 'string' ? rawValue.source : null)
          : 'system',
      confidence:
        isRecord(rawValue) && typeof rawValue.confidence === 'number'
          ? rawValue.confidence
          : undefined,
      isStandard: Boolean(mapping),
    })
  }

  // Compatibility fallback for older products.
  if (source === 'legacy') {
    const legacyAttributes = getRawAttributes(rawData)
    const merged = mergeLegacyAttributes(attributes, legacyAttributes)
    attributes.length = 0
    attributes.push(...merged)
  } else {
    // Keep unknown legacy/custom fields visible without overriding canonical fields
    const legacyAttributes = getRawAttributes(rawData)
    const canonicalKeys = new Set(
      attributes.map((attr) => normalizeMappingKey(attr.fieldKey)),
    )

    for (const attr of legacyAttributes) {
      if (!canonicalKeys.has(normalizeMappingKey(attr.fieldKey))) {
        attributes.push(attr)
      }
    }
  }

  // Strict isStandard and Rule assignment based on formal Mapping & Rule Resolver
  for (const attr of attributes) {
    const normKey = normalizeMappingKey(attr.fieldKey)
    const mapping =
      templateMappingByTemplateKey.get(normKey) ||
      templateMappingBySemanticName.get(normKey)

    attr.isStandard = Boolean(mapping)

    const resolvedTemplateKey = mapping?.templateKey ?? attr.fieldKey
    const templateField = templateMap.get(
      normalizeMappingKey(resolvedTemplateKey),
    )

    if (templateField) {
      attr.label = templateField.nameZh || templateField.nameEn || attr.label || attr.fieldKey
      attr.type = normalizeType(templateField.type, attr.type)
      if (templateField.unit) {
        attr.unit = templateField.unit
      }
    }

    const rule =
      rulesResult.rules.get(resolvedTemplateKey) ||
      rulesResult.rules.get(normKey)

    if (rule) {
      attr.type = rule.type
      attr.required = rule.required
      if (rule.unit !== undefined) {
        attr.unit = rule.unit
      }
      if (rule.allowedValues && rule.allowedValues.length > 0) {
        attr.allowedValues = rule.allowedValues
      }
      if (rule.min !== undefined) {
        attr.min = rule.min
      }
      if (rule.max !== undefined) {
        attr.max = rule.max
      }
    } else {
      attr.required = false
    }
  }

  // Resolve Conditional Attribute States
  const conditionalRules = getCategoryConditionalRules(category)
  const { conditionalState } = resolveEffectiveAttributeRules(
    attributes,
    rulesResult.rules,
    conditionalRules,
  )

  for (const attr of attributes) {
    const normKey = normalizeMappingKey(attr.fieldKey)
    const mapping =
      templateMappingByTemplateKey.get(normKey) ||
      templateMappingBySemanticName.get(normKey)
    const resolvedTemplateKey = mapping?.templateKey ?? attr.fieldKey

    const state = conditionalState.states.get(resolvedTemplateKey) || conditionalState.states.get(normKey)
    if (state) {
      attr.visible = state.visible
      attr.required = state.required
      attr.conditional = state.triggeredRuleIds.length > 0
      attr.triggeredRuleIds = state.triggeredRuleIds
    } else {
      attr.visible = true
      attr.conditional = false
      attr.triggeredRuleIds = []
    }
  }

  const presentKeys = new Set(
    attributes.map((attr) => normalizeMappingKey(attr.fieldKey)),
  )

  const missingRequiredFields = fields
    .filter((field) => field.required)
    .filter(
      (field) => !presentKeys.has(normalizeMappingKey(field.field_name)),
    )
    .map((field) => field.field_name)

  return {
    product_id: productId,
    category,
    schema_id: null,
    schema_version: schemaVersion,
    attributes,
    is_complete:
      source === 'canonical' && missingRequiredFields.length === 0,
    is_legacy: source === 'legacy',
    missing_required_fields: missingRequiredFields,
  }
}

export async function saveCanonicalProductAttributes(
  productId: string,
  input: SaveCanonicalProductAttributesInput,
): Promise<SaveCanonicalProductAttributesResult> {
  const {
    supabase,
    schemaVersion,
    fields,
    category: existingCategory,
    rawData,
    persistedDetails,
  } = await loadProductContext(productId)

  const targetCategory = input.category || existingCategory || ''
  const categoryTemplate = getCategoryTemplate(targetCategory)
  const categoryMappings = resolveCategorySemanticMappings(
    targetCategory,
    categoryTemplate?.fields ?? [],
    fields,
  )

  const categoryRules = resolveCategoryAttributeRules(
    categoryTemplate?.fields ?? [],
    fields,
    categoryMappings.mappings,
  )

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[category-semantic-mapping:save]', categoryMappings.diagnostics)
    console.debug('[category-attribute-rules:save]', categoryRules.diagnostics)
  }

  // Resolve Effective Rules with Conditional Rules for validation
  const conditionalRules = getCategoryConditionalRules(targetCategory)
  const { rules: effectiveRules } = resolveEffectiveAttributeRules(
    input.attributes,
    categoryRules.rules,
    conditionalRules,
  )

  // Canonical Rule Validation
  const validation = validateProductAttributes(
    input.attributes,
    effectiveRules,
  )

  if (!validation.valid) {
    throw new ProductAttributeValidationError(validation.issues)
  }

  const incomingInputs: InputAttribute[] = buildMappedInputAttributes(
    input.attributes,
    categoryMappings,
  )

  const semanticData = Object.fromEntries(
    incomingInputs.map((attribute) => [attribute.key, attribute.value]),
  )
  const mapping = {
    semanticData,
    unknownFields: [],
    accepted: incomingInputs.map((attribute) => ({
      sourceKey: attribute.key,
      semanticField: attribute.key,
      value: attribute.value,
      confidence: attribute.confidence ?? 1,
    })),
    rejected: [],
  }

  const nextDetails: JsonRecord = {
    ...persistedDetails,
  }
  delete nextDetails.attributes
  delete nextDetails.semantic_data
  delete nextDetails.category_id

  if (input.category !== undefined) {
    nextDetails.category = input.category || null
  } else if (existingCategory) {
    nextDetails.category = existingCategory
  }

  const deletions = (input.deletions ?? [])
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean)
  const { error: attributesError } = await supabase.rpc('save_catalog_item_attributes', {
    p_item_id: productId,
    p_attributes: incomingInputs.map((mapped, index) => {
      const original = input.attributes[index]
      return {
        key: mapped.key,
        label: original.label ?? mapped.label ?? mapped.key,
        value: mapped.value,
        type: mapped.type ?? original.type ?? 'text',
        unit: mapped.unit ?? original.unit ?? null,
        source: original.source ?? 'manual',
        confidence: mapped.confidence ?? original.confidence ?? 1,
        required: original.required ?? false,
        allowed_values: original.allowedValues ?? [],
      }
    }),
    p_deletions: deletions,
    p_category_id: input.categoryId && isUuid(input.categoryId) ? input.categoryId : null,
  })
  if (attributesError) {
    throw new Error(`Failed to save PIM attributes: ${attributesError.message}`)
  }

  const { error } = await supabase
    .from('catalog_items')
    .update({ details: nextDetails })
    .eq('id', productId)

  if (error) {
    throw new Error(
      `Failed to save Catalog attributes: ${error.message}`,
    )
  }

  const canonical = await getCanonicalProductAttributes(productId)

  return {
    mapping,
    canonical: {
      ...canonical,
      schema_version:
        canonical.schema_version ?? schemaVersion,
    },
  }
}
