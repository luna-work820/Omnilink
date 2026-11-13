'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useOmnilink } from '../context/OmnilinkContext';

export function PersonalPanel({ profileName, publisherReady, onNavigate }: { profileName: string | null; publisherReady: boolean; onNavigate?: () => void }) {
  const name = profileName?.trim() || '访客';
  const { showToast, openPersonalView } = useOmnilink();
  const actionClass = 'mt-3 flex min-h-9 w-full items-center justify-between gap-2 rounded-full bg-[var(--market-accent)] px-3 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]';

  return (
    <section className="rounded-[var(--radius-dialog-inner)] bg-[var(--market-surface)] p-3 text-[var(--market-ink)]">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--market-surface-muted)] text-sm font-semibold" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h2 id="personal-menu-title" className="truncate text-sm font-medium">{name}</h2>
          <p className="mt-1 text-xs text-[var(--market-text-muted)]">
            {publisherReady ? '浏览者、发布者' : '浏览者'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-1">
        {([['memories', '记忆'], ['assessment', '评测']] as const).map(([view, label]) => (
          <button
            key={view}
            type="button"
            onClick={() => {
              openPersonalView(view);
              onNavigate?.();
            }}
            className="min-h-11 flex-1 rounded-full px-3 text-xs hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"
          >
            {label}
          </button>
        ))}
      </div>
      {publisherReady ? (
        <Link href="/dashboard/products" className={actionClass}>
          <span>进入发布工作台</span>
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      ) : (
        <button type="button" onClick={() => showToast('暂未开放')} className={actionClass}>
          <span>成为内容创作者</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
      <Link href="/merchant" className={actionClass} onClick={() => onNavigate?.()}>
        <span>{publisherReady ? '进入商家工作台' : '成为商家'}</span>
        <ChevronRight size={14} aria-hidden="true" />
      </Link>
    </section>
  );
}
