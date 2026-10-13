import type { ButtonHTMLAttributes } from 'react'

type UiverseButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export function UiverseButton({ children, className = '', type = 'button', ...props }: UiverseButtonProps) {
  return (
    <button type={type} className={`uiverse ${className}`} {...props}>
      <span className="uiverse-label">{children}</span>
    </button>
  )
}
