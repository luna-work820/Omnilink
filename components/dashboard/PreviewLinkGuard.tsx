'use client'

import type { ReactNode, MouseEvent } from 'react'

export function PreviewLinkGuard({ children }: { children: ReactNode }) {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const link = target.closest('a')
    const href = link?.getAttribute('href')

    if (href?.startsWith('/dashboard')) {
      event.preventDefault()
    }
  }

  return <div onClickCapture={handleClick}>{children}</div>
}
