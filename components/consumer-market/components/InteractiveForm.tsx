'use client'

import { useState, type FormEvent } from 'react'
import type { InteractiveForm as Form } from '@/lib/consumer-advisor/response-contract'
import type { AiChatMessage } from '../types'
import { useOmnilink } from '../context/OmnilinkContext'

export function InteractiveForm({ form, disabled, completed, onSubmit }: { form: Form; disabled?: boolean; completed?: boolean; onSubmit: (answer: string) => void }) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  function submit(event: FormEvent) {
    event.preventDefault()
    const parts = form.questions.map((question) => {
      const value = answers[question.id]
      return `${question.label}：${Array.isArray(value) ? value.join('、') : value || '未填写'}`
    })
    onSubmit(`【已填写 ${form.id}】\n${parts.join('\n')}`)
  }
  if (completed || form.status === 'completed') return <p className="mt-2 text-xs text-[var(--market-text-secondary)]">已填写</p>
  return <form onSubmit={submit} className="mt-3 space-y-3" aria-label={form.title}>
    <p className="text-sm font-medium">{form.title}</p>
    {form.questions.map((question) => <fieldset key={question.id} disabled={disabled} className="space-y-1.5">
      <legend className="text-xs">{question.label}</legend>
      {question.type === 'text' ? <input type="text" required={question.required} maxLength={200} value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} className="h-10 w-full rounded-lg border-[0.5px] border-[var(--market-border)] bg-[var(--market-surface)] px-3 text-sm" /> : <div className="flex flex-wrap gap-2">{question.options?.map((option) => <label key={option.value} className="flex min-h-10 items-center gap-1.5 rounded-full border-[0.5px] border-[var(--market-border)] px-3 text-xs hover:bg-[var(--market-hover)]"><input type={question.type === 'single' ? 'radio' : 'checkbox'} name={question.id} value={option.value} required={question.type === 'single' && question.required} checked={question.type === 'single' ? answers[question.id] === option.value : (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).includes(option.value))} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: question.type === 'single' ? option.value : event.target.checked ? [...(Array.isArray(current[question.id]) ? current[question.id] as string[] : []), option.value] : (Array.isArray(current[question.id]) ? current[question.id] as string[] : []).filter((value) => value !== option.value) }))} />{option.label}</label>)}</div>}
    </fieldset>)}
    <button type="submit" disabled={disabled} className="min-h-10 rounded-full bg-[var(--market-ink)] px-4 text-xs text-[var(--market-surface)] disabled:opacity-40">提交</button>
  </form>
}

export function MessageForms({ message, messages }: { message: AiChatMessage; messages: AiChatMessage[] }) {
  const { sendAiMessage, isAiThinking } = useOmnilink()
  return <>{message.blocks?.flatMap((block) => block.type === 'interactive_form' ? [<InteractiveForm key={block.id} form={block.data} disabled={isAiThinking} completed={messages.some((item) => item.isUser && item.text.startsWith(`【已填写 ${block.data.id}】`))} onSubmit={(answer) => sendAiMessage(answer, [], true, undefined, 'personal-advisor')} />] : [])}</>
}
