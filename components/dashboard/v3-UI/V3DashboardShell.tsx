'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { observeGlassworkSurfaces } from '@/components/ui/glasswork/integrate'
import { usePathname } from 'next/navigation'
import { BookOpen, Home, LayoutGrid, PanelsTopLeft, Settings, User, PenLine, ShoppingBag, Clapperboard } from 'lucide-react'
import ProfileDropdown from '@/components/kokonutui/profile-dropdown'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/app/actions/auth'
import type { Profile } from '@/components/dashboard/OmnilinkLayout'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'

import type { WorkspaceCapabilities } from '@/lib/workspace/capabilities'

const merchantNavItems = [
  { group: '商家中心', href: '/dashboard/storefront', label: '网站设计', icon: PanelsTopLeft, active: (path: string) => path.startsWith('/dashboard/storefront') },
  { group: '商家中心', href: '/dashboard/products', label: '商品', icon: LayoutGrid, active: (path: string) => path.startsWith('/dashboard/products') },
  { group: '商家中心', href: '/dashboard/knowledge', label: '知识库', icon: BookOpen, active: (path: string) => path.startsWith('/dashboard/knowledge') },
] as const

const creatorNavItems = [
  { group: '创作者中心', href: '/dashboard/content', label: '作品发布', icon: PenLine, active: (path: string) => path === '/dashboard/content' },
  { group: '创作者中心', href: '/dashboard/content/manage', label: '内容管理', icon: Clapperboard, active: (path: string) => path.startsWith('/dashboard/content/manage') },
] as const

