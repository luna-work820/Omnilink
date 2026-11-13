import { SHOPPING_PREFERENCE_DEEP_QUESTIONS } from './shopping-preference-survey'
import type { AiAssistantProfile } from './ai-assistant-profile'
import type { ShoppingPreferenceSurvey } from './shopping-preference-survey'

export function assessmentEvidenceKey(survey:Pick<ShoppingPreferenceSurvey,'version'|'answers'|'skipped'>) {
  return JSON.stringify({version:survey.version,answers:Object.fromEntries(Object.entries(survey.answers).sort(([a],[b])=>a.localeCompare(b))
    .map(([key,value])=>[key,Array.isArray(value)?[...value].sort():value])),skipped:[...survey.skipped].sort()})
}

export async function assessmentMemoryProposal(profile: AiAssistantProfile) {
  const survey = profile.shoppingPreferenceSurvey
  if (survey.status !== 'complete' || !Object.keys(survey.answers).length) return null
  const parts: string[] = []
  const priority=['E1','E5','D1','D2']
  const questions=[...SHOPPING_PREFERENCE_DEEP_QUESTIONS].sort((a,b) => {
    const ai=priority.indexOf(a.id),bi=priority.indexOf(b.id)
    return (ai<0?100:ai)-(bi<0?100:bi)
  })
  for (const question of questions) {
    const answer = survey.answers[question.id]
    if (answer === undefined || survey.skipped.includes(question.id)) continue
    const choices = [...(question.options ?? []), ...[question.left, question.right, question.tie_option].filter((item) => item !== undefined)]
    const label = (value: unknown) => choices.find((option) => option.value === value)?.label ?? String(value)
    const value = Array.isArray(answer) ? answer.map(label).join('、') : label(answer)
    const part = `${question.prompt}：${value}`
    if (`购物偏好评测：${[...parts, part].join('；')}`.length <= 240) parts.push(part)
  }
  if (!parts.length) return null
  const canonical=assessmentEvidenceKey(survey)
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical))
  const assessmentId=Array.from(new Uint8Array(digest),(byte) => byte.toString(16).padStart(2,'0')).join('')
  const styleTerms:Record<string,string[]>={极简:['极简','简约','简洁','minimal'],复古:['复古','vintage','retro'],通勤:['通勤','日常','office'],街头:['街头','street'],运动:['运动','sport'],甜美:['甜美','soft']}
  const positiveTerms=Array.isArray(survey.answers.E1)?survey.answers.E1.flatMap((value) => typeof value==='string'?(styleTerms[value]??[value]):[]):[]
  const supersedeIds=profile.memories.filter((m) => m.status==='active' && m.sourceKind==='assessment' && m.sourcePayload?.answers).map((m) => m.id)
  return {
    text: `购物偏好评测：${parts.join('；')}`,
    domain: 'other' as const, origin: 'inferred' as const, sourceKind: 'assessment' as const,
    evidence: '购物偏好评测结果，须确认后才能用于长期推荐',
    sourcePayload: { assessmentId,assessmentVersion: survey.version, answers: survey.answers, skipped: survey.skipped,
      preferenceSignals:{positiveTerms,avoidTerms:[]} },
    supersedeIds,
  }
}
