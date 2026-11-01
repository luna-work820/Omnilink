'use client'

import type { ListingType } from '@/lib/products/listing-type'

const options: { value: ListingType; label: string }[] = [
  { value: 'product', label: '商品' },
  { value: 'digital', label: '数字' },
  { value: 'service', label: '服务' },
]

export function ProductListingTypeSelector({ value, onChange, disabled = false }: {
  value: ListingType
  onChange: (value: ListingType) => void
  disabled?: boolean
}) {
  return <fieldset disabled={disabled} className="min-w-0">
    <legend className="mb-2 text-sm font-medium text-[var(--text-primary)]">类型</legend>
    <div className="flex flex-wrap gap-1">
      {options.map((option) => <label key={option.value} className="group relative inline-flex cursor-pointer">
        <input type="radio" name="product-listing-type" value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0" />
        <span className="pointer-events-none inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] px-4 text-sm text-[var(--text-secondary)] transition-colors group-hover:bg-[var(--surface-muted)] peer-checked:bg-[var(--surface-muted)] peer-checked:font-semibold peer-checked:text-[var(--text-primary)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-secondary)]">{option.label}</span>
      </label>)}
    </div>
  </fieldset>
}
