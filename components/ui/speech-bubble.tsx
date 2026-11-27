import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SpeechBubbleProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  side?: 'left' | 'right'
  showCursor?: boolean
}

export function SpeechBubble({
  children,
  className,
  side = 'left',
  showCursor = true,
  ...props
}: SpeechBubbleProps) {
  const tailStyle = side === 'left'
    ? { left: -11, clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }
    : { right: -11, clipPath: 'polygon(0 0, 0 100%, 100% 100%)' }

  return (
    <div
      {...props}
      className={cn(
        'relative isolate w-fit max-w-full rounded-2xl px-4 py-3',
        side === 'left'
          ? 'rounded-bl-sm bg-[var(--brand-primary-soft)] text-[var(--neutral-ink)]'
          : 'rounded-br-sm bg-[var(--brand-primary)] text-[var(--neutral-paper)]',
        className,
      )}
      data-slot="speech-bubble"
    >
      <span
        aria-hidden="true"
        style={{
          ...tailStyle,
          position: 'absolute',
          bottom: 2,
          zIndex: 0,
          width: 20,
          height: 16,
          pointerEvents: 'none',
          backgroundColor: side === 'left' ? 'var(--brand-primary-soft)' : 'var(--brand-primary)',
        }}
      />
      <div className="relative z-10 min-w-0">
        {children}
        {showCursor && <span aria-hidden="true" className="ml-1 inline-block h-4 w-px translate-y-0.5 bg-current motion-safe:animate-pulse" />}
      </div>
    </div>
  )
}
