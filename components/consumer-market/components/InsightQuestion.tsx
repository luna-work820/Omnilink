'use client'

import type { InsightOption, InsightQuestion as Question } from '@/lib/consumer-advisor/fashion-insight'

export function InsightQuestion({ question, selectedValue, onChange, onSkip, onSelect, disabled = false, name }: {
  question: Question
  selectedValue: string
  onChange: (value: string) => void
  onSkip: () => void
  onSelect: (option: InsightOption) => void
  disabled?: boolean
  name: string
}) {
  const selected = question.options.find((option) => option.value === selectedValue)
  return <section aria-label="细化本次搜索" className="max-w-md text-[var(--market-ink)]">
    <fieldset>
      <legend className="text-sm font-medium leading-5">{question.prompt}</legend>
      <div className="mt-2.5 space-y-1.5">
        {question.options.map((option) => <label key={option.value} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border-[0.5px] px-3 text-sm transition-colors duration-[180ms] ease-out focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[var(--market-support)] ${selectedValue === option.value ? 'border-[var(--market-support)] bg-[var(--market-support-soft)]' : 'border-[var(--market-border)] hover:bg-[var(--market-hover)]'}`}>
          <input type="radio" name={name} value={option.value} checked={selectedValue === option.value} disabled={disabled} onChange={() => onChange(option.value)} className="h-4 w-4 shrink-0 accent-[var(--market-support)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] disabled:opacity-50" />
          <span className="min-w-0 flex-1 font-medium">{option.label}</span>
        </label>)}
      </div>
    </fieldset>
    <div className="mt-2.5 flex items-center justify-between gap-3">
      <button type="button" disabled={disabled} onClick={onSkip} className="min-h-10 rounded-full px-3 text-xs text-[var(--market-text-secondary)] hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40">跳过</button>
      <button type="button" disabled={!selected || disabled} onClick={() => selected && onSelect(selected)} className="min-h-10 rounded-full bg-[var(--market-ink)] px-4 text-xs font-medium text-[var(--market-canvas)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40">应用</button>
    </div>
  </section>
}
