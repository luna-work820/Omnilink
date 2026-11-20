'use client'

import { useEffect, useState } from 'react'
import { LiquidGlass } from '@/components/ui/liquid-glass'
import { signupInvitationStorageKey } from '@/lib/auth/signup-entry'

export function SignupInvitation({ userId, enabled, blocked, preview = false, onStartAssistant, onBrowse }: {
  userId: string; enabled: boolean; blocked: boolean; preview?: boolean
  onStartAssistant: () => void; onBrowse: () => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!enabled) return
    if (blocked) queueMicrotask(() => setOpen(false))
    const key = signupInvitationStorageKey(userId)
    let stored: string | null = null
    try { stored = localStorage.getItem(key) } catch {}
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('.home-feed-scroller img'))
      .filter((image) => image.getBoundingClientRect().top < window.innerHeight).slice(0, 6)
    const cleanups: (() => void)[] = []

    async function saveSeen() {
      if (preview) return
      try {
        const response = await fetch('/api/consumer/ai-assistant-profile', {
          method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'signup-invitation-seen' }),
        })
        if (response.ok) { try { localStorage.setItem(key, 'seen') } catch {} }
      } catch { /* A pending local record is retried on the next visit. */ }
    }

    if (stored) {
      if (stored === 'pending') void saveSeen()
      return
    }
    if (blocked) return
    const ready = Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
      const done = () => resolve()
      image.addEventListener('load', done, { once: true })
      image.addEventListener('error', done, { once: true })
      cleanups.push(() => { image.removeEventListener('load', done); image.removeEventListener('error', done) })
    })))
    const deadline = new Promise<void>((resolve) => { timer = setTimeout(resolve, 1800) })
    void Promise.race([ready, deadline]).then(() => {
      if (timer) clearTimeout(timer)
      if (cancelled) return
      timer = setTimeout(() => {
        if (cancelled) return
        try { localStorage.setItem(key, 'pending') } catch {}
        setOpen(true)
        void saveSeen()
        // Remove old signup-only flags without navigating or resetting the feed.
        const url = new URL(window.location.href)
        url.searchParams.delete('newUser')
        url.searchParams.delete('openAssistant')
        window.history.replaceState(window.history.state, '', url)
      }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 800)
    })
    return () => { cancelled = true; if (timer) clearTimeout(timer); cleanups.forEach((cleanup) => cleanup()) }
  }, [enabled, userId, blocked, preview])

  if (!open || blocked) return null
  const close = () => setOpen(false)
  return (
    <section aria-label="开始探索" onKeyDown={(event) => { if (event.key === 'Escape') { close(); onBrowse() } }}
      className="signup-invitation animate-in fade-in slide-in-from-bottom-2 duration-250 motion-reduce:animate-none absolute inset-x-3 bottom-28 z-30 mx-auto max-w-3xl">
      <LiquidGlass radius={24} bevelDepth={12} aberration={0.18} tint={1} className="max-h-[55dvh] overflow-y-auto p-5 sm:p-6">
        <p role="status" className="text-base font-medium leading-7 text-[var(--market-ink)]">最近有什么想尝试，或者想改善的事？</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <LiquidGlass radius={999} bevelDepth={12} aberration={0.18} tint={1} interactive className="signup-invitation-action w-28 shrink-0">
            <button type="button" onClick={() => { close(); onStartAssistant() }} className="flex h-11 w-full items-center justify-center rounded-full text-sm font-medium text-[var(--market-ink)] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--market-support)]">个人助手</button>
          </LiquidGlass>
          <LiquidGlass radius={999} bevelDepth={12} aberration={0.18} tint={1} interactive className="signup-invitation-action w-28 shrink-0">
            <button type="button" onClick={() => { close(); onBrowse() }} className="flex h-11 w-full items-center justify-center rounded-full text-sm font-medium text-[var(--market-ink)] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--market-support)]">先逛逛</button>
          </LiquidGlass>
        </div>
      </LiquidGlass>
    </section>
  )
}
