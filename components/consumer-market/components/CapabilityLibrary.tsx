import React, { useEffect, useState } from 'react'
import { MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { Brain, Check, ShoppingBag, UserRound } from 'lucide-react'

export const AI_ASSISTANT_SKILLS_STORAGE_KEY = 'omnilink_consumer_skills_v2'

export const AI_ASSISTANT_SKILLS = [
  {
    id: 'personal-advisor',
    title: '个人助手',
    description: '通过照片和自述，探索肤质、外貌风格、色彩与穿搭方向。',
    prompt: '启用个人助手，按我选择的范围探索个人形象；照片观察需要结合我的自述确认。',
    icon: UserRound,
  },
  {
    id: 'shopping-preferences',
    title: '购物偏好',
    description: '通过可续答的选择题测量偏好，并整理进个人档案。',
    prompt: '购物偏好由用户逐题明确回答并写入档案。用户选择此技能时进入测量或续答流程；不要在聊天里重新发起安装，也不要调用模型计算测量分数。推荐时读取已保存的结构化偏好作为可调整的软参考；本轮明确需求优先，未答和跳过项视为未知。',
    icon: ShoppingBag,
  },
  {
    id: 'know-yourself',
    title: '识己',
    description: '通过五问梳理或单件事拆解，帮你看清处境、思维与行动之间的关系。',
    prompt: '仅在用户想分析自身处境或具体事件时启用识己流程。用户可选择五问梳理或单件事拆解；五问梳理一次只问一道，答完五题后再总结。已有具体事件时直接按处境、机制、叙述三层梳理，区分已知事实与推测，并给出可行动的一步。不要做心理诊断、评人格等级或替用户做人生决定。若用户出现自杀或严重自伤信号，停止分析并优先回应安全与专业支持。',
    icon: Brain,
  },
] as const

export type AiAssistantSkillId = (typeof AI_ASSISTANT_SKILLS)[number]['id']
export const DEFAULT_INSTALLED_SKILL_IDS: AiAssistantSkillId[] = ['personal-advisor', 'shopping-preferences']

export function readInstalledSkillIds(): AiAssistantSkillId[] {
  try {
    const stored = localStorage.getItem(AI_ASSISTANT_SKILLS_STORAGE_KEY)
    if (stored === null) {
      localStorage.setItem(AI_ASSISTANT_SKILLS_STORAGE_KEY, JSON.stringify(DEFAULT_INSTALLED_SKILL_IDS))
      return [...DEFAULT_INSTALLED_SKILL_IDS]
    }
    const saved: unknown = JSON.parse(stored)
    if (!Array.isArray(saved)) return []
    return AI_ASSISTANT_SKILLS.map((skill) => skill.id).filter((id) => saved.includes(id))
  } catch {
    return []
  }
}

export function CapabilityLibrary({ onInstalledSkillsChange }: {
  onInstalledSkillsChange: (ids: AiAssistantSkillId[]) => void
}) {
  const [installedIds, setInstalledIds] = useState<AiAssistantSkillId[]>([])
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<'skills' | 'plugins'>('skills')

  useEffect(() => {
    queueMicrotask(() => setInstalledIds(readInstalledSkillIds()))
  }, [])

  const toggleSkill = (id: AiAssistantSkillId) => {
    const next = installedIds.includes(id) ? installedIds.filter((item) => item !== id) : [...installedIds, id]
    setInstalledIds(next)
    localStorage.setItem(AI_ASSISTANT_SKILLS_STORAGE_KEY, JSON.stringify(next))
    onInstalledSkillsChange(next)
  }

  const filteredSkills = AI_ASSISTANT_SKILLS.filter((skill) => skill.title.includes(query.trim()) || skill.description.includes(query.trim()))

  return (
    <section aria-label="插件和技能" className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[var(--market-surface)] text-[var(--market-ink)]">
      <div className="mx-auto w-full max-w-5xl px-5 pb-12 sm:px-8">
        <h1 className="mt-8 text-xl font-semibold sm:mt-10">插件和技能</h1>
        <div role="tablist" aria-label="类型" onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const next = event.key === 'Home' ? 'skills' : event.key === 'End' ? 'plugins' : section === 'skills' ? 'plugins' : 'skills'
          setSection(next)
          event.currentTarget.querySelector<HTMLButtonElement>(`#capability-tab-${next}`)?.focus()
        }} className="mt-7 flex gap-5 border-b-[0.5px] border-[var(--market-border)]">
          <button type="button" id="capability-tab-skills" role="tab" aria-controls="capability-panel" aria-selected={section === 'skills'} tabIndex={section === 'skills' ? 0 : -1} onClick={() => setSection('skills')} className={`border-b-[0.5px] px-1 pb-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[var(--market-support)] ${section === 'skills' ? 'border-[var(--market-ink)] text-[var(--market-ink)]' : 'border-transparent text-[var(--market-text-muted)]'}`}>技能</button>
          <button type="button" id="capability-tab-plugins" role="tab" aria-controls="capability-panel" aria-selected={section === 'plugins'} tabIndex={section === 'plugins' ? 0 : -1} onClick={() => setSection('plugins')} className={`border-b-[0.5px] px-1 pb-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[var(--market-support)] ${section === 'plugins' ? 'border-[var(--market-ink)] text-[var(--market-ink)]' : 'border-transparent text-[var(--market-text-muted)]'}`}>插件</button>
        </div>

        <div id="capability-panel" role="tabpanel" aria-labelledby={`capability-tab-${section}`} tabIndex={0}>{section === 'skills' ? <div>
          <label className="mt-6 flex h-11 items-center gap-3 rounded-full border-[0.5px] border-[var(--market-border)] px-4 focus-within:border-[var(--market-support)]">
            <MagnifyingGlass size={18} className="shrink-0 text-[var(--market-text-muted)]" aria-hidden="true" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索技能" aria-label="搜索技能" className="min-w-0 flex-1 bg-transparent text-sm text-[var(--market-ink)] outline-none placeholder:text-[var(--market-text-muted)]" />
          </label>
          <h2 className="mt-10 border-b-[0.5px] border-[var(--market-border)] pb-3 text-sm font-semibold">可用技能</h2>
          {filteredSkills.length ? <div className="grid gap-3 pt-4 sm:grid-cols-2">
            {filteredSkills.map((skill) => {
              const installed = installedIds.includes(skill.id)
              return <article key={skill.id} className="rounded-[var(--radius-card)] bg-[var(--market-canvas)] p-4 transition-colors hover:bg-[var(--market-hover)]">
                <div className="min-h-20">
                  <h3 className="text-sm font-semibold leading-5">{skill.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-[var(--market-text-secondary)]">{skill.description}</p>
                </div>
                <div className="mt-4 flex min-h-12 items-center justify-between gap-3 border-t-[0.5px] border-[var(--market-border)] pt-3">
                  <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--market-text-secondary)]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-[var(--market-surface-muted)] text-[var(--market-ink)]">
                      <skill.icon size={18} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="truncate">SKILL.md</span>
                  </div>
                  <button type="button" onClick={() => toggleSkill(skill.id)} aria-label={installed ? `移除${skill.title}` : `添加${skill.title}`} title={installed ? '点击移除' : '添加技能'} className={`flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] ${installed ? 'bg-[var(--market-surface-muted)] text-[var(--market-text-secondary)] hover:bg-[var(--market-hover)]' : 'bg-[var(--market-ink)] text-[var(--market-canvas)] hover:opacity-85'}`}>
                      {installed ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}{installed ? '已添加' : '添加'}
                    </button>
                </div>
              </article>
            })}
          </div> : <p className="pt-5 text-sm text-[var(--market-text-muted)]">没有匹配的技能</p>}
        </div> : <div className="pt-8 text-sm text-[var(--market-text-muted)]">暂无可用插件</div>}</div>
      </div>
    </section>
  )
}
