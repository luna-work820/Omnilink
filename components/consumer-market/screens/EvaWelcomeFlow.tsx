'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { advanceEvaProfile, emptyEvaProfile, type EvaProfile } from '@/lib/consumer-advisor/eva-onboarding'
import { ShoppingPreferenceSurveyFlow } from './ShoppingPreferenceSurveyFlow'

const INSTALLED_SKILLS = ['personal-advisor', 'shopping-preferences']

export function EvaWelcomeFlow({ initialProfile, preview = false }: { initialProfile?: EvaProfile; preview?: boolean }) {
  const router = useRouter()
  const [profile, setProfile] = useState<EvaProfile>(initialProfile ?? emptyEvaProfile)
  const [name, setName] = useState(profile.name)
  const [assistantName, setAssistantName] = useState(profile.assistantName || '个人助手')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(payload: Record<string, string>) {
    setBusy(true)
    setError(null)
    try {
      if (preview) {
        const nextProfile = advanceEvaProfile(profile, payload)
        setProfile(nextProfile)
        if (payload.action === 'basic') {
          try { localStorage.setItem('omnilink_consumer_skills_v2', JSON.stringify(INSTALLED_SKILLS)) } catch {}
        }
        if (nextProfile.stage === 'done') {
          try { localStorage.setItem('omnilink_consumer_skills_v2', JSON.stringify(INSTALLED_SKILLS)) } catch {}
          router.replace('/discover?openEva=1&activatePersonalAdvisor=1&signupPreviewComplete=1')
        }
        return
      }
      const response = await fetch('/api/consumer/eva-profile', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const result = await response.json() as { profile?: EvaProfile; complete?: boolean; error?: string }
      if (!response.ok || !result.profile) throw new Error(result.error || '保存失败，请重试。')
      setProfile(result.profile)
      if (result.complete) router.replace('/discover?openEva=1&activatePersonalAdvisor=1')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  if (profile.stage === 'preferences') {
    return <ShoppingPreferenceSurveyFlow initialProfile={profile} preview={preview} signupMode />
  }

  return <div className="consumer-market-shell flex min-h-dvh flex-col bg-white text-[var(--market-ink)]">
    <header className="sticky top-0 z-10 border-b-[0.5px] border-[var(--market-border)] bg-white/95 px-4 py-3 text-[var(--market-ink)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <a href="/discover" aria-label="返回发现" className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><ArrowLeft size={18} /></a>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--market-ink)] text-sm font-semibold text-white" aria-hidden="true">助</span>
        <h1 className="text-sm font-semibold">个人助手</h1>
      </div>
    </header>

    <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 pb-12 pt-8 sm:px-6" aria-live="polite">
      <div className="max-w-[88%]"><p className="mb-2 text-xs font-medium text-[var(--market-support)]">个人助手</p><p className="text-sm leading-6">你好，我是你的个人助手。先确认我们怎么称呼彼此，再用几道选择题了解你的购物偏好。</p></div>

      {profile.stage === 'basic' && <div className="max-w-[92%]"><p className="mb-2 text-xs font-medium text-[var(--market-support)]">个人助手</p><form onSubmit={(event) => { event.preventDefault(); void save({ action: 'basic', name, assistantName }) }} className="ui-card--nested space-y-4 border-[0.5px] border-[var(--market-border)] bg-[var(--market-surface)] p-4" aria-label="确认称呼">
        <label className="block text-sm font-medium">你想要如何称呼我？<input value={assistantName} onChange={(event) => setAssistantName(event.target.value)} maxLength={24} required className="mt-2 h-11 w-full rounded-[var(--radius-control)] border-[0.5px] border-[var(--market-border)] bg-white px-3 outline-none focus-visible:border-[var(--market-support)]" placeholder="个人助手" /></label>
        <label className="block text-sm font-medium">我该如何称呼你？<input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required className="mt-2 h-11 w-full rounded-[var(--radius-control)] border-[0.5px] border-[var(--market-border)] bg-white px-3 outline-none focus-visible:border-[var(--market-support)]" placeholder="填写你的称呼" /></label>
        <button type="submit" disabled={busy || !name.trim() || !assistantName.trim()} className="h-11 rounded-full bg-[var(--market-accent)] px-5 text-sm font-semibold text-white disabled:opacity-50">继续</button>
      </form></div>}

      {profile.stage !== 'basic' && <div className="ml-auto flex max-w-[85%] items-center justify-end gap-2"><p className="ui-card--nested bg-[var(--market-surface-muted)] px-3 py-2 text-sm">你叫我 {profile.assistantName}，我叫你 {profile.name}</p><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[var(--market-border)] bg-[var(--market-surface-muted)] text-sm" aria-label="我的头像">{profile.name.slice(0, 1)}</span></div>}

      {profile.stage === 'done' && <div className="max-w-[88%]"><p className="mb-2 text-xs font-medium text-[var(--market-support)]">个人助手</p><p className="text-sm leading-6">购物偏好已记录。之后的推荐会参考这些选择，也会以你当下的需求为准。</p><div className="mt-3 flex flex-wrap gap-2"><a href="/discover?openEva=1&activatePersonalAdvisor=1" className="inline-flex h-11 items-center rounded-full bg-[var(--market-accent)] px-4 text-sm font-semibold text-white">开始使用</a><a href="/discover" className="inline-flex h-11 items-center rounded-[var(--radius-control)] border-[0.5px] border-[var(--market-border)] px-4 text-sm">先逛逛</a></div></div>}
      {error && <p role="alert" className="text-sm text-[var(--market-accent)]">{error}</p>}
    </main>
  </div>
}
