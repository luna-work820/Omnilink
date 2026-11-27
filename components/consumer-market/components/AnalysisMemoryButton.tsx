'use client'

import { useState } from 'react'

export function AnalysisMemoryButton({ messageId, onOpen }: { messageId: string; onOpen: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function propose() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/consumer/ai-assistant-profile', {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analysis-propose', messageId }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? '记忆提案暂时无法保存。')
      onOpen()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '记忆提案暂时无法保存。')
    } finally { setBusy(false) }
  }
  return <div>
    <button type="button" disabled={busy} onClick={() => void propose()} className="min-h-11 whitespace-nowrap rounded-full px-3 text-xs font-medium hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40">{busy ? '整理中' : '整理到记忆'}</button>
    {error && <p role="alert" className="text-xs text-[var(--market-text-secondary)]">{error}</p>}
  </div>
}
