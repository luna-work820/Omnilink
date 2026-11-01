import Link from 'next/link'
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Layers3,
  Package,
  ScanSearch,
  Sparkles,
  Store,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type BrandProject = Database['public']['Tables']['brand_projects']['Row']

const sections = [
  {
    title: '商家定位',
    description: '整理商家的经营主题，作为后续内容生成的依据。',
    href: '/dashboard/brand-studio',
    icon: Store,
    tone: 'blue',
    action: '查看资料',
  },
  {
    title: '商品与素材',
    description: '集中查看商品、图片、视频和它们之间的关系。',
    href: '/dashboard/products',
    icon: Package,
    tone: 'lime',
    action: '进入商品库',
  },
  {
    title: '内容生成',
    description: '选择一个或多个商品，生成适合不同场景的内容。',
    href: '/dashboard/products',
    icon: Sparkles,
    tone: 'ink',
    action: '选择商品',
  },
  {
    title: '知识库',
    description: '沉淀商品知识、服务说明和商家经验，供内容调用。',
    href: '/dashboard/knowledge',
    icon: BookOpen,
    tone: 'blue',
    action: '打开知识库',
  },
] as const

const toneClasses = {
  blue: 'bg-[var(--surface-muted)] text-[var(--secondary-foreground)] border-[var(--border)]',
  lime: 'bg-[var(--secondary)] text-[var(--secondary-foreground)] border-[var(--border)]',
  ink: 'bg-[var(--ink)] text-[var(--surface)] border-[var(--ink)]',
  gray: 'bg-[var(--surface-muted)] text-[var(--ink)] border-[var(--surface-muted)]',
} as const

export function MerchantHomeView({
  displayName,
  merchantProject,
}: {
  displayName: string
  merchantProject: BrandProject
}) {
  const merchantName = merchantProject.name || displayName || '我的商家'
  const merchantConcept = merchantProject.concept || '还没有完成商家定位，先从已有资料开始整理。'
  const merchantCategory = merchantProject.category || '待补充经营类型'

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-7 pb-10 text-[var(--ink)]">
      <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--ink)] px-6 py-8 text-[var(--surface)] sm:px-10 sm:py-10 lg:px-14 lg:py-12">
        <div className="relative z-10 max-w-3xl">
          <div className="mb-6 flex items-center gap-3 text-sm font-medium text-[var(--surface)]/80">
            <span className="flex h-8 w-8 items-center justify-center bg-[var(--surface)] text-[var(--ink)]">
              <Layers3 size={17} aria-hidden="true" />
            </span>
            Omnilink 商家工作台
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            让商家的真实资料，变成可以使用的内容
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--surface)]/80 sm:text-lg">
            商品、素材、知识和来源统一整理，再按不同场景生成经营内容。
          </p>
          <Link
            href="/dashboard/brand-studio"
            className="mt-8 inline-flex min-h-11 items-center gap-2 bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--surface)] focus-visible:outline-offset-2"
          >
            完善商家资料
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="pointer-events-none absolute -right-12 top-1/2 hidden -translate-y-1/2 items-center gap-3 lg:flex">
          <div className="w-48 rotate-[-7deg] rounded-[var(--radius-card)] border border-[var(--surface)]/40 bg-[var(--surface)] p-4 text-[var(--ink)] shadow-xl">
            <p className="text-sm font-semibold">商家定位</p>
            <p className="mt-8 text-3xl font-semibold">待确认</p>
          </div>
          <div className="w-48 translate-y-12 rotate-[5deg] rounded-[var(--radius-card)] border border-[var(--surface)]/40 bg-[var(--accent-secondary-soft)] p-4 text-[var(--ink)] shadow-xl">
            <p className="text-sm font-semibold">内容生成</p>
            <p className="mt-8 text-3xl font-semibold">可开始</p>
          </div>
          <div className="w-48 rotate-[11deg] rounded-[var(--radius-card)] border border-[var(--surface)]/40 bg-[var(--ink)] p-4 text-[var(--surface)] shadow-xl">
            <p className="text-sm font-semibold">资料关系</p>
            <p className="mt-8 text-3xl font-semibold">持续整理</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="ui-card p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--primary)]">商家定位</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">{merchantName}</h2>
            </div>
            <Link
              href="/dashboard/brand-studio"
              className="inline-flex min-h-10 items-center gap-1  border border-[var(--border)] px-3 text-sm font-medium transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"
            >
              编辑
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-sm text-[var(--lavender)]">经营类型</p>
              <p className="mt-2 text-lg font-medium">{merchantCategory}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--lavender)]">当前主题</p>
              <p className="mt-2 text-lg font-medium">{merchantConcept}</p>
            </div>
          </div>
          <div className="mt-8 flex items-center gap-3 border-t border-[var(--surface-muted)] pt-5 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--acid-sage)] text-[var(--ink)]">
              <Check size={15} aria-hidden="true" />
            </span>
            已建立商家资料入口
          </div>
        </div>

        <div className="ui-card ui-card--nested p-6 sm:p-8">
          <p className="text-sm font-medium text-[var(--primary)]">现在可以处理</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">从一件事开始</h2>
          <div className="mt-7 space-y-4">
            <Link href="/dashboard/brand-studio" className="group flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2">
              <span className="text-base font-medium">补充商家定位</span>
              <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true" />
            </Link>
            <Link href="/dashboard/products" className="group flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2">
              <span className="text-base font-medium">上传商品与素材</span>
              <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--primary)]">工作区</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">商家的五个核心入口</h2>
          </div>
          <Link href="/dashboard/products" className="hidden text-sm font-medium text-[var(--primary)] hover:underline sm:block">查看全部</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <Link
                key={section.title}
                href={section.href}
                className={`group min-h-52 rounded-[var(--radius-card)] border p-5 transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2 ${toneClasses[section.tone]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Icon size={24} aria-hidden="true" />
                  <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true" />
                </div>
                <h3 className="mt-12 text-xl font-semibold">{section.title}</h3>
                <p className="mt-3 text-sm leading-6 opacity-75">{section.description}</p>
                <span className="mt-5 inline-block text-sm font-semibold">{section.action}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[var(--radius-card)] bg-[var(--ink)] p-6 text-[var(--surface)] sm:p-8">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--acid-sage)]">资料关系</p>
            <ScanSearch size={22} aria-hidden="true" />
          </div>
          <h2 className="mt-8 max-w-sm text-3xl font-semibold tracking-[-0.03em]">一份商家资料，连接多个经营场景</h2>
          <div className="mt-8 flex flex-wrap gap-2 text-sm">
            {['商家定位', '商品素材', '商家知识', '内容输出', '来源记录'].map((label) => (
              <span key={label} className=" border border-[var(--surface)]/20 px-3 py-2 text-[var(--surface)]/80">{label}</span>
            ))}
          </div>
        </div>
        <div className="ui-card p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--primary)]">内容生成</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">选择对象，开始生成</h2>
            </div>
            <Sparkles size={26} className="text-[var(--primary)]" aria-hidden="true" />
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {['一个商品', '多个商品', '一组素材'].map((label) => (
              <Link
                key={label}
                href="/dashboard/products"
                className=" border border-[var(--border)] p-4 text-center text-sm font-medium transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
