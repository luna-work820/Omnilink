"use client"

import * as React from "react"
import { PanelLeft, PanelLeftClose } from "lucide-react"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

type SidebarContextValue = {
  open: boolean
  state: "expanded" | "collapsed"
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) throw new Error("Sidebar components must be used inside SidebarProvider")
  return context
}

function SidebarProvider({
  children,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
}: React.PropsWithChildren<{
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}>) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const open = openProp ?? internalOpen
  const state = open ? "expanded" : "collapsed"

  const setOpen = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (next) => {
      const value = typeof next === "function" ? next(open) : next
      if (openProp === undefined) setInternalOpen(value)
      onOpenChange?.(value)
    },
    [onOpenChange, open, openProp],
  )
  const toggleSidebar = React.useCallback(() => setOpen((current) => !current), [setOpen])

  React.useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target
      const isEditing =
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b" && !isEditing) {
        event.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [toggleSidebar])

  return (
    <SidebarContext.Provider value={{ open, state, setOpen, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  )
}

function Sidebar({
  className,
  children,
  ...props
}: React.ComponentProps<"aside">) {
  const { state } = useSidebar()
  return (
    <aside
      data-slot="sidebar"
      data-state={state}
      data-collapsible={state === "collapsed" ? "icon" : undefined}
      className={cn(
        "group/sidebar hidden h-full min-h-0 shrink-0 select-none flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex",
        state === "expanded" ? "w-56" : "w-16",
        className,
      )}
      {...props}
    >
      {children}
    </aside>
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  const { state } = useSidebar()
  return <div data-slot="sidebar-header" className={cn("flex gap-2 px-2 py-2", state === "expanded" ? "min-h-14 items-center justify-between" : "min-h-16 flex-col items-center justify-center", className)} {...props} />
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-content" className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3", className)} {...props} />
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-footer" className={cn("mt-auto p-2", className)} {...props} />
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"section">) {
  return <section data-slot="sidebar-group" className={cn("mb-5 min-w-0", className)} {...props} />
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) {
  const { state } = useSidebar()
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        "mb-1 px-3 py-1 text-[10px] font-semibold text-[var(--text-muted)] transition-opacity",
        state === "collapsed" && "sr-only",
        className,
      )}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu" className={cn("m-0 flex min-w-0 list-none flex-col gap-1 p-0", className)} {...props} />
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-item" className={cn("group/menu-item relative min-w-0", className)} {...props} />
}

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  className,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean; isActive?: boolean }) {
  const { state } = useSidebar()
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="sidebar-menu-button"
      data-active={isActive}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-[var(--radius-control)] px-3 text-left text-xs font-medium text-[var(--text-secondary)] outline-none transition-colors hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--sidebar-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sidebar)] [&_svg]:size-4 [&_svg]:shrink-0",
        isActive && "bg-[var(--sidebar-accent)] font-semibold text-[var(--sidebar-accent-foreground)]",
        state === "collapsed" && "justify-center px-0 [&>[data-sidebar-label]]:hidden",
        className,
      )}
      {...props}
    />
  )
}

function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<"button">) {
  const { state, toggleSidebar } = useSidebar()
  const Icon = state === "expanded" ? PanelLeftClose : PanelLeft
  return (
    <button
      type="button"
      data-slot="sidebar-trigger"
      aria-label={state === "expanded" ? "收起侧边栏" : "展开侧边栏"}
      aria-expanded={state === "expanded"}
      title={`${state === "expanded" ? "收起" : "展开"}侧边栏（⌘/Ctrl+B）`}
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] outline-none transition-colors hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--sidebar-ring)] focus-visible:ring-offset-2", className)}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) toggleSidebar()
      }}
      {...props}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-inset" className={cn("main-workspace flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--canvas)]", className)} {...props} />
}

export {
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
}
