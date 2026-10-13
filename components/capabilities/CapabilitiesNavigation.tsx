'use client'

import React from 'react'
import {
  Compass,
  Wrench,
  Bot,
  UserCheck,
  Building2,
  Sparkles,
} from 'lucide-react'
import type { CapabilityTab } from './types'

interface CapabilitiesNavigationProps {
  activeTab: CapabilityTab
  onTabChange: (tab: CapabilityTab) => void
  isZh: boolean
}

export function CapabilitiesNavigation({
  activeTab,
  onTabChange,
  isZh,
}: CapabilitiesNavigationProps) {
  const tabs = [
    {
      id: 'discovery' as CapabilityTab,
      label: isZh ? '主页' : 'Discovery',
      icon: Compass,
      desc: isZh ? '发现与检索' : 'Search & Match',
    },
    {
      id: 'plugins' as CapabilityTab,
      label: isZh ? '插件' : 'Plugins',
      icon: Wrench,
      desc: isZh ? '工具与连接器' : 'Tools',
    },
    {
      id: 'agents' as CapabilityTab,
      label: 'Agent',
      icon: Bot,
      desc: isZh ? '智能体' : 'Workers',
    },
    {
      id: 'people' as CapabilityTab,
      label: isZh ? '个人' : 'People',
      icon: UserCheck,
      desc: isZh ? '专业人士' : 'Experts',
    },
    {
      id: 'organizations' as CapabilityTab,
      label: isZh ? '组织' : 'Organizations',
      icon: Building2,
      desc: isZh ? '团队与机构' : 'Agencies',
    },
  ]

  return (
    <div className="w-full bg-[var(--surface)] border-b border-[var(--border)] sticky top-0 z-30 shadow-3xs">
      <div className="max-w-6xl mx-auto px-4">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between overflow-x-auto scrollbar-none py-1">
          <div className="flex items-center gap-1 sm:gap-2">
            {tabs.map((tab) => {
              const active = activeTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  id={`tab-nav-${tab.id}`}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`h-11 px-3 sm:px-4 flex items-center gap-2 border-b-2 text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                    active
                      ? 'border-[var(--primary)] text-[var(--primary)]'
                      : 'border-transparent text-[var(--lavender)] hover:text-[var(--ink)] hover:border-[var(--border)]'
                  }`}
                >
                  <Icon size={15} className={active ? 'text-[var(--primary)]' : 'text-[var(--lavender)]'} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-[var(--lavender)]">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--surface-muted)] text-[var(--ink)] font-medium text-[11px]">
              <Sparkles size={11} className="text-[var(--primary)]" />
              <span>{isZh ? '能力与网络生态' : 'Capabilities & Network'}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
