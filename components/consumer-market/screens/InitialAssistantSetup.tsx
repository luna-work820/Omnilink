'use client'

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowRight, UserRound } from 'lucide-react'
import type { AiAssistantProfile } from '@/lib/consumer-advisor/ai-assistant-profile'
import { advanceAiAssistantProfile } from '@/lib/consumer-advisor/ai-assistant-profile'
import { Message, MessageContent, MessageScrollerItem } from '@/components/ai-elements/chat'

type Props = {
  initialProfile: AiAssistantProfile
  defaultName?: string
  deepSeekConfigured: boolean
  preview: boolean
  onDeepSeekConfigured: () => void
  onComplete: () => void
}

export function InitialAssistantSetup({ initialProfile, defaultName = '', deepSeekConfigured, preview, onDeepSeekConfigured, onComplete }: Props) {
  const [profile, setProfile] = useState(initialProfile)
  const [step, setStep] = useState<'basic' | 'api' | 'done'>(() => initialProfile.stage === 'basic' ? 'basic' : initialProfile.stage === 'done' ? 'done' : 'api')
  const [basicsSaved, setBasicsSaved] = useState(initialProfile.stage !== 'basic')
  const [name, setName] = useState(initialProfile.name || defaultName)
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const avatarObjectUrl = useRef<string | null>(null)

  useEffect(() => () => {
    if (avatarObjectUrl.current) URL.revokeObjectURL(avatarObjectUrl.current)
  }, [])

  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件。')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('图片请控制在 5 MB 以内。')
      return
    }
    if (avatarObjectUrl.current) URL.revokeObjectURL(avatarObjectUrl.current)
    const url = URL.createObjectURL(file)
    avatarObjectUrl.current = url
    setAvatarFile(file)
    setAvatarUrl(url)
    setError(null)
  }

  async function completeSetup(sourceProfile = profile) {
    if (preview) {
      setProfile(advanceAiAssistantProfile(sourceProfile, { action: 'complete-onboarding' }))
      setStep('done')
      onComplete()
      return
    }
    const response = await fetch('/api/consumer/ai-assistant-profile', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete-onboarding' }),
    })
    const result = await response.json() as { profile?: AiAssistantProfile; error?: string }
    if (!response.ok || !result.profile) throw new Error(result.error || '无法完成设置，请重试。')
    setProfile(result.profile)
    setStep('done')
    onComplete()
  }

  async function saveBasics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      let nextAvatarUrl = avatarUrl
      if (avatarFile && !preview) {
        const formData = new FormData()
        formData.set('file', avatarFile)
        const uploadResponse = await fetch('/api/consumer/avatar', { method: 'POST', credentials: 'include', body: formData })
        const uploadResult = await uploadResponse.json() as { avatarUrl?: string; error?: string }
        if (!uploadResponse.ok || !uploadResult.avatarUrl) throw new Error(uploadResult.error || '头像上传失败。')
        nextAvatarUrl = uploadResult.avatarUrl
        setAvatarUrl(nextAvatarUrl)
      }
      const payload = { action: 'basic', name: name.trim(), assistantName: profile.assistantName || 'AI assistant', ...(avatarFile || preview ? { avatarUrl: nextAvatarUrl } : {}) }
      let nextProfile: AiAssistantProfile
      if (preview) {
        nextProfile = advanceAiAssistantProfile(profile, payload)
      } else {
        const response = await fetch('/api/consumer/ai-assistant-profile', {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await response.json() as { profile?: AiAssistantProfile; error?: string }
        if (!response.ok || !result.profile) throw new Error(result.error || '保存失败，请重试。')
        nextProfile = result.profile
      }
      setProfile(nextProfile)
      setAvatarFile(null)
      setBasicsSaved(true)
      await completeSetup(nextProfile)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (initialProfile.stage !== 'basic' && initialProfile.stage !== 'done') {
      void completeSetup().catch(() => setError('无法完成设置，请重试。'))
    }
  // Run once to resume an unfinished setup.
  }, [])

  const assistantName = profile.assistantName || 'AI assistant'

  return <div className="w-full space-y-6 pb-2">
    <MessageScrollerItem messageId="initial-assistant-profile">
      <Message align="start" data-role="assistant">
        <MessageContent className="w-full max-w-[92%] text-sm leading-6">
          <p>你好，我是你的{assistantName}。先完善一下头像和名字。</p>
          {step === 'basic' && <form onSubmit={saveBasics} className="mt-4 w-full max-w-3xl space-y-4" aria-label="个人资料">
            <div className="flex items-center gap-3">
              <label className="relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[var(--market-surface-muted)] text-[var(--market-text-secondary)] hover:bg-[var(--market-border)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--market-support)]" aria-label="上传头像">
                {avatarUrl ? <img src={avatarUrl} alt="头像预览" className="h-full w-full object-cover" /> : <UserRound size={22} aria-hidden="true" />}
                <input type="file" accept="image/*" onChange={selectAvatar} className="sr-only" aria-label="选择头像图片" />
              </label>
              <span className="text-sm">上传头像</span>
            </div>
            <label className="block text-sm font-medium">名字
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required disabled={busy} className="mt-2 h-11 w-full rounded-full border-[0.5px] border-[var(--market-border)] bg-white px-4 text-sm font-normal outline-none focus-visible:border-[var(--market-ink)]" placeholder="你的名字" />
            </label>
            <button type="submit" disabled={busy || !name.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--market-ink)] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? '保存中' : '继续'}<ArrowRight size={16} aria-hidden="true" /></button>
            {error && <p role="alert" className="text-sm text-[var(--market-accent)]">{error}</p>}
          </form>}
        </MessageContent>
      </Message>
    </MessageScrollerItem>

    {basicsSaved && <MessageScrollerItem messageId="initial-user-profile" scrollAnchor>
      <Message align="end" data-role="user" className="max-w-[88%]">
        <MessageContent>
          <div className="flex items-center gap-2 rounded-xl bg-[var(--market-surface-muted)] px-4 py-3 text-sm leading-6">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[var(--market-text-secondary)]"><UserRound size={16} aria-hidden="true" /></span>}
            <span>{name.trim() || profile.name}</span>
          </div>
        </MessageContent>
      </Message>
    </MessageScrollerItem>}

    {step === 'api' && error && <button type="button" onClick={() => void completeSetup().catch(() => setError('无法完成设置，请重试。'))} className="text-sm underline">{error} 重试</button>}
    {step === 'done' && <MessageScrollerItem messageId="initial-assistant-ready">
      <Message align="start" data-role="assistant">
        <MessageContent className="max-w-[92%] text-sm leading-6">好了，我已经准备好。你现在最想先解决什么？</MessageContent>
      </Message>
    </MessageScrollerItem>}
  </div>
}
