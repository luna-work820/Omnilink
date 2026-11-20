'use client'

import { useState, type FormEvent } from 'react'
import { createStoreAction } from '@/app/actions/onboarding'
import { StoreAvatarUpload } from './StoreAvatarUpload'
import { ProductCategorySelector } from './ProductCategorySelector'

export function StoreCreateForm({ capability = 'merchant', initialName = '' }: { capability?: 'creator' | 'merchant'; initialName?: string }) {
  const [name, setName] = useState(initialName)
  const [logo, setLogo] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const creator = capability === 'creator'
  const field = 'w-full rounded-xl border-[0.5px] border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none focus-visible:border-[var(--accent-secondary)]'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    setError('')
    const form = new FormData()
    form.set('capability', capability)
    form.set('store_name', name.trim())
    form.set('logo_url', logo)
    form.set('industry_category', creator ? '' : category)
    form.set('description', description.trim())
    try {
      const result = await createStoreAction(form)
      if (result.success && result.redirectUrl) { window.location.assign(result.redirectUrl); return }
      setError(result.error || '开通失败，请重试')
    } catch {
      setError('开通失败，请重试')
    }
    setBusy(false)
  }

  return <section className="mx-auto w-full max-w-lg">
    <h1 className="mb-8 text-2xl font-semibold">{creator ? '成为内容创作者' : '成为商家'}</h1>
    <form onSubmit={submit} className="space-y-6" aria-busy={busy}>
      <StoreAvatarUpload value={logo} onChange={setLogo} />
      <div className="space-y-2">
        <label htmlFor="workspace-name" className="block text-sm font-medium">{creator ? '创作者名称' : '店铺名称'}</label>
        <input id="workspace-name" required maxLength={40} value={name} onChange={(event) => setName(event.target.value)} className={field} />
      </div>
      {!creator && <ProductCategorySelector value={category} onChange={setCategory} />}
      <div className="space-y-2">
        <label htmlFor="workspace-description" className="block text-sm font-medium">简介<span className="ml-2 text-xs text-[var(--text-secondary)]">可选</span></label>
        <textarea id="workspace-description" rows={3} maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} className={`${field} resize-none`} />
      </div>
      {error && <p role="alert" className="text-sm text-[var(--text-secondary)]">{error}</p>}
      <button type="submit" disabled={busy || !name.trim()} className="min-h-11 w-full rounded-full bg-[var(--text-primary)] px-5 text-sm font-medium text-[var(--surface)] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-secondary)]">{busy ? '正在开通…' : `开通并进入${creator ? '创作者中心' : '商家中心'}`}</button>
    </form>
  </section>
}
