'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { advanceAiAssistantProfile, readAiAssistantProfile, type AiAssistantProfile } from '@/lib/consumer-advisor/ai-assistant-profile'
import { readPreviewAiAssistantProfile, savePreviewAiAssistantProfile } from '@/lib/consumer-advisor/ai-assistant-preview-storage'
import { assessmentMemoryProposal } from '@/lib/consumer-advisor/assessment-memory-proposal'
import {
  nextShoppingPreferenceDeepQuestion,
  shoppingPreferenceSurveyProgress,
  type ShoppingPreferenceQuestion,
} from '@/lib/consumer-advisor/shopping-preference-survey'

const INSTALLED_SKILLS = ['personal-advisor', 'shopping-preferences']

type Props = {
  initialProfile: AiAssistantProfile
  preview?: boolean
  signupMode?: boolean
  embedded?: boolean
  onComplete?: () => void
  onReview?: () => void
}

function questionOptions(question: ShoppingPreferenceQuestion) {
  if (question.type === 'pairwise') return [question.left, question.right, question.tie_option].filter((option): option is NonNullable<typeof option> => Boolean(option))
  return question.options ?? []
}

export function ShoppingPreferenceSurveyFlow({ initialProfile, preview = false, signupMode = false, embedded = false, onComplete,onReview }: Props) {
  const router = useRouter()
  const [profile, setProfile] = useState(initialProfile)
  const [selection, setSelection] = useState<unknown>(null)
  const [numericInput, setNumericInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading,setLoading]=useState(!preview)
  const [readFailed,setReadFailed]=useState(false),[readAttempt,setReadAttempt]=useState(0)
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
      let nextProfile: AiAssistantProfile
      if (preview) {
        nextProfile = advanceAiAssistantProfile(profile, payload)
        const proposal=await assessmentMemoryProposal(nextProfile)
        if(proposal&&!nextProfile.memories.some((m)=>m.sourcePayload?.assessmentId===proposal.sourcePayload.assessmentId&&m.status!=='rejected')){
          nextProfile={...nextProfile,memories:[...nextProfile.memories,{...proposal,id:crypto.randomUUID(),status:'proposed',confirmedAt:null,revision:1}]}
        }
        savePreviewAiAssistantProfile(nextProfile)
        try { localStorage.setItem('omnilink_consumer_skills_v2', JSON.stringify(INSTALLED_SKILLS)) } catch {}
      } else {
        const response = await fetch('/api/consumer/ai-assistant-profile', {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        const result = await response.json() as { profile?: AiAssistantProfile; error?: string }
        if (!response.ok || !result.profile) throw new Error(result.error || '保存失败，请重试。')
        nextProfile = result.profile
      }
      setProfile(nextProfile)
      setSelection(null)
      setNumericInput('')
      if(embedded){if(payload.action==='shopping-preference-pause')onComplete?.()}
      else if (payload.action === 'shopping-preference-pause' || (signupMode && payload.action !== 'shopping-preference-reset' && nextProfile.shoppingPreferenceSurvey.status === 'complete')) {
        router.replace(preview && signupMode
          ? '/discover?openAssistant=1&activatePersonalAdvisor=1&signupPreviewComplete=1'
          : '/discover?openAssistant=1&activatePersonalAdvisor=1')
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

  const appBackUrl = signupMode ? '/discover' : '/discover?openAssistant=1&activatePersonalAdvisor=1'

  useEffect(() => {
    if(preview){const saved=readPreviewAiAssistantProfile();if(saved)setProfile(readAiAssistantProfile(saved));return}
    const abort=new AbortController()
    setLoading(true);setReadFailed(false);setError(null)
    void fetch('/api/consumer/ai-assistant-profile',{signal:abort.signal,credentials:'include',cache:'no-store'})
      .then(async(response)=>{const data=await response.json();if(!response.ok||!data.profile)throw new Error(data.error??'偏好暂时无法读取。');return data.profile})
      .then((value)=>setProfile(readAiAssistantProfile(value)))
      .catch((cause)=>{if(!abort.signal.aborted){setReadFailed(true);setError(cause instanceof Error?cause.message:'偏好暂时无法读取。')}})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false)})
    return()=>abort.abort()
  }, [preview, signupMode,readAttempt])

  if(loading)return <p role="status" className="px-4 py-8 text-sm text-[var(--market-ink)]">正在读取购物偏好…</p>
  if(readFailed)return <div role="alert" className="px-4 py-8 text-sm text-[var(--market-ink)]"><p>{error}</p><button type="button" onClick={()=>setReadAttempt((value)=>value+1)} className="mt-3 min-h-11 rounded-full px-4 hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">重新读取</button></div>

  return <div className={embedded ? 'w-full text-[var(--market-ink)]' : 'consumer-market-shell flex min-h-dvh flex-col bg-white text-[var(--market-ink)]'}>
    {!embedded && <header className="sticky top-0 z-10 border-b-[0.5px] border-[var(--market-border)] bg-white/95 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <a href={appBackUrl} aria-label="返回 AI assistant" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><ArrowLeft size={18} /></a>
        <h1 className="text-sm font-semibold">购物偏好</h1>
        <span className="ml-auto text-xs text-[var(--market-text-muted)]">保存后可继续</span>
      </div>
    </header>}

    <main className={embedded ? 'w-full' : 'mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-10 pt-8 sm:px-6'} aria-live="polite">
      {question ? <section aria-label="购物偏好测量" className={embedded ? 'w-full max-w-3xl px-4 py-3' : 'my-auto w-full'}>
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

          {(question.type === 'single_choice' || question.type === 'pairwise' || question.type === 'multi_choice') && <div className="mt-5 grid gap-1" role={question.type === 'multi_choice' ? 'group' : 'radiogroup'} aria-label={question.prompt} onKeyDown={(event)=>{
            if(question.type==='multi_choice'||busy||!['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'].includes(event.key))return
            event.preventDefault()
            const options=questionOptions(question),buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
            const index=buttons.indexOf(document.activeElement as HTMLButtonElement),delta=['ArrowDown','ArrowRight'].includes(event.key)?1:-1
            const next=event.key==='Home'?0:event.key==='End'?options.length-1:(index+delta+options.length)%options.length
            setSelection(options[next].value);buttons[next]?.focus()
          }}>
            {questionOptions(question).map((option,index) => {
              const selected = question.type === 'multi_choice'
                ? Array.isArray(selection) && selection.includes(option.value)
                : selection === option.value
              return <button key={String(option.value)} type="button" disabled={busy} role={question.type==='multi_choice'?'checkbox':'radio'} aria-checked={selected} tabIndex={question.type==='multi_choice'||selected||(selection===null&&index===0)?0:-1} onClick={() => question.type === 'multi_choice' ? toggleOption(option.value) : setSelection(option.value)} className={`flex min-h-12 w-full items-center gap-3 rounded-full px-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] disabled:opacity-60 ${selected ? embedded ? 'bg-[var(--market-hover)]' : 'bg-[var(--market-support-soft)]' : 'bg-transparent hover:bg-[var(--market-hover)]'}`}>
                <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[0.5px] ${selected ? 'border-[var(--market-ink)]' : 'border-[var(--market-border)]'}`}>{selected && <span className="h-2.5 w-2.5 rounded-full bg-[var(--market-ink)]" />}</span>
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
        <button type="button" disabled={busy} onClick={() => void save({ action: 'shopping-preference-pause' })} className="mt-6 min-h-11 rounded-full px-3 text-xs text-[var(--market-text-secondary)] hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-50">稍后继续</button>
        {error && <p role="alert" className="mt-4 text-sm text-[var(--market-accent)]">{error}</p>}
      </section> : <section className="my-auto w-full" aria-label="购物偏好已完成">
        <h2 className="text-base font-semibold">评测已完成</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--market-text-secondary)]">确认提案后，才会用于长期推荐。</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => void save({ action: 'shopping-preference-reset' })} className="min-h-11 rounded-full border-[0.5px] border-[var(--market-border)] px-5 text-sm hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">重新测量</button>
          {onReview?<button type="button" onClick={onReview} className="min-h-11 rounded-full bg-[var(--market-accent)] px-5 text-sm font-medium text-white">查看提案</button>:<a href="/discover?memories=1" className="inline-flex min-h-11 items-center rounded-full bg-[var(--market-accent)] px-5 text-sm font-semibold text-white">查看提案</a>}
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-[var(--market-accent)]">{error}</p>}
      </section>}
    </main>
  </div>
}
