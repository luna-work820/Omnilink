'use client'

import React, { useState } from 'react'
import {
  Search,
  Plus,
  Check,
  UploadCloud,
  Scale,
  Crosshair,
  Sparkles,
  ShoppingBag,
  Truck,
  ShieldCheck,
  TrendingUp,
  Bot,
  Layers,
  Calendar,
  FileSearch,
  Lock,
  X,
} from 'lucide-react'
import { AI_SKILLS_LIBRARY, type AiSkillItem } from './skillsData'

interface SkillMarketplaceModalProps {
  isOpen: boolean
  onClose: () => void
  activeSkillIds: string[]
  onToggleSkill: (skillId: string) => void
  isProUser: boolean
}

export function SkillMarketplaceModal({
  isOpen,
  onClose,
  activeSkillIds,
  onToggleSkill,
  isProUser,
}: SkillMarketplaceModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | 'recommended' | 'industry' | 'community'>('all')
  const [isUploadSkillModalOpen, setIsUploadSkillModalOpen] = useState(false)
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillDesc, setNewSkillDesc] = useState('')
  const [newSkillPrompt, setNewSkillPrompt] = useState('')

  if (!isOpen) return null

  const filteredSkills = AI_SKILLS_LIBRARY.filter((skill) => {
    const matchesSearch =
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.author.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === 'all' || skill.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const recommendedSkills = filteredSkills.filter((s) => s.category === 'recommended')
  const industrySkills = filteredSkills.filter((s) => s.category === 'industry')
  const communitySkills = filteredSkills.filter((s) => s.category === 'community')

  const handleUploadSkill = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSkillName.trim()) return
    // In demo mode, close after toast
    setIsUploadSkillModalOpen(false)
    setNewSkillName('')
    setNewSkillDesc('')
    setNewSkillPrompt('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Main Glass Modal Window */}
      <div
        id="skill-marketplace-dialog"
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[24px] bg-[var(--surface)]/80 backdrop-blur-[24px] backdrop-saturate-[190%] border border-[var(--surface)]/70 shadow-[0_16px_48px_var(--ink)] z-10 overflow-hidden animate-in fade-in zoom-in-95"
      >
        {/* Top Header */}
        <div className="p-5 border-b border-[var(--border)]/70 bg-[var(--surface)]/50 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-[var(--ink)] text-[var(--surface)] flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles size={18} className="text-[var(--lavender)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--ink)] tracking-tight">
                  技能中心
                </h2>
                <span className="px-2 py-0.5 rounded-[6px] bg-[var(--lavender)] text-[var(--lavender)] text-[10px] font-bold border border-[var(--lavender)]">
                  AI 技能生态
                </span>
                {activeSkillIds.length > 0 && (
                  <span className="px-2 py-0.5 rounded-[6px] bg-[var(--surface-muted)] text-[var(--lavender)] text-[10px] font-semibold">
                    当前已挂载 {activeSkillIds.length} 个技能
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--lavender)] mt-0.5">
                所有用户均可挂载本地技能资源。开源项目仅保存为本地归档参考，不连接 GitHub、不自动同步仓库或归档文件。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              id="upload-skill-btn"
              onClick={() => setIsUploadSkillModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--surface)] hover:bg-[var(--surface-muted)] border border-[var(--border)] text-xs font-bold text-[var(--ink)] transition-all cursor-pointer shadow-2xs"
            >
              <UploadCloud size={13} className="text-[var(--lavender)]" />
              <span>上传技能</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)] text-[var(--lavender)] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="px-5 py-3 border-b border-[var(--border)]/60 bg-[var(--surface)]/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 p-0.5 rounded-[10px] bg-[var(--surface-muted)]/80 border border-[var(--border)]/60">
            {[
              { key: 'all', label: '全部技能' },
              { key: 'recommended', label: '推荐技能' },
              { key: 'industry', label: '行业技能' },
              { key: 'community', label: '社区技能' },
            ].map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key as any)}
                className={`px-3 py-1 rounded-[8px] text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === cat.key
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs font-bold'
                    : 'text-[var(--lavender)] hover:text-[var(--ink)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-60">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--lavender)]" />
            <input
              type="text"
              placeholder="搜索技能名称或描述…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] placeholder:text-[var(--lavender)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
            />
          </div>
        </div>

        {/* Skill Cards Grid Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scroll">
          {/* Recommended Skills */}
          {(activeCategory === 'all' || activeCategory === 'recommended') && recommendedSkills.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-3.5 rounded-full bg-[var(--lavender)]" />
                <h3 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wide">
                  推荐技能 (Official Recommended)
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {recommendedSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    isActive={activeSkillIds.includes(skill.id)}
                    onToggle={() => onToggleSkill(skill.id)}
                    isProUser={isProUser}
                    hasOtherActive={activeSkillIds.length > 0 && !activeSkillIds.includes(skill.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Industry Skills */}
          {(activeCategory === 'all' || activeCategory === 'industry') && industrySkills.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-3.5 rounded-full bg-[var(--primary)]" />
                <h3 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wide">
                  行业技能 (Industry Specialized)
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {industrySkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    isActive={activeSkillIds.includes(skill.id)}
                    onToggle={() => onToggleSkill(skill.id)}
                    isProUser={isProUser}
                    hasOtherActive={activeSkillIds.length > 0 && !activeSkillIds.includes(skill.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Community Skills */}
          {(activeCategory === 'all' || activeCategory === 'community') && communitySkills.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-3.5 rounded-full bg-[var(--acid-sage)]" />
                <h3 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wide">
                  社区技能 (Community Ecosystem)
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {communitySkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    isActive={activeSkillIds.includes(skill.id)}
                    onToggle={() => onToggleSkill(skill.id)}
                    isProUser={isProUser}
                    hasOtherActive={activeSkillIds.length > 0 && !activeSkillIds.includes(skill.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredSkills.length === 0 && (
            <div className="py-12 text-center text-xs text-[var(--lavender)]">
              未检索到符合条件的技能，请调整搜索词或分类。
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)]/60 bg-[var(--surface)]/60 backdrop-blur-md flex items-center justify-between text-xs text-[var(--lavender)] shrink-0">
          <span>
            普通用户支持单技能挂载；Pro 用户支持多技能组合研报。
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-[8px] bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--surface)] font-bold text-xs shadow-xs cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>

      {/* Upload Custom Skill Modal */}
      {isUploadSkillModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-xs"
            onClick={() => setIsUploadSkillModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-[var(--surface)] rounded-[24px] p-5 shadow-[0_12px_40px_var(--ink)] border border-[var(--border)] z-10 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <h3 className="text-sm font-bold text-[var(--ink)]">添加本地技能 / 项目归档</h3>
              <button
                onClick={() => setIsUploadSkillModalOpen(false)}
                className="text-[var(--lavender)] hover:text-[var(--lavender)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSkill} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">资源类型</label>
                  <select
                    defaultValue="open-source"
                    className="w-full h-8 px-2 rounded-[8px] bg-[var(--surface-muted)] border border-[var(--border)] text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  >
                    <option value="open-source">开源项目</option>
                    <option value="skill">自定义技能</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">同步策略</label>
                  <input
                    value="仅本地归档 · 不同步"
                    readOnly
                    aria-label="同步策略"
                    className="w-full h-8 px-2 rounded-[8px] bg-[var(--surface-muted)] border border-[var(--border)] text-xs text-[var(--lavender)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  技能名称
                </label>
                <input
                  type="text"
                  placeholder="例如：TikTok 爆款脚本生成"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  className="w-full h-8 px-3 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  技能描述与作用
                </label>
                <textarea
                  rows={2}
                  placeholder="简述该技能如何分析知识库内容…"
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                  className="w-full p-2.5 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  系统提示词模板 (System Prompt)
                </label>
                <textarea
                  rows={3}
                  placeholder="注入到 AI 研报推理引擎的指令规范…"
                  value={newSkillPrompt}
                  onChange={(e) => setNewSkillPrompt(e.target.value)}
                  className="w-full p-2.5 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)] resize-none font-mono text-[11px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadSkillModalOpen(false)}
                  className="px-3 py-1.5 rounded-[8px] bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)] text-xs font-semibold text-[var(--ink)]"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!newSkillName.trim()}
                  className="px-4 py-1.5 rounded-[8px] bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] disabled:bg-[var(--surface-muted)] text-[var(--surface)] disabled:text-[var(--lavender)] text-xs font-bold shadow-xs cursor-pointer"
                >
                  保存到本地
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function SkillCard({
  skill,
  isActive,
  onToggle,
  isProUser,
  hasOtherActive,
}: {
  skill: AiSkillItem
  isActive: boolean
  onToggle: () => void
  isProUser: boolean
  hasOtherActive: boolean
}) {
  const isMultiLocked = hasOtherActive && !isProUser && !isActive

  return (
    <div
      id={`skill-card-${skill.id}`}
      className={`p-3.5 rounded-[16px] border transition-all flex flex-col justify-between space-y-2.5 ${
        isActive
          ? 'bg-[var(--lavender)]/80 border-[var(--lavender)] shadow-xs'
          : 'bg-[var(--surface)] hover:bg-[var(--surface-muted)]/80 border-[var(--border)]'
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 ${
                isActive ? 'bg-[var(--lavender)] text-[var(--surface)]' : 'bg-[var(--surface-muted)] text-[var(--ink)]'
              }`}
            >
              {renderSkillIcon(skill.icon)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-[var(--ink)]">{skill.name}</h4>
                {skill.badge && (
                  <span className="px-1.5 py-0.2  bg-[var(--lavender)] text-[var(--lavender)] text-[9px] font-bold">
                    {skill.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[var(--lavender)]">{skill.author}</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-[var(--ink)] leading-snug line-clamp-2">
          {skill.description}
        </p>
        {skill.archiveOnly && (
          <div className="flex items-center justify-between gap-2 rounded-[6px] bg-[var(--surface-muted)] px-2 py-1.5 text-[10px] text-[var(--lavender)]">
            <span className="truncate">本地归档 · 不同步</span>
            {skill.sourceUrl && (
              <a
                href={skill.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-[var(--primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"
                onClick={(event) => event.stopPropagation()}
              >
                来源
              </a>
            )}
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-[10px]">
        <span className="text-[var(--lavender)]">{skill.downloads || 100}+ 次调用</span>
        <button
          type="button"
          onClick={onToggle}
          className={`px-3 py-1 rounded-[6px] text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
            isActive
              ? 'bg-[var(--lavender)] text-[var(--surface)] shadow-2xs'
              : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--surface)]'
          }`}
        >
          {isActive ? (
            <>
              <Check size={12} />
              <span>已添加</span>
            </>
          ) : isMultiLocked ? (
            <>
              <Lock size={11} className="text-[var(--acid-sage)]" />
              <span>添加 (替换)</span>
            </>
          ) : (
            <>
              <Plus size={12} />
              <span>添加</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function renderSkillIcon(icon: string) {
  switch (icon) {
    case 'Scale':
      return <Scale size={14} />
    case 'Crosshair':
      return <Crosshair size={14} />
    case 'Sparkles':
      return <Sparkles size={14} />
    case 'ShoppingBag':
      return <ShoppingBag size={14} />
    case 'Truck':
      return <Truck size={14} />
    case 'ShieldCheck':
      return <ShieldCheck size={14} />
    case 'TrendingUp':
      return <TrendingUp size={14} />
    case 'Calendar':
      return <Calendar size={14} />
    case 'FileSearch':
      return <FileSearch size={14} />
    case 'Layers':
      return <Layers size={14} />
    default:
      return <Bot size={14} />
  }
}
