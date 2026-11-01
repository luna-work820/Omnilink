'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { LoaderCircle, RefreshCw } from 'lucide-react'

type RefineFrameStatus = 'idle' | 'queued' | 'processing' | 'generating' | 'complete' | 'completed' | 'success' | 'error' | 'failed'

type RefineFrameProps = {
  status: RefineFrameStatus | string
  aspectRatio?: string
  width?: number
  radius?: number
  background?: string
  color?: string
  stageDuration?: number
  sweep?: boolean
  showStatus?: boolean
  hideAfter?: number
  retryLabel?: string
  onRetry?: () => void
  children: ReactNode
}

const activeStatuses = new Set(['queued', 'processing', 'generating'])
const completedStatuses = new Set(['complete', 'completed', 'success'])
const failedStatuses = new Set(['error', 'failed'])

export default function RefineFrame({
  status,
  aspectRatio = '4 / 3',
  width = 320,
  radius = 16,
  background = '#27272a',
  color = '#f5f5f5',
  stageDuration = 400,
  sweep = false,
  showStatus = true,
  hideAfter = 1200,
  retryLabel = 'Retry',
  onRetry,
  children,
}: RefineFrameProps) {
  const [hiddenStatus, setHiddenStatus] = useState<string | null>(null)
  const statusHidden = hiddenStatus === status
  const active = activeStatuses.has(status)
  const complete = completedStatuses.has(status)
  const failed = failedStatuses.has(status)

  useEffect(() => {
    if (!complete || hideAfter <= 0 || statusHidden) return
    const timer = window.setTimeout(() => setHiddenStatus(status), hideAfter)
    return () => window.clearTimeout(timer)
  }, [complete, hideAfter, status, statusHidden])

  const style = {
    '--refine-duration': `${stageDuration}ms`,
    width: `min(100%, ${width}px)`,
    aspectRatio,
    borderRadius: `${radius}px`,
    background,
    color,
  } as CSSProperties

  const label = failed ? '生成失败' : active ? '正在生成' : complete ? '已完成' : '待生成'

  return (
    <div className={`refine-frame relative isolate overflow-hidden ${active ? 'is-active' : ''} ${sweep && active ? 'has-sweep' : ''}`} style={style}>
      <div className="absolute inset-0 [&>img]:h-full [&>img]:w-full [&>img]:object-cover">{children}</div>
      {active && <div className="refine-frame__veil absolute inset-0 grid place-items-center bg-black/45"><LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" /><span className="sr-only">图片生成中</span></div>}
      {showStatus && !statusHidden && (
        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm" role="status">
            {active && <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" />}
            {label}
          </span>
          {failed && onRetry && <button type="button" onClick={onRetry} className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] bg-white px-2.5 text-xs font-semibold text-[var(--text-primary)]" aria-label={retryLabel}><RefreshCw className="h-3 w-3" aria-hidden="true" />{retryLabel}</button>}
        </div>
      )}
    </div>
  )
}
