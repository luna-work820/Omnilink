'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  CircleDashed,
  Database,
  MessageCircleQuestion,
  Plus,
  X,
} from 'lucide-react'
import type {
  KnowledgeDomain,
  KnowledgeKind,
} from '@/lib/knowledge/model'
import { useDashboardWorkspace } from '@/components/dashboard/DashboardWorkspaceProvider'
import { UiverseButton } from '@/components/ui/UiverseButton'

const FIELD_CLASS = 'w-full  border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[#A19A91] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]'

const DOMAIN_LABELS: Record<KnowledgeDomain, string> = {
  merchant: '商家基础',
  brand: '品牌表达',
  product: '商品事实',
  customer: '客户与场景',
  operations: '经营方式',
}

const KIND_LABELS: Record<KnowledgeKind, string> = {
  fact: '事实',
  claim: '主张',
  preference: '偏好',
  inference: '推断',
}

const STATUS_LABELS = {
  draft: '草稿',
  pending_review: '待审核',
  confirmed: '已确认',
  rejected: '已拒绝',
} as const

const TEMPLATE_SECTIONS: Array<{ domain: KnowledgeDomain; title: string; description: string }> = [
  { domain: 'merchant', title: '商家基础', description: '你是谁、卖什么、服务哪些市场' },
  { domain: 'brand', title: '品牌表达', description: '希望别人如何理解你，以及不能怎样表达' },
  { domain: 'product', title: '商品事实', description: '材质、规格、价格、来源和可验证能力' },
  { domain: 'customer', title: '客户与场景', description: '谁会购买，以及他们在什么场景下需要它' },
  { domain: 'operations', title: '经营方式', description: '履约、售后、渠道和服务边界' },
]

