'use client'

import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

export function SparkShockwave({ navigationOpen, onComplete }: { navigationOpen: boolean; onComplete: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const gradientId = useId().replace(/:/g, '')

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = () => {
      const { width, height } = root.getBoundingClientRect()
      setSize({ width, height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  const radius = size ? Math.max(420, Math.min(650, size.width * 0.65)) : 650
  const centerX = (size?.width ?? 0) / 2
  const centerY = (size?.height ?? 0) + radius
  const endScale = size ? centerY / radius : 1
  const motionStyle = {
    transformOrigin: `${centerX}px ${centerY}px`,
    transformBox: 'view-box',
    '--shockwave-end-scale': endScale,
  } as CSSProperties

  return <div ref={rootRef} className={`spark-shockwave ${navigationOpen ? 'is-navigation-open' : ''}`} aria-hidden="true">
    {size && <svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none">
      <defs>
        <radialGradient id={gradientId} gradientUnits="userSpaceOnUse" cx={centerX} cy={centerY} r={radius * 1.35}>
          <stop offset="0.34" stopColor="var(--spark-shockwave-1)" stopOpacity="0" />
          <stop offset="0.47" stopColor="var(--spark-shockwave-1)" stopOpacity="0.7" />
          <stop offset="0.55" stopColor="var(--spark-shockwave-1)" stopOpacity="0.85" />
          <stop offset="0.63" stopColor="var(--spark-shockwave-2)" stopOpacity="0.85" />
          <stop offset="0.71" stopColor="var(--spark-shockwave-3)" stopOpacity="0.85" />
          <stop offset="0.78" stopColor="var(--spark-shockwave-4)" stopOpacity="0.7" />
          <stop offset="0.89" stopColor="var(--spark-shockwave-4)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="spark-shockwave-motion" style={motionStyle} onAnimationEnd={(event) => {
        if (event.animationName === 'spark-shockwave-expand' || event.animationName === 'spark-shockwave-still') onComplete()
      }}>
        <circle cx={centerX} cy={centerY} r={radius * 1.35} fill={`url(#${gradientId})`} />
        <circle cx={centerX} cy={centerY} r={radius - 2} fill="none" stroke="var(--spark-shockwave-1)" strokeWidth="2" strokeOpacity="0.12" />
        <circle cx={centerX} cy={centerY} r={radius + 2} fill="none" stroke="var(--spark-shockwave-4)" strokeWidth="2" strokeOpacity="0.12" />
      </g>
    </svg>}
  </div>
}
