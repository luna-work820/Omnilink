'use client'

import React from 'react'

interface CircleActionButtonProps {
  direction?: 'down' | 'up'
  onClick?: () => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

export function CircleActionButton({
  direction = 'down',
  onClick,
  disabled = false,
  className = '',
  ariaLabel,
}: CircleActionButtonProps) {
  const isDown = direction === 'down'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel || (isDown ? '下一步' : '上一步')}
      className={`uiverse-circle-btn ${isDown ? 'next-down' : 'prev-up'} ${className}`}
    >
      {isDown ? (
        /* 双折线向下箭头 (Double Downward Chevron matching user reference) */
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="5 5 12 12 19 5" />
          <polyline points="5 12 12 19 19 12" />
        </svg>
      ) : (
        /* 双折线向上箭头 (Double Upward Chevron) */
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="19 19 12 12 5 19" />
          <polyline points="19 12 12 5 5 12" />
        </svg>
      )}
    </button>
  )
}
