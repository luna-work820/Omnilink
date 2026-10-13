'use client'

import React, { useState } from 'react'
import {
  Search,
  Check,
  Plus,
  Zap,
  Trash2,
} from 'lucide-react'
import { INITIAL_AGENTS } from './mockData'

interface AgentsPageProps {
  addedAgentIds: Set<string>
  onToggleAddAgent: (agentId: string) => void
  isZh: boolean
}

const CATEGORIES_ZH = ['全部', '商业', '营销', '销售', '内容', '研究', '运营', '客服', '数据']
const CATEGORIES_EN = ['All', 'Commerce', 'Marketing', 'Sales', 'Content', 'Research', 'Operations', 'Support', 'Data']

export function AgentsPage({
  addedAgentIds,
  onToggleAddAgent,
  isZh,
}: AgentsPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(isZh ? '全部' : 'All')

  const categories = isZh ? CATEGORIES_ZH : CATEGORIES_EN

  const filteredAgents = INITIAL_AGENTS.filter((agent) => {
    const matchesSearch =
      !searchQuery.trim() ||
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.nameZh.includes(searchQuery) ||
      agent.taskType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.taskTypeZh.includes(searchQuery) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.descriptionZh.includes(searchQuery) ||
      agent.canPerformZh.some((cp) => cp.includes(searchQuery))

    const matchesCategory =
      selectedCategory === '全部' ||
      selectedCategory === 'All' ||
      agent.categoryZh === selectedCategory ||
      agent.category === selectedCategory ||
      (selectedCategory === '商业' && agent.categoryZh === '商业') ||
      (selectedCategory === '营销' && agent.categoryZh === '营销') ||
      (selectedCategory === '销售' && agent.categoryZh === '销售') ||
      (selectedCategory === '研究' && agent.categoryZh === '研究') ||
      (selectedCategory === '运营' && agent.categoryZh === '运营') ||
      (selectedCategory === '客服' && agent.categoryZh === '客服') ||
      (selectedCategory === '数据' && (agent.categoryZh === '商业' || agent.categoryZh === '研究'))

    return matchesSearch && matchesCategory
  })

  const installedAgents = INITIAL_AGENTS.filter((a) => addedAgentIds.has(a.id))

  return (
    <div className="w-full max-w-6xl mx-auto py-6 sm:py-8 px-4 space-y-10">
      {/* ============================================================
          1. HEADER & SEARCH
          ============================================================ */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
            <span className="text-[11px] font-bold text-[var(--primary)] uppercase tracking-wider">
              Autonomous Intelligence
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
            {isZh ? 'Agent' : 'Agents'}
          </h1>
          <p className="text-sm text-[var(--lavender)]">
            {isZh
              ? '让 AI 从执行单一步骤，进一步处理完整任务。'
              : 'Empower AI to move beyond single-turn steps to handle end-to-end task execution.'}
          </p>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--lavender)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isZh ? '搜索 Agent...' : 'Search agents...'}
              className="w-full h-10 pl-9 pr-4 bg-[var(--surface)] rounded-[6px] border border-[var(--border)] hover:border-[var(--lavender)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-xs sm:text-sm text-[var(--ink)] focus:outline-none shadow-2xs"
            />
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => {
              const active = selectedCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`h-8 px-3  text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-[var(--primary)] text-[var(--surface)] shadow-xs'
                      : 'bg-[var(--surface)] hover:bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--ink)] hover:text-[var(--ink)]'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ============================================================
          2. FEATURED AGENTS GRID (Distinct Intelligent Worker Card)
          ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAgents.map((agent) => {
          const isAdded = addedAgentIds.has(agent.id)
          return (
            <div
              key={agent.id}
              id={`agent-card-${agent.id}`}
              className="bg-[var(--surface)] rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/70 p-5 flex flex-col justify-between transition-all duration-200 shadow-2xs hover:shadow-xs group relative overflow-hidden"
            >
              {/* Subtle top accent bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1 transition-opacity opacity-0 group-hover:opacity-100"
                style={{ backgroundColor: agent.colorTheme }}
              />

              <div className="space-y-4">
                {/* Header: Dynamic Glowing Avatar, Name, Task Type */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-[6px] flex items-center justify-center text-[var(--surface)] text-xs font-bold shrink-0 relative shadow-sm"
                      style={{ backgroundColor: agent.colorTheme }}
                    >
                      <span>{agent.agentAvatar}</span>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--acid-sage)] ring-2 ring-[var(--surface)]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--ink)] group-hover:text-[var(--primary)] transition-colors">
                        {isZh ? agent.nameZh : agent.name}
                      </h3>
                      <p className="text-[11px] font-medium text-[var(--lavender)]">
                        {isZh ? agent.taskTypeZh : agent.taskType}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold px-2 py-0.5  bg-[var(--surface-muted)] text-[var(--ink)]">
                    {agent.usesCount} {isZh ? '调用' : 'runs'}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-[var(--ink)] leading-relaxed">
                  {isZh ? agent.descriptionZh : agent.description}
                </p>

                {/* What it can perform (可以完成什么) */}
                <div className="p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--surface-muted)] space-y-1.5">
                  <div className="text-[10px] font-bold text-[var(--lavender)] uppercase tracking-wider flex items-center gap-1">
                    <Zap size={11} className="text-[var(--primary)]" />
                    <span>{isZh ? '可以完成什么' : 'Autonomous Capabilities'}</span>
                  </div>
                  <ul className="space-y-1">
                    {(isZh ? agent.canPerformZh : agent.canPerform).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-[11px] text-[var(--ink)]">
                        <span className="text-[var(--primary)] font-bold shrink-0">•</span>
                        <span className="leading-snug">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Footer Meta & Action */}
              <div className="pt-4 mt-4 border-t border-[var(--surface-muted)] flex items-center justify-between">
                <span className="text-[11px] text-[var(--lavender)]">
                  {isZh ? '由' : 'By'} {agent.createdBy}
                </span>

                <button
                  type="button"
                  id={`btn-toggle-agent-${agent.id}`}
                  onClick={() => onToggleAddAgent(agent.id)}
                  className={`h-8 px-3.5  text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isAdded
                      ? 'bg-[var(--surface)] hover:bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--ink)]'
                      : 'bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-[var(--surface)] shadow-xs'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check size={13} className="text-[var(--acid-sage)]" />
                      <span>{isZh ? '已添加' : 'Added'}</span>
                    </>
                  ) : (
                    <>
                      <Plus size={13} />
                      <span>{isZh ? '添加' : 'Add'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ============================================================
          3. BOTTOM SECTION: MY AGENTS
          ============================================================ */}
      <div className="pt-8 border-t border-[var(--border)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--ink)]">
              {isZh ? '我的 Agent 队列' : 'My Active Agents'}
            </h2>
            <p className="text-xs text-[var(--lavender)]">
              {isZh
                ? '已授权并在后台随时待命处理业务的智能 Agent。'
                : 'Agents authorized to monitor and process business workflows on your behalf.'}
            </p>
          </div>
          <span className="px-2.5 py-1  bg-[var(--surface-muted)] text-[var(--primary)] text-xs font-bold">
            {installedAgents.length} {isZh ? '个待命' : 'Standby'}
          </span>
        </div>

        {installedAgents.length === 0 ? (
          <div className="p-8 text-center bg-[var(--surface)] rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--lavender)]">
            {isZh ? '尚未添加任何 Agent。点击上方添加即可启用。' : 'No active agents. Click Add on any agent above to enable.'}
          </div>
        ) : (
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] divide-y divide-[var(--surface-muted)] overflow-hidden shadow-2xs">
            {installedAgents.map((agent) => (
              <div
                key={agent.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--surface-muted)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8  flex items-center justify-center text-[var(--surface)] text-[10px] font-bold shrink-0"
                    style={{ backgroundColor: agent.colorTheme }}
                  >
                    {agent.agentAvatar}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--ink)]">
                      {isZh ? agent.nameZh : agent.name}
                    </h4>
                    <p className="text-[11px] text-[var(--lavender)]">
                      {isZh ? agent.taskTypeZh : agent.taskType} · {isZh ? '由' : 'By'} {agent.createdBy}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--acid-sage)] text-[var(--acid-sage)] text-[10px] font-bold border border-[var(--acid-sage)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--acid-sage)]" />
                    {isZh ? '待命中' : 'Standby'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleAddAgent(agent.id)}
                    className="p-1.5  text-[var(--lavender)] hover:text-[var(--plum)] hover:bg-[var(--plum)] transition-colors cursor-pointer"
                    title={isZh ? '移除 Agent' : 'Remove Agent'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
