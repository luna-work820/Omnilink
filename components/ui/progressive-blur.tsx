import type { CSSProperties } from 'react'

// Adapted from Skiper UI's Skiper 41 by @gurvinder-singh02.
export function ProgressiveBlur({ position, className = '' }: { position: 'top' | 'bottom'; className?: string }) {
  const direction = position === 'top' ? 'to bottom' : 'to top'
  const style: CSSProperties = {
    [position]: 0,
    height: '72px',
    background: `linear-gradient(${direction}, var(--market-canvas), transparent)`,
    maskImage: `linear-gradient(${direction}, black 25%, transparent)`,
    WebkitBackdropFilter: 'blur(4px)',
    backdropFilter: 'blur(4px)',
  }
  return <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 select-none ${className}`} style={style} />
}
