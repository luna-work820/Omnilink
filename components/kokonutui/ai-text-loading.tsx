'use client'

import { motion, MotionConfig } from 'motion/react'

/** Adapted from KokonutUI AI Text Loading, MIT. */
export default function AITextLoading() {
  const text = '正在思考'

  return (
    <output aria-live="polite" className="inline-flex items-baseline text-sm font-medium text-[var(--brand-primary)]">
      <span className="sr-only">正在思考</span>
      <MotionConfig reducedMotion="user">
        <span aria-hidden="true" className="inline-flex">
          {Array.from(text).map((character, index) => (
            <motion.span key={index} className="inline-block ai-text-loading-letter" style={{ animationDelay: `${index * 0.07}s` }}>
              {character}
            </motion.span>
          ))}
        </span>
      </MotionConfig>
      <style>{`
        @keyframes ai-text-loading-wave { 50% { opacity: 0.3; } }
        .ai-text-loading-letter { animation: ai-text-loading-wave 1.6s ease-in-out infinite both; }
        @media (prefers-reduced-motion: reduce) { .ai-text-loading-letter { animation: none; } }
      `}</style>
    </output>
  )
}
