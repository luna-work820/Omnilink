import Link from 'next/link'

const modules = [
  {
    priority: 'P0',
    name: '品牌规则与版本',
    current: '首页可见基础品牌项目字段，另有商家档案和修订数据模型。',
    missing: '品牌事实来源、语气与视觉规则、规则校验结果、生效版本。',
    next: '建立品牌规则完整度和当前版本视图，并可打开变更记录。',
    href: '/dashboard/brand-studio',
    action: '打开品牌资料',
  },
  {
    priority: 'P0',
    name: '资料来源与事实证据',
    current: '已有知识库、来源记录入口，以及商品来源和字段证据的数据表。',
    missing: '来源摄取进度、失败原因、字段级证据和冲突提示。',
    next: '建立来源收件箱；每个 AI 事实都能追到文件、网页或人工记录。',
    href: '/dashboard/provenance',
    action: '打开来源记录',
  },
  {
    priority: 'P0',
    name: 'AI 变更审核',
    current: '数据层支持变更集待审、通过、拒绝、应用和失败状态。',
    missing: '待审队列、字段前后差异、引用证据、审核人和处理结果。',
    next: '提供逐字段比较及批准、拒绝操作，审核完成后记录审计事件。',
    href: '/dashboard/products',
    action: '打开商品库',
  },
  {
    priority: 'P0',
    name: '渠道检查与发布版本',
    current: '商品内容有渠道和审核状态；店铺页面有草稿及不可变版本模型。',
    missing: '发布前必填项检查、内容审批汇总、当前版本和回退入口。',
    next: '按渠道显示缺项和审核状态；发布后保留版本差异及恢复操作。',
    href: '/dashboard/products',
    action: '检查商品内容',
  },
  {
    priority: 'P1',
    name: '商品可售准备度',
    current: '商品、SKU 变体、价格、库存和渠道销售关联已有数据基础。',
    missing: '区分商品资料完整与商品可售；指出各渠道的价格、库存、变体缺口。',
    next: '按渠道运行可售校验；没有价格或库存数据时显示未知，不推测。',
    href: '/dashboard/products',
    action: '打开商品库',
  },
  {
    priority: 'P1',
    name: '团队任务与审计历史',
    current: '工作台可保存本机聊天历史，生成物可以在当前工作区引用。',
    missing: '跨设备持久任务、负责人、状态、来源快照和审核审计记录。',
    next: '增加团队任务与产物记录，并从现有本地历史提供迁移或导出。',
    href: '/dashboard/knowledge',
    action: '打开知识库',
  },
]

export default function WorkbenchAssessmentPage() {
  return (
    <main className="min-h-full bg-[var(--canvas)] px-5 py-8 text-[var(--text-primary)] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard" className="inline-flex min-h-10 items-center text-sm font-medium text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--text-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2">
          ← 返回工作台
        </Link>

        <header className="mt-7 max-w-3xl border-b border-[var(--border-subtle)] pb-7">
          <p className="text-xs font-semibold text-[var(--accent-primary)]">工作台 / 模块评测</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">发布前还需要哪些能力</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            对照开源项目的品牌治理、来源追溯和商品运营模型，并检查 Omnilink 当前页面、API 与数据表。这里列的是待建设能力，不代表已接入的实时状态。
          </p>
        </header>

        <section className="mt-5" aria-label="模块评测结果">
          {modules.map((module) => (
            <article key={module.name} className="grid gap-3 border-b border-[var(--border-subtle)] py-5 sm:grid-cols-[minmax(150px,0.7fr)_minmax(0,1.8fr)_auto] sm:items-start sm:gap-6">
              <div>
                <p className={`text-[11px] font-semibold ${module.priority === 'P0' ? 'text-[#9F3128]' : 'text-[var(--text-muted)]'}`}>{module.priority} · {module.priority === 'P0' ? '必须补齐' : '后续补齐'}</p>
                <h2 className="mt-1 text-base font-semibold leading-6">{module.name}</h2>
              </div>

              <dl className="grid min-w-0 gap-3 text-sm leading-6 sm:grid-cols-3 sm:gap-5">
                <div>
                  <dt className="text-xs font-medium text-[var(--text-muted)]">已有基础</dt>
                  <dd className="mt-1 text-[var(--text-secondary)]">{module.current}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-muted)]">当前缺口</dt>
                  <dd className="mt-1 text-[var(--text-primary)]">{module.missing}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-muted)]">建议模块</dt>
                  <dd className="mt-1 text-[var(--text-secondary)]">{module.next}</dd>
                </div>
              </dl>

              <Link href={module.href} className="inline-flex min-h-10 items-center text-sm font-semibold text-[var(--accent-primary)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)] focus-visible:outline-offset-2 sm:justify-self-end">
                {module.action}
              </Link>
            </article>
          ))}
        </section>

        <footer className="mt-6 grid gap-3 border-l-2 border-[var(--accent-primary)] pl-4 text-sm leading-6 text-[var(--text-secondary)] sm:grid-cols-2 sm:gap-8">
          <p><strong className="font-semibold text-[var(--text-primary)]">评测依据：</strong>BrandSpec、Brandcode System MCP、brand-book、Medusa 及 Omnilink 本地数据模型。</p>
          <p><strong className="font-semibold text-[var(--text-primary)]">实施建议：</strong>先补齐四项 P0 的汇总数据与可执行处理入口，再建设可售校验和团队级历史。</p>
        </footer>
      </div>
    </main>
  )
}