export function V3DashboardShell({ children, profile, capabilities, demo = false,activePath }: {
  children: React.ReactNode
  profile: Profile
  capabilities: WorkspaceCapabilities
  demo?: boolean
  activePath?: string
}) {
  const glassRoot = useRef<HTMLDivElement>(null)
  const currentPath = usePathname()
  const pathname = activePath??currentPath
  const workbenchPage = pathname === '/dashboard'
  useEffect(() => {
    if (!glassRoot.current) return
    return observeGlassworkSurfaces(workbenchPage ? document.body : glassRoot.current)
  }, [workbenchPage])
  const creatorArea = capabilities.creator && pathname.startsWith('/dashboard/content')
  const navigationCapabilities = creatorArea ? { ...capabilities, merchant: false } : capabilities
  const creatorOnlyNavigation = navigationCapabilities.creator && !navigationCapabilities.merchant
  const creatorPreview = demo && capabilities.creator && !capabilities.merchant
  const homeHref = creatorPreview ? '/creator?preview=1&view=content' : creatorOnlyNavigation ? '/dashboard/content' : '/dashboard'
  const navItems = [
    ...(!creatorOnlyNavigation ? [{ group: navigationCapabilities.merchant && !navigationCapabilities.creator ? '商家中心' : '工作台', href: '/dashboard', label: '工作台', icon: Home, active: (path: string) => path === '/dashboard' }] : []),
    ...(navigationCapabilities.creator ? creatorNavItems.map((item) => ({ ...item, href: creatorPreview ? `/creator?preview=1&view=${item.href.endsWith('/manage') ? 'manage' : 'content'}` : item.href })) : []),
    ...(navigationCapabilities.merchant ? merchantNavItems : []),
  ]
  const accountName = profile.name || profile.email || '商家'
  const signOut = () => logoutAction(new FormData())
  return (
    <SidebarProvider>
    <div ref={glassRoot} className={`workspace-glass-shell relative isolate flex h-screen w-screen overflow-hidden bg-[var(--canvas)] text-[var(--text-primary)] ${workbenchPage ? 'workspace-glass-shell--workbench' : ''}`}>
      <div className="dashboard-shell relative z-10 flex h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-[var(--canvas)]">
        <Sidebar aria-label="主导航" data-glasswork="" data-glasswork-radius="24" data-glasswork-rim="12" data-glasswork-dispersion="0.18" data-glasswork-tint={workbenchPage ? '1.15' : undefined} className="workspace-glass-sidebar" >
          <SidebarHeader className="justify-between">
            <SidebarBrand href={homeHref} />
            <SidebarTrigger />
          </SidebarHeader>
          <SidebarContent>
            <nav aria-label="主导航">
              {Array.from(new Set(navItems.map((item) => item.group))).map((group) => (
                <SidebarGroup key={group}>
                  <SidebarGroupLabel>{group}</SidebarGroupLabel>
                  <SidebarMenu>
                    {navItems.filter((item) => item.group === group).map((item) => {
                      const Icon = item.icon
                      const selected = item.active(pathname)
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={selected} className={workbenchPage ? 'workbench-nav-pill' : undefined}>
                            <Link href={item.href} aria-label={item.label} aria-current={selected ? 'page' : undefined} title={item.label}>
                              <Icon aria-hidden="true" />
                              <span data-sidebar-label="" className="truncate">{item.label}</span>
                              {selected && <span aria-hidden="true" className="ml-auto size-1.5 shrink-0 rounded-full bg-[var(--brand-primary)]" />}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroup>
              ))}
            </nav>
          </SidebarContent>
          <SidebarFooter>
            <SidebarAccount
              profile={profile}
              accountName={accountName}
              onSignOut={signOut}
              capabilities={capabilities}
              allowActivation={!demo}
              workbenchPage={workbenchPage}
            />
          </SidebarFooter>
        </Sidebar>
      <SidebarInset className="min-h-0">
          <nav data-glasswork="" data-glasswork-radius="24" data-glasswork-rim="12" data-glasswork-dispersion="0.18" className="workspace-glass-mobile-nav relative m-2 flex shrink-0 gap-1 overflow-x-auto rounded-3xl p-2 md:hidden" aria-label="移动端主导航">
          {navItems.map((item) => { const Icon = item.icon; const selected = item.active(pathname); return <Link key={item.href} href={item.href} aria-current={selected ? 'page' : undefined} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2 ${selected ? 'bg-[var(--surface-raised)] text-[var(--ink)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'}`}><Icon className="h-4 w-4" aria-hidden="true" />{item.label}</Link> })}
        </nav>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </SidebarInset>
      </div>
    </div>
    </SidebarProvider>
  )
}

function SidebarBrand({ href }: { href: string }) {
  const { state } = useSidebar()
  return (
    <Link
      href={href}
      aria-label="Omnilink"
      className={`flex min-w-0 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--sidebar-ring)] focus-visible:outline-offset-2 ${state === 'expanded' ? '' : 'h-24'}`}
    >
      <span className={`whitespace-nowrap text-[13px] font-semibold tracking-[-0.03em] ${state === 'expanded' ? '' : 'rotate-90'}`}>OMNILINK</span>
    </Link>
  )
}

function SidebarAccount({
  profile,
  accountName,
  onSignOut,
  capabilities,
  allowActivation,
  workbenchPage,
}: {
  profile: Profile
  accountName: string
  onSignOut: () => void
  capabilities: WorkspaceCapabilities
  allowActivation: boolean
  workbenchPage: boolean
}) {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'
  return (
    <ProfileDropdown
      accounts={[{ id: profile.id, name: accountName, email: profile.email }]}
      className={cn('w-full', workbenchPage && 'workbench-profile-dropdown')}
      defaultStatus="online"
      items={[
        ...(allowActivation && !capabilities.creator ? [{ label: '成为内容创作者', icon: <PenLine className="size-4" />, href: '/creator',external:true }] : []),
        ...(allowActivation && !capabilities.merchant ? [{ label: '成为商家', icon: <ShoppingBag className="size-4" />, href: '/merchant',external:true }] : []),
        { label: '个人资料', icon: <User className="size-4" />, href: '/dashboard/account' },
        { label: '设置', icon: <Settings className="size-4" />, value: '⌘,', href: '/dashboard/settings' },
      ]}
      onSignOut={onSignOut}
      placement="top-start"
      showAvatar={collapsed}
      showTheme={false}
      glassPanel={workbenchPage}
      triggerClassName={cn(
        'w-full rounded-[var(--radius-control)] border-[var(--sidebar-border)] bg-[var(--sidebar)] p-2 text-[var(--text-secondary)] hover:border-[var(--sidebar-ring)] hover:bg-[var(--interactive-hover)] focus-visible:ring-[var(--sidebar-ring)] focus-visible:ring-offset-[var(--sidebar)]',
        workbenchPage && 'workbench-profile-pill',
        collapsed && 'size-10 justify-center border-transparent p-1 [&>span>span>span:last-child]:sr-only [&>svg]:hidden',
      )}
    />
  )
}
