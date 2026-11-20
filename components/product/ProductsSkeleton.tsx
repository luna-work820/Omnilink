export function ProductsSkeleton() {
  return <section aria-label="正在加载商品" aria-busy="true" className="px-6 py-6">
    <div className="mx-auto max-w-6xl space-y-8" aria-hidden="true">
      <div className="flex items-center justify-between gap-4">
        <div className="h-8 w-20 rounded bg-[var(--surface-muted)]" />
        <div className="h-11 w-28 rounded-full bg-[var(--surface-muted)]" />
      </div>
      <div className="h-10 w-full rounded-md bg-[var(--surface-muted)] sm:w-72" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="space-y-4">
          <div className="aspect-square rounded-[var(--radius-card)] bg-[var(--surface-muted)]" />
          <div className="h-4 w-2/3 rounded bg-[var(--surface-muted)]" />
          <div className="h-3 w-1/3 rounded bg-[var(--surface-muted)]" />
        </div>)}
      </div>
    </div>
  </section>
}
