'use client'

import {
  createContext,
  useContext,
  type ComponentPropsWithoutRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import Image, { type ImageProps } from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrganicCardContextValue {
  backgroundColor: string
}

const OrganicCardContext = createContext<OrganicCardContextValue | null>(null)

function useOrganicCardContext() {
  const context = useContext(OrganicCardContext)
  if (!context) throw new Error('OrganicCard components must be used inside OrganicCard.')
  return context
}

interface OrganicCardSharedProps {
  children: ReactNode
  backgroundColor?: string
  className?: string
}

type OrganicCardWithHrefProps = OrganicCardSharedProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, 'children' | 'href' | 'className'> & {
    href: ComponentPropsWithoutRef<typeof Link>['href']
  }

type OrganicCardWithoutHrefProps = OrganicCardSharedProps &
  Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    href?: never
  }

export type OrganicCardProps = OrganicCardWithHrefProps | OrganicCardWithoutHrefProps

type OrganicCardHrefPropsRest = Omit<OrganicCardWithHrefProps, 'children' | 'backgroundColor' | 'className'>
type OrganicCardDivPropsRest = Omit<OrganicCardWithoutHrefProps, 'children' | 'backgroundColor' | 'className'>

export function OrganicCard({
  children,
  backgroundColor = 'var(--surface)',
  className,
  ...props
}: OrganicCardProps) {
  const sharedClassName = 'group/calloutCard group/organic-card relative flex h-full w-full max-w-full flex-col overflow-hidden rounded-[var(--radius-card)]'

  if ('href' in props && props.href !== undefined) {
    const { href, ...linkProps } = props as OrganicCardHrefPropsRest
    return <OrganicCardContext.Provider value={{ backgroundColor }}>
      <Link {...linkProps} className={cn(sharedClassName, className)} data-slot="organic-card" href={href}>
        {children}
      </Link>
    </OrganicCardContext.Provider>
  }

  return <OrganicCardContext.Provider value={{ backgroundColor }}>
    <div {...(props as OrganicCardDivPropsRest)} className={cn(sharedClassName, className)} data-slot="organic-card">
      {children}
    </div>
  </OrganicCardContext.Provider>
}

export type OrganicCardBodyProps = ComponentPropsWithoutRef<'div'>

export function OrganicCardBody({ className, style, ...props }: OrganicCardBodyProps) {
  const { backgroundColor } = useOrganicCardContext()
  return <div
    {...props}
    className={cn('flex w-full flex-1 flex-col justify-between rounded-t-[var(--radius-card)] p-4 text-[var(--text-primary)]', className)}
    data-slot="organic-card-body"
    style={{ backgroundColor, ...style }}
  />
}

export type OrganicCardImageProps = Omit<ImageProps, 'src' | 'alt'> & {
  src: ImageProps['src']
  alt?: string
}

export function OrganicCardImage({
  alt = '',
  className,
  height = 208,
  width = 670,
  ...props
}: OrganicCardImageProps) {
  return <Image
    {...props}
    alt={alt}
    className={cn('mb-5 h-[138px] w-full rounded-[var(--radius-control)] object-cover sm:h-[168px]', className)}
    data-slot="organic-card-image"
    height={height}
    width={width}
  />
}

export type OrganicCardEyebrowProps = ComponentPropsWithoutRef<'p'>

export function OrganicCardEyebrow({ className, ...props }: OrganicCardEyebrowProps) {
  return <p {...props} className={cn('mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]', className)} data-slot="organic-card-eyebrow" />
}

export type OrganicCardTitleProps = ComponentPropsWithoutRef<'h3'>

export function OrganicCardTitle({ className, ...props }: OrganicCardTitleProps) {
  return <h3 {...props} className={cn('mb-2 text-xl font-medium text-[var(--text-primary)]', className)} data-slot="organic-card-title" />
}

export type OrganicCardDescriptionProps = ComponentPropsWithoutRef<'p'>

export function OrganicCardDescription({ className, ...props }: OrganicCardDescriptionProps) {
  return <p {...props} className={cn('text-base leading-relaxed text-[var(--text-secondary)]', className)} data-slot="organic-card-description" />
}

export type OrganicCardBandProps = ComponentPropsWithoutRef<'svg'>

export function OrganicCardBand({ className, ...props }: OrganicCardBandProps) {
  const { backgroundColor } = useOrganicCardContext()
  return <svg
    {...props}
    className={cn('-mt-px -mr-px h-auto w-full', className)}
    data-slot="organic-card-band"
    aria-hidden={props['aria-hidden'] ?? true}
    focusable="false"
    preserveAspectRatio="none"
    viewBox="0 0 670 111"
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>文件卡片底边</title>
    <path
      className="w-full transition-[d] duration-300 ease-in-out group-hover/calloutCard:[d:path('M670_0H0V91C0_102.046_8.9543_111_20_111H470C477.575_111_484.499_106.721_487.888_99.9469L522.347_31.0531C525.736_24.2789_532.66_20_540.234_20H650C661.046_20_670_11.0457_670_0Z')]"
      d="M670 0H0V91C0 102.046 8.9543 111 20 111H518.641C526.216 111 533.14 106.721 536.529 99.9469L570.988 31.0531C574.377 24.2789 581.301 20 588.875 20H650C661.046 20 670 11.0457 670 0Z"
      fill={backgroundColor}
    />
  </svg>
}

export type OrganicCardFooterProps = ComponentPropsWithoutRef<'div'>

export function OrganicCardFooter({ className, ...props }: OrganicCardFooterProps) {
  return <div {...props} className={cn('absolute bottom-2 flex w-full items-center justify-between pl-4 pr-2', className)} data-slot="organic-card-footer" />
}

export type OrganicCardFooterLabelProps = ComponentPropsWithoutRef<'p'>

export function OrganicCardFooterLabel({ children = 'Read more', className, ...props }: OrganicCardFooterLabelProps) {
  return <p {...props} className={cn('text-base font-medium text-[var(--text-primary)]', className)} data-slot="organic-card-footer-label">{children}</p>
}

export type OrganicCardFooterIconProps = ComponentPropsWithoutRef<'div'>

export function OrganicCardFooterIcon({ children, className, ...props }: OrganicCardFooterIconProps) {
  return <div
    {...props}
    className={cn('flex size-5 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--surface)] transition-transform duration-300 group-hover/organic-card:scale-110', className)}
    data-slot="organic-card-footer-icon"
    aria-hidden={props['aria-hidden'] ?? true}
  >
    {children ?? <ArrowRight className="size-4" />}
  </div>
}
