import type { AttributeRow } from '@/components/product/create/ProductAttributesPanel'
import { getCategoryTemplate } from '@/lib/product/category-templates'

export function applyCategoryAttributePreset(rows: AttributeRow[], category: string, isZh: boolean): AttributeRow[] {
  const template = getCategoryTemplate(category)
  const retained = rows.flatMap((row) => {
    if (!row.templateId) return [row]
    const wasEdited = row.role === 'trait'
      ? Boolean(row.value.trim())
      : JSON.stringify(row.values) !== JSON.stringify(row.templateValues ?? [])
    return wasEdited ? [{ ...row, templateId: undefined, templateValues: undefined }] : []
  })
  if (!template) return retained

  const traits: AttributeRow[] = template.fields
    .filter((field) => !retained.some((row) => row.role === 'trait' && row.key === field.key))
    .map((field) => ({
      id: `category_${template.id}_trait_${field.key}`,
      role: 'trait',
      key: field.key,
      label: isZh ? field.nameZh : field.nameEn,
      value: '',
      values: [],
      unit: field.unit,
      placeholder: isZh ? field.placeholderZh : field.placeholderEn,
      templateId: template.id,
    }))
  const variants: AttributeRow[] = (template.variantPresets ?? [])
    .filter((preset) => !retained.some((row) => row.role === 'variant' && row.key === preset.code))
    .map((preset) => ({
      id: `category_${template.id}_variant_${preset.code}`,
      role: 'variant',
      key: preset.code,
      label: isZh ? preset.nameZh : preset.nameEn,
      value: '',
      values: [...preset.defaultValues],
      templateId: template.id,
      templateValues: [...preset.defaultValues],
    }))
  return [...retained, ...traits, ...variants]
}
