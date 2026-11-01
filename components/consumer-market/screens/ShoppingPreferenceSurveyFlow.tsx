'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { advanceEvaProfile, readEvaProfile, type EvaProfile } from '@/lib/consumer-advisor/eva-onboarding'
import {
  nextShoppingPreferenceDeepQuestion,
  shoppingPreferenceSurveyProgress,
  type ShoppingPreferenceQuestion,
} from '@/lib/consumer-advisor/shopping-preference-survey'

const INSTALLED_SKILLS = ['personal-advisor', 'shopping-preferences']

type Props = {
  initialProfile: EvaProfile
  preview?: boolean
  signupMode?: boolean
  embedded?: boolean
  onComplete?: () => void
}

function questionOptions(question: ShoppingPreferenceQuestion) {
  if (question.type === 'pairwise') return [question.left, question.right, question.tie_option].filter((option): option is NonNullable<typeof option> => Boolean(option))
  return question.options ?? []
}

export function ShoppingPreferenceSurveyFlow({ initialProfile, preview = false, signupMode = false, embedded = false, onComplete }: Props) {
  const router = useRouter()
  const [profile, setProfile] = useState(initialProfile)
  const [selection, setSelection] = useState<unknown>(null)
  const [numericInput, setNumericInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const survey = profile.shoppingPreferenceSurvey
  const question = nextShoppingPreferenceDeepQuestion(survey)
  const progress = shoppingPreferenceSurveyProgress(survey)
  const answerCount = Object.keys(survey.answers).length + survey.skipped.length
  const ladder = question?.type === 'ladder' ? survey.ladders[question.id] : undefined
  const ladderStep = question?.type === 'ladder' ? question.steps?.[ladder?.step ?? 0] : undefined

  const displayPrompt = useMemo(() => {
    if (!question || !ladderStep) return question?.prompt ?? ''
    return `${question.prompt}（贵 ${ladderStep.pct}% 时）`
  }, [ladderStep, question])

  async function save(payload: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      let nextProfile: EvaProfile
      if (preview) {
        nextProfile = advanceEvaProfile(profile, payload)
        try { localStorage.setItem('omnilink_preview_eva_profile', JSON.stringify(nextProfile)) } catch {}
        try { localStorage.setItem('omnilink_consumer_skills_v2', JSON.stringify(INSTALLED_SKILLS)) } catch {}
      } else {
        const response = await fetch('/api/consumer/eva-profile', {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        const result = await response.json() as { profile?: EvaProfile; error?: string }
        if (!response.ok || !result.profile) throw new Error(result.error || '保存失败，请重试。')
        nextProfile = result.profile
      }
      setProfile(nextProfile)
      setSelection(null)
      setNumericInput('')
      if (embedded && signupMode && nextProfile.stage === 'done') {
        onComplete?.()
      } else if (payload.action === 'shopping-preference-pause' || (signupMode && payload.action !== 'shopping-preference-reset' && nextProfile.shoppingPreferenceSurvey.status === 'complete')) {
        router.replace(preview && signupMode
          ? '/discover?openEva=1&activatePersonalAdvisor=1&signupPreviewComplete=1'
          : '/discover?openEva=1&activatePersonalAdvisor=1')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  function submitAnswer() {
    if (!question) return
    if (question.type === 'numeric') {
      const value = Number(numericInput)
      if (!numericInput.trim() || !Number.isFinite(value)) return
      void save({ action: 'shopping-preference-answer', key: question.id, answer: value })
      return
    }
    if (selection === null) return
    void save({ action: 'shopping-preference-answer', key: question.id, answer: selection })
  }

  function toggleOption(value: string | number) {
    if (!question || question.type !== 'multi_choice') return
    const current = Array.isArray(selection) ? selection as (string | number)[] : []
    const values = question.options?.map((option) => option.value) ?? []
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : value === 'none'
        ? [value]
        : [...current.filter((item) => item !== 'none'), value]
    if (next.length <= (question.max_select ?? values.length)) setSelection(next)
  }

  const appBackUrl = signupMode ? '/discover' : '/discover?openEva=1&activatePersonalAdvisor=1'

  useEffect(() => {
    if (!preview || signupMode) return
    try {
      const saved = localStorage.getItem('omnilink_preview_eva_profile')
      if (saved) setProfile(readEvaProfile(JSON.parse(saved)))
    } catch {}
  }, [preview, signupMode])

  return <div className={embedded ? 'w-full text-[var(--market-ink)]' : 'consumer-market-shell flex min-h-dvh flex-col bg-white text-[var(--market-ink)]'}>
    {!embedded && <header className="sticky top-0 z-10 border-b-[0.5px] border-[var(--market-border)] bg-white/95 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <a href={appBackUrl} aria-label="返回个人助手" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><ArrowLeft size={18} /></a>
        <h1 className="text-sm font-semibold">购物偏好</h1>
        <span className="ml-auto text-xs text-[var(--market-text-muted)]">保存后可继续</span>
      </div>
    </header>}

    <main className={embedded ? 'w-full' : 'mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-10 pt-8 sm:px-6'} aria-live="polite">
      {question ? <section aria-label="购物偏好测量" className={embedded ? 'w-full max-w-3xl rounded-[24px] border-[0.5px] border-[var(--market-border)] bg-white p-5 sm:p-6' : 'my-auto w-full'}>
        {!embedded && <div className="mb-5 flex items-center justify-between text-xs text-[var(--market-text-muted)]">
          <span>购物偏好</span><span>{answerCount} 项已记录</span>
        </div>}
        {!embedded && <div role="progressbar" aria-label="测量进度" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed} className="mb-7 h-1 overflow-hidden rounded-full bg-[var(--market-surface-muted)]">
          <div className="h-full rounded-full bg-[var(--market-ink)] transition-[width] duration-200" style={{ width: `${progress.percent}%` }} />
        </div>}
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="text-base font-semibold leading-6">{displayPrompt}</legend>
          {question.hint && <p className="mt-2 text-sm leading-6 text-[var(--market-text-muted)]">{question.hint}</p>}

          {question.type === 'numeric' && <label className="mt-6 flex max-w-sm items-center gap-3 border-b-[0.5px] border-[var(--market-border)] py-2 focus-within:border-[var(--market-ink)]">
            <input type="number" inputMode="decimal" min={question.min} max={question.max} value={numericInput} onChange={(event) => setNumericInput(event.target.value)} disabled={busy} aria-label={question.prompt} className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none focus-visible:outline-none" placeholder={`填写 ${question.min ?? 0} 到 ${question.max ?? ''}`} />
            <span className="text-sm text-[var(--market-text-muted)]">{question.id === 'A2' ? '元' : '分'}</span>
          </label>}

          {(question.type === 'single_choice' || question.type === 'pairwise' || question.type === 'multi_choice') && <div className="mt-5 grid gap-1" role={question.type === 'multi_choice' ? 'group' : 'radiogroup'} aria-label={question.prompt}>
            {questionOptions(question).map((option) => {
              const selected = question.type === 'multi_choice'
                ? Array.isArray(selection) && selection.includes(option.value)
                : selection === option.value
              return <button key={String(option.value)} type="button" disabled={busy} aria-pressed={selected} onClick={() => question.type === 'multi_choice' ? toggleOption(option.value) : setSelection(option.value)} className={`flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-card-nested)] px-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] disabled:opacity-60 ${selected ? embedded ? 'bg-[var(--market-hover)]' : 'bg-[var(--market-support-soft)]' : 'bg-white hover:bg-[var(--market-hover)]'}`}>
                <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-[var(--market-ink)]' : 'border-[var(--market-border)]'}`}>{selected && <span className="h-2.5 w-2.5 rounded-full bg-[var(--market-ink)]" />}</span>
                <span>{option.label}</span>
              </button>
            })}
          </div>}

          {question.type === 'ladder' && ladderStep && <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {ladderStep.options.map((option) => <button key={String(option.value)} type="button" disabled={busy} onClick={() => void save({ action: 'shopping-preference-ladder', key: question.id, answer: option.value })} className="min-h-12 rounded-[var(--radius-control)] bg-white px-4 text-sm text-left transition-colors hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] disabled:opacity-60">{option.label}</button>)}
          </div>}
        </fieldset>

        <div className={embedded ? 'mt-6 grid gap-2' : 'mt-7 flex items-center justify-between gap-4'}>
          {question.type !== 'ladder' && <button type="button" disabled={busy || (question.type === 'numeric' ? !numericInput.trim() || !Number.isFinite(Number(numericInput)) : question.type === 'multi_choice' ? !Array.isArray(selection) || selection.length === 0 : selection === null)} onClick={submitAnswer} className={`${embedded ? 'min-h-12 w-full bg-[var(--market-ink)] text-white' : 'min-h-11 bg-[var(--market-accent)] text-white'} rounded-full px-6 text-sm font-semibold disabled:opacity-40`}>{embedded ? '提交答案' : '继续'}</button>}
          <button type="button" disabled={busy} onClick={() => void save({ action: 'shopping-preference-skip', key: question.id })} className="min-h-11 px-3 text-sm text-[var(--market-text-muted)] hover:text-[var(--market-ink)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-50">跳过</button>
        </div>
        {!embedded && <button type="button" disabled={busy} onClick={() => void save({ action: 'shopping-preference-pause' })} className="mt-6 min-h-10 text-xs text-[var(--market-text-muted)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-50">稍后继续</button>}
        {error && <p role="alert" className="mt-4 text-sm text-[var(--market-accent)]">{error}</p>}
      </section> : <section className="my-auto w-full" aria-label="购物偏好已完成">
        <h2 className="text-lg font-semibold">偏好已整理</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--market-text-muted)]">测量结果已写入你的用户档案，个人助手会把它作为可调整的推荐参考。</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => void save({ action: 'shopping-preference-reset' })} className="min-h-11 rounded-full border-[0.5px] border-[var(--market-border)] px-5 text-sm hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">重新测量</button>
          <a href={appBackUrl} className="inline-flex min-h-11 items-center rounded-full bg-[var(--market-accent)] px-5 text-sm font-semibold text-white">返回个人助手</a>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-[var(--market-accent)]">{error}</p>}
      </section>}
    </main>
  </div>
}
