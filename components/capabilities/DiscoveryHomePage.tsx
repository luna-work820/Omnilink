'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'motion/react'
import {
  Sparkles,
  ArrowRight,
  Search,
  X,
  Building2,
  Bot,
  Wrench,
  UserCheck,
} from 'lucide-react'
import {
  ROTATING_PLACEHOLDERS,
  ROTATING_PLACEHOLDERS_EN,
  getCrossCategorySearchRecommendations,
} from './mockData'
import type { CapabilityTab } from './types'

interface DiscoveryHomePageProps {
  onNavigateTab: (tab: CapabilityTab) => void
  onSelectPerson?: (personId: string) => void
  onSelectOrg?: (orgId: string) => void
  onToggleAddPlugin?: (pluginId: string) => void
  onToggleAddAgent?: (agentId: string) => void
  addedPluginIds: Set<string>
  addedAgentIds: Set<string>
  isZh: boolean
}

export function DiscoveryHomePage({
  onNavigateTab,
  onSelectPerson,
  onSelectOrg,
  onToggleAddPlugin,
  onToggleAddAgent,
  addedPluginIds,
  addedAgentIds,
  isZh,
}: DiscoveryHomePageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [isSearchExplicitlyClosed, setIsSearchExplicitlyClosed] = useState(false)

  // Rotating placeholder cycle
  const placeholders = isZh ? ROTATING_PLACEHOLDERS : ROTATING_PLACEHOLDERS_EN
  useEffect(() => {
    if (isTyping || searchQuery.trim()) return
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length)
    }, 3200)
    return () => clearInterval(interval)
  }, [isTyping, searchQuery, placeholders.length])

  // Compute search recommendations derived from query
  const recommendations = useMemo(() => {
    if (!searchQuery.trim()) return null
    return getCrossCategorySearchRecommendations(searchQuery)
  }, [searchQuery])

  const showSearchResults = Boolean(recommendations && !isSearchExplicitlyClosed)

  const handleApplyPresetQuery = (query: string) => {
    setSearchQuery(query)
    setIsSearchExplicitlyClosed(false)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setIsSearchExplicitlyClosed(false)
  }

  return (
    <div className="w-full max-w-5xl mx-auto py-8 sm:py-12 md:py-16 px-4 space-y-16">
      {/* ============================================================
          1. CENTRAL SEARCH HUB (大面积留白中央核心)
          ============================================================ */}
      <section className="flex flex-col items-center justify-center text-center space-y-7 max-w-3xl mx-auto">
        {/* Main Title & Subtitle */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
            {isZh ? '你想要什么服务？' : 'What service are you looking for?'}
          </h1>
          <p className="text-sm sm:text-base text-[var(--lavender)] font-normal">
            {isZh
              ? '搜索能力、Agent、个人或组织'
              : 'Search capabilities, agents, people, or organizations'}
          </p>
        </div>

        {/* Minimalist AI Search Box */}
        <div className="w-full relative">
          <div className="relative flex items-center w-full bg-[var(--surface)] rounded-xl border border-[var(--border)] hover:border-[var(--lavender)] focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/15 transition-all shadow-[0_2px_12px_var(--ink)]">
            <Search size={18} className="text-[var(--lavender)] ml-4 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsTyping(true)}
              onBlur={() => setIsTyping(false)}
              placeholder={placeholders[placeholderIndex]}
              className="w-full h-13 pl-3 pr-20 bg-transparent text-sm sm:text-base text-[var(--ink)] placeholder:text-[var(--lavender)] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-16 p-1 text-[var(--lavender)] hover:text-[var(--ink)] cursor-pointer"
                title="清空"
              >
                <X size={16} />
              </button>
            )}
            {/* Search Right AI Trigger */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <button
                type="button"
                onClick={() => {
                  if (!searchQuery.trim()) {
                    handleApplyPresetQuery(placeholders[placeholderIndex])
                  }
                }}
                className="h-9 px-3.5 rounded-[6px] bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-[var(--surface)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Sparkles size={13} className="text-[var(--surface)]" />
                <span>AI</span>
              </button>
            </div>
          </div>

          {/* Quick preset query pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5">
            <span className="text-[11px] text-[var(--lavender)] mr-1">
              {isZh ? '热门探索：' : 'Suggestions:'}
            </span>
            {placeholders.slice(0, 4).map((query, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPresetQuery(query)}
                className="px-2.5 py-1  bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)] border border-[var(--border)] hover:border-[var(--border)] text-[11px] text-[var(--ink)] hover:text-[var(--ink)] transition-all cursor-pointer"
              >
                {query}
              </button>
            ))}
          </div>
        </div>

        {/* ============================================================
            CROSS-CATEGORY SEARCH RESULTS (跨品类综合推荐)
            ============================================================ */}
        <AnimatePresence>
          {showSearchResults && recommendations && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full text-left bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-lg p-5 mt-4 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--surface-muted)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                  <h3 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
                    {isZh ? '综合能力匹配结果' : 'Cross-Category Match Results'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-xs text-[var(--lavender)] hover:text-[var(--ink)] cursor-pointer"
                >
                  {isZh ? '收起' : 'Close'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* 1. Recommended People */}
                {recommendations.people.length > 0 && (
                  <div className="p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[var(--lavender)]">
                      <span className="flex items-center gap-1.5 text-[var(--primary)]">
                        <UserCheck size={13} />
                        <span>{isZh ? '专业个人 · People' : 'People'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('people')}
                        className="text-[var(--primary)] hover:underline cursor-pointer"
                      >
                        {isZh ? '更多个人' : 'More'} →
                      </button>
                    </div>
                    {recommendations.people.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => onSelectPerson && onSelectPerson(p.id)}
                        className="flex items-center justify-between gap-3 p-2 bg-[var(--surface)] rounded-[6px] border border-[var(--border)] hover:border-[var(--primary)] transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Image
                            src={p.avatar}
                            alt={p.name}
                            width={32}
                            height={32}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover border border-[var(--border)] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[var(--ink)] group-hover:text-[var(--primary)] truncate">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-[var(--lavender)] truncate">
                              {isZh ? p.roleZh : p.role} · {isZh ? p.locationZh : p.location}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-[var(--primary)] group-hover:translate-x-0.5 transition-transform shrink-0">
                          {isZh ? '查看' : 'View'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. Recommended Organization */}
                {recommendations.organizations.length > 0 && (
                  <div className="p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[var(--lavender)]">
                      <span className="flex items-center gap-1.5 text-[var(--primary)]">
                        <Building2 size={13} />
                        <span>{isZh ? '承接组织 · Organization' : 'Organization'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('organizations')}
                        className="text-[var(--primary)] hover:underline cursor-pointer"
                      >
                        {isZh ? '更多组织' : 'More'} →
                      </button>
                    </div>
                    {recommendations.organizations.map((org) => (
                      <div
                        key={org.id}
                        onClick={() => onSelectOrg && onSelectOrg(org.id)}
                        className="flex items-center justify-between gap-3 p-2 bg-[var(--surface)] rounded-[6px] border border-[var(--border)] hover:border-[var(--primary)] transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8  bg-[var(--surface-muted)] text-[var(--surface)] text-[10px] font-bold flex items-center justify-center shrink-0">
                            {org.logo}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[var(--ink)] group-hover:text-[var(--primary)] truncate">
                              {org.name}
                            </div>
                            <div className="text-[10px] text-[var(--lavender)] truncate">
                              {isZh ? org.typeZh : org.type} · {isZh ? org.serviceScopeZh : org.serviceScope}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-[var(--primary)] group-hover:translate-x-0.5 transition-transform shrink-0">
                          {isZh ? '合作' : 'Partner'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. Recommended Agent */}
                {recommendations.agents.length > 0 && (
                  <div className="p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[var(--lavender)]">
                      <span className="flex items-center gap-1.5 text-[var(--primary)]">
                        <Bot size={13} />
                        <span>{isZh ? '执行智能体 · Agent' : 'Agent'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('agents')}
                        className="text-[var(--primary)] hover:underline cursor-pointer"
                      >
                        {isZh ? '更多 Agent' : 'More'} →
                      </button>
                    </div>
                    {recommendations.agents.map((agent) => {
                      const isAdded = addedAgentIds.has(agent.id)
                      return (
                        <div
                          key={agent.id}
                          className="flex items-center justify-between gap-3 p-2 bg-[var(--surface)] rounded-[6px] border border-[var(--border)] hover:border-[var(--primary)] transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-8 h-8  flex items-center justify-center text-[var(--surface)] text-[10px] font-bold shrink-0"
                              style={{ backgroundColor: agent.colorTheme }}
                            >
                              {agent.agentAvatar}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[var(--ink)] truncate">
                                {isZh ? agent.nameZh : agent.name}
                              </div>
                              <div className="text-[10px] text-[var(--lavender)] truncate">
                                {isZh ? agent.taskTypeZh : agent.taskType}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onToggleAddAgent && onToggleAddAgent(agent.id)}
                            className={`px-2.5 py-1  text-[11px] font-bold cursor-pointer transition-colors shrink-0 ${
                              isAdded
                                ? 'bg-[var(--surface-muted)] text-[var(--ink)] border border-[var(--border)]'
                                : 'bg-[var(--primary)] hover:bg-[var(--primary)] text-[var(--surface)]'
                            }`}
                          >
                            {isAdded ? (isZh ? '已添加' : 'Added') : isZh ? '添加' : 'Add'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 4. Recommended Plugin */}
                {recommendations.plugins.length > 0 && (
                  <div className="p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[var(--lavender)]">
                      <span className="flex items-center gap-1.5 text-[var(--primary)]">
                        <Wrench size={13} />
                        <span>{isZh ? '实用插件 · Plugin' : 'Plugin'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('plugins')}
                        className="text-[var(--primary)] hover:underline cursor-pointer"
                      >
                        {isZh ? '更多插件' : 'More'} →
                      </button>
                    </div>
                    {recommendations.plugins.map((plugin) => {
                      const isAdded = addedPluginIds.has(plugin.id)
                      return (
                        <div
                          key={plugin.id}
                          className="flex items-center justify-between gap-3 p-2 bg-[var(--surface)] rounded-[6px] border border-[var(--border)] hover:border-[var(--primary)] transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8  bg-[var(--primary)] border border-[var(--primary)] flex items-center justify-center text-[var(--primary)] text-xs font-bold shrink-0">
                              <Wrench size={13} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[var(--ink)] truncate">
                                {isZh ? plugin.nameZh : plugin.name}
                              </div>
                              <div className="text-[10px] text-[var(--lavender)] truncate">
                                {isZh ? plugin.tagsZh.join(' · ') : plugin.tags.join(' · ')}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onToggleAddPlugin && onToggleAddPlugin(plugin.id)}
                            className={`px-2.5 py-1  text-[11px] font-bold cursor-pointer transition-colors shrink-0 ${
                              isAdded
                                ? 'bg-[var(--surface-muted)] text-[var(--ink)] border border-[var(--border)]'
                                : 'bg-[var(--primary)] hover:bg-[var(--primary)] text-[var(--surface)]'
                            }`}
                          >
                            {isAdded ? (isZh ? '已添加' : 'Added') : isZh ? '添加' : 'Add'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ============================================================
          2. FOUR EDITORIAL GATEWAY LAYERS (下方四个能力入口)
          ============================================================ */}
      <section className="space-y-4 pt-4 border-t border-[var(--border)]">
        {/* Layer 1: Plugins */}
        <div
          id="gateway-plugins"
          className="group relative p-6 bg-[var(--surface)] hover:bg-[var(--surface-muted)] rounded-xl border border-[var(--border)] hover:border-[var(--primary)] transition-all duration-200 shadow-2xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[var(--primary)] uppercase tracking-wider">
                  01 · Plugins
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--ink)]">
                {isZh ? '专业工具与连接器' : 'Professional Tools & Connectors'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {['SEO Analyzer', 'Product Translator', 'Analytics Connector', 'Image Optimizer'].map(
                  (ex, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5  bg-[var(--surface-muted)] text-[var(--ink)] text-xs font-medium"
                    >
                      {ex}
                    </span>
                  )
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('plugins')}
              className="h-9 px-4  bg-[var(--surface)] hover:bg-[var(--surface-muted)] border border-[var(--border)] hover:border-[var(--border)] text-xs font-bold text-[var(--ink)] transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>{isZh ? '浏览插件' : 'Browse Plugins'}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Layer 2: Agents */}
        <div
          id="gateway-agents"
          className="group relative p-6 bg-[var(--surface)] hover:bg-[var(--surface-muted)] rounded-xl border border-[var(--border)] hover:border-[var(--primary)] transition-all duration-200 shadow-2xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[var(--primary)] uppercase tracking-wider">
                  02 · Agents
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--ink)]">
                {isZh ? '更复杂的智能能力' : 'Advanced Intelligent Workers'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {['Product Agent', 'Marketing Agent', 'Sales Agent', 'Research Agent'].map(
                  (ex, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5  bg-[var(--surface-muted)] text-[var(--ink)] text-xs font-medium"
                    >
                      {ex}
                    </span>
                  )
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('agents')}
              className="h-9 px-4  bg-[var(--surface)] hover:bg-[var(--surface-muted)] border border-[var(--border)] hover:border-[var(--border)] text-xs font-bold text-[var(--ink)] transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>{isZh ? '浏览 Agent' : 'Explore Agents'}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Layer 3: People */}
        <div
          id="gateway-people"
          className="group relative p-6 bg-[var(--surface)] hover:bg-[var(--surface-muted)] rounded-xl border border-[var(--border)] hover:border-[var(--primary)] transition-all duration-200 shadow-2xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[var(--primary)] uppercase tracking-wider">
                  03 · People
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--ink)]">
                {isZh ? '找到拥有专业能力的人' : 'Find People with Proven Expertise'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {['Photographer', 'Designer', 'Marketer', 'Developer'].map((ex, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5  bg-[var(--surface-muted)] text-[var(--ink)] text-xs font-medium"
                  >
                    {ex}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('people')}
              className="h-9 px-4  bg-[var(--surface)] hover:bg-[var(--surface-muted)] border border-[var(--border)] hover:border-[var(--border)] text-xs font-bold text-[var(--ink)] transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>{isZh ? '发现个人' : 'Discover People'}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Layer 4: Organizations */}
        <div
          id="gateway-organizations"
          className="group relative p-6 bg-[var(--surface)] hover:bg-[var(--surface-muted)] rounded-xl border border-[var(--border)] hover:border-[var(--primary)] transition-all duration-200 shadow-2xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[var(--primary)] uppercase tracking-wider">
                  04 · Organizations
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--ink)]">
                {isZh ? '找到可以承接完整需求的团队' : 'Find Teams & Companies for Complete Needs'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {['Creative Studio', 'Marketing Agency', 'Logistics Company', 'Development Team'].map(
                  (ex, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5  bg-[var(--surface-muted)] text-[var(--ink)] text-xs font-medium"
                    >
                      {ex}
                    </span>
                  )
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('organizations')}
              className="h-9 px-4  bg-[var(--surface)] hover:bg-[var(--surface-muted)] border border-[var(--border)] hover:border-[var(--border)] text-xs font-bold text-[var(--ink)] transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>{isZh ? '发现组织' : 'Discover Organizations'}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
