'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export function PersonalPanel({ profileName, publisherReady, creatorReady = false, onNavigate }: { profileName: string | null; publisherReady: boolean; creatorReady?: boolean; onNavigate?: () => void }) {
  const name = profileName?.trim() || '访客';
  const actionClass = 'mt-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-full px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]';

  return (
    <section className="rounded-[var(--radius-dialog-inner)] p-3 text-[var(--market-ink)]">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--market-surface-muted)] text-sm font-semibold" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h2 id="personal-menu-title" className="truncate text-sm font-medium">{name}</h2>
          <p className="mt-1 text-xs text-[var(--market-text-muted)]">
            {[creatorReady && '创作者', publisherReady && '商家'].filter(Boolean).join('、') || '浏览者'}
          </p>
        </div>
      </div>
      <Link href="/creator" target="_blank" rel="noopener noreferrer" prefetch={false} aria-label="创作者中心，在新标签页打开" className={actionClass+' bg-[var(--market-ink)] text-[var(--surface)] hover:opacity-90'} onClick={() => onNavigate?.()}>
        <span>创作者中心</span>
        <ChevronRight size={14} aria-hidden="true" />
      </Link>
      <Link href="/merchant" target="_blank" rel="noopener noreferrer" prefetch={false} aria-label="商家中心，在新标签页打开" className={actionClass+' hover:bg-[var(--market-hover)]'} onClick={() => onNavigate?.()}>
        <span>商家中心</span>
        <ChevronRight size={14} aria-hidden="true" />
      </Link>
    </section>
  );
}