export function KnowledgeLibrary() {
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const composerTriggerRef = useRef<HTMLButtonElement>(null)
  const dialogCloseRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isComposerOpen) dialogCloseRef.current?.focus()
  }, [isComposerOpen])

  function closeComposer() {
    setIsComposerOpen(false)
    requestAnimationFrame(() => composerTriggerRef.current?.focus())
  }

  function openComposer(event: React.MouseEvent<HTMLButtonElement>) {
    composerTriggerRef.current = event.currentTarget
    setIsComposerOpen(true)
  }
  const [domain, setDomain] = useState<KnowledgeDomain>('merchant')
  const [kind, setKind] = useState<KnowledgeKind>('fact')
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const { knowledgeEntries: entries, addKnowledgeEntry } = useDashboardWorkspace()

  const confirmedCount = useMemo(
    () => entries.filter((entry) => entry.status === 'confirmed').length,
    [entries],
  )

  function handleCreateEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!key.trim() || !value.trim()) return

    addKnowledgeEntry({
      domain,
      kind,
      key: key.trim(),
      value: value.trim(),
      status: 'draft',
      sourceId: 'local-form',
      updatedAt: '刚刚',
    })
    setKey('')
    setValue('')
    setIsComposerOpen(false)
  }

  return (
    <section className="h-full overflow-y-auto bg-[var(--background)] px-5 py-6 text-[var(--ink)] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-[var(--border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--primary)]">
              <Database className="h-4 w-4" aria-hidden="true" />
              Merchant Knowledge Base
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">知识库</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--lavender)]">
              先沉淀真实商家事实，再让品牌、商品和内容能力读取它们。当前知识库为空，不预置演示资料。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <UiverseButton type="button" onClick={openComposer} className="h-11 text-sm">
              <Plus className="h-4 w-4" aria-hidden="true" /> 添加第一条知识
            </UiverseButton>
            <button type="button" onClick={openComposer} className="ui-secondary inline-flex h-11 items-center gap-2 px-4 text-sm font-semibold">
              <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" /> 从问答开始
            </button>
          </div>
        </header>

        <div className="grid gap-4 py-6 sm:grid-cols-3">
          <Metric label="已确认知识" value={confirmedCount} suffix="条" />
          <Metric label="待审核更新" value={entries.filter((entry) => entry.status === 'pending_review').length} suffix="条" />
          <Metric label="来源" value={entries.length ? 1 : 0} suffix="个" />
        </div>

        {entries.length === 0 ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
              <div className="flex max-w-2xl items-start gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[var(--surface-muted)] text-[var(--primary)]">
                  <CircleDashed className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.02em]">还没有知识条目</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--lavender)]">不先创建空的品牌卡片。你可以输入一条确定事实，或从问答开始，让知识库逐步形成。</p>
                </div>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {TEMPLATE_SECTIONS.map((section) => (
                  <div key={section.domain} className="rounded-[16px] border border-[var(--border)] bg-[var(--background)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">{section.title}</h3>
                      <span className=" bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--lavender)]">未开始</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--lavender)]">{section.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <aside className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lavender)]">最小模型</p>
              <h2 className="mt-3 text-lg font-semibold">每条知识都要能追溯</h2>
              <div className="mt-6 space-y-4">
                <ModelStep number="01" title="来源 Source" description="文件、网址、商品资料或商家回答" />
                <ModelStep number="02" title="事实 Entry" description="领域、字段、内容和知识类型" />
                <ModelStep number="03" title="状态 Review" description="草稿、待审核、已确认或拒绝" />
              </div>
              <div className="mt-6 border-t border-[var(--border)] pt-5 text-xs leading-5 text-[var(--lavender)]">AI 只能提出更新，不能直接覆盖已确认知识。</div>
            </aside>
          </div>
        ) : (
          <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div>
                <h2 className="text-lg font-semibold">知识条目</h2>
                <p className="mt-1 text-xs text-[var(--lavender)]">当前为本地设计预览，下一步接入数据库。</p>
              </div>
              <button type="button" onClick={openComposer} className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> 添加</button>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {entries.map((entry) => (
                <div key={entry.id} className="grid gap-3 py-4 sm:grid-cols-[150px_minmax(0,1fr)_110px] sm:items-center">
                  <div><p className="text-xs font-semibold text-[var(--primary)]">{DOMAIN_LABELS[entry.domain]}</p><p className="mt-1 text-[11px] text-[var(--lavender)]">{KIND_LABELS[entry.kind]} · {entry.updatedAt}</p></div>
                  <div><p className="text-sm font-semibold">{entry.key}</p><p className="mt-1 text-sm leading-6 text-[var(--lavender)]">{entry.value}</p></div>
                  <span className="inline-flex w-fit items-center gap-1  bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--lavender)]"><CircleDashed className="h-3 w-3" aria-hidden="true" /> {STATUS_LABELS[entry.status]}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {isComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-[var(--ink)]/25 p-4" role="dialog" aria-modal="true" aria-labelledby="knowledge-entry-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeComposer() } }}>
          <form onSubmit={handleCreateEntry} className="w-full max-w-lg rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_70px_rgba(36,32,26,0.18)]">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-[var(--primary)]">第一条知识</p><h2 id="knowledge-entry-title" className="mt-1 text-xl font-semibold">添加可确认事实</h2></div><button ref={dialogCloseRef} type="button" onClick={closeComposer} aria-label="关闭添加知识窗口" className="grid h-9 w-9 place-items-center rounded-[10px] text-[var(--lavender)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"><X className="h-4 w-4" aria-hidden="true" /></button></div>
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2"><Field label="所属领域"><select value={domain} onChange={(event) => setDomain(event.target.value as KnowledgeDomain)} className={FIELD_CLASS}>{Object.entries(DOMAIN_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="知识类型"><select value={kind} onChange={(event) => setKind(event.target.value as KnowledgeKind)} className={FIELD_CLASS}>{Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>
              <Field label="字段名称"><input value={key} onChange={(event) => setKey(event.target.value)} required placeholder="例如：主要经营品类" className={FIELD_CLASS} /></Field>
              <Field label="内容"><textarea value={value} onChange={(event) => setValue(event.target.value)} required rows={4} placeholder="只填写当前确定的信息，不确定的内容留给后续问答。" className={`${FIELD_CLASS} resize-none`} /></Field>
            </div>
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4"><p className="text-xs text-[var(--lavender)]">保存后状态为“草稿”</p><UiverseButton type="submit" className="h-11 text-sm">保存条目 <ArrowRight className="h-4 w-4" aria-hidden="true" /></UiverseButton></div>
          </form>
        </div>
      )}
    </section>
  )
}

function Metric({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4"><p className="text-xs text-[var(--lavender)]">{label}</p><p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{value}<span className="ml-1 text-xs font-normal text-[var(--lavender)]">{suffix}</span></p></div>
}

function ModelStep({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[var(--surface)] text-[10px] font-semibold text-[var(--primary)]">{number}</span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-[var(--lavender)]">{description}</p></div></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-[var(--ink)]">{label}<div className="mt-1.5">{children}</div></label>
}
