import { PROFILE_QUESTIONS } from './profile-intake'
import { nextShoppingPreferenceQuestion, SHOPPING_PREFERENCE_QUESTIONS, type ShoppingPreferences } from './shopping-preferences'
import {
  answerShoppingPreferenceLadderStep,
  answerShoppingPreferenceQuestion,
  buildShoppingPreferenceProfile,
  emptyShoppingPreferenceSurvey,
  readShoppingPreferenceSurvey,
  skipShoppingPreferenceQuestion,
  type ShoppingPreferenceProfile,
  type ShoppingPreferenceSurvey,
} from './shopping-preference-survey'

export const EVA_SERVICES = [
  { id: 'clothing', label: '穿搭与衣橱' },
  { id: 'skin', label: '护肤' },
  { id: 'hair', label: '头发与造型' },
] as const

export type EvaService = typeof EVA_SERVICES[number]['id']
export type EvaStage = 'basic' | 'api' | 'choice' | 'quiz' | 'preferences' | 'done'
export type EvaProfile = {
  name: string
  assistantName: string
  avatarUrl: string
  ageRange: string
  gender: string
  service: EvaService | null
  answers: Record<string, string>
  stage: EvaStage
  memories: { id: string; domain: EvaService | 'space' | 'other'; text: string; origin?: 'user' | 'inferred'; status?: 'active' | 'rejected'; evidence?: string | null; sourceMessageId?: string | null }[]
  preferences: { clothing: string; other: string }
  shoppingPreferences: ShoppingPreferences
  shoppingPreferenceSurvey: ShoppingPreferenceSurvey
  shoppingPreferenceProfile: ShoppingPreferenceProfile | null
}

export const emptyEvaProfile: EvaProfile = { name: '', assistantName: '个人助手', avatarUrl: '', ageRange: '', gender: '', service: null, answers: {}, stage: 'basic', memories: [], preferences: { clothing: '', other: '' }, shoppingPreferences: {}, shoppingPreferenceSurvey: { ...emptyShoppingPreferenceSurvey, answers: {}, skipped: [], ladders: {} }, shoppingPreferenceProfile: null }

export function parseEvaMemoryCandidate(value: unknown, prompt: string, activeIds: string[]) {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const text = typeof item.text === 'string' ? item.text.trim() : ''
  const domain = typeof item.domain === 'string' ? item.domain : ''
  const origin = item.origin
  const evidence = typeof item.evidence === 'string' ? item.evidence.trim() : ''
  const supports = Array.isArray(item.supports) ? [...new Set(item.supports.filter((id): id is string => typeof id === 'string' && activeIds.includes(id)))] : []
  if (!text || text.length > 120 || !['clothing', 'skin', 'hair', 'space', 'other'].includes(domain)) return null
  if (origin === 'user' && (!evidence || !prompt.includes(evidence))) return null
  if (origin === 'inferred' && supports.length < 2) return null
  if (origin !== 'user' && origin !== 'inferred') return null
  const supersedeIds = /(不|改|纠正|错|不是)/.test(prompt) && Array.isArray(item.supersedeIds)
    ? [...new Set(item.supersedeIds.filter((id): id is string => typeof id === 'string' && activeIds.includes(id)))] : []
  return { text, domain: domain as EvaProfile['memories'][number]['domain'], origin, evidence, supports, supersedeIds }
}

export function questionsForService(service: EvaService) {
  return PROFILE_QUESTIONS.filter((question) => question.domain === service)
}

export function readEvaProfile(value: unknown): EvaProfile {
  if (!value || typeof value !== 'object') return { ...emptyEvaProfile }
  const data = value as Partial<EvaProfile>
  const shoppingPreferences: ShoppingPreferences = {}
  if (data.shoppingPreferences && typeof data.shoppingPreferences === 'object') {
    for (const question of SHOPPING_PREFERENCE_QUESTIONS) {
      const answer = (data.shoppingPreferences as Record<string, unknown>)[question.key]
      if (typeof answer === 'string' && [...question.options, '跳过'].some((option) => option === answer)) {
        shoppingPreferences[question.key] = answer
      }
    }
  }
  return {
    name: typeof data.name === 'string' ? data.name : '',
    assistantName: typeof data.assistantName === 'string' && data.assistantName.trim() ? data.assistantName.trim().slice(0, 24) : '个人助手',
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl.slice(0, 2048) : '',
    ageRange: typeof data.ageRange === 'string' ? data.ageRange : '',
    gender: typeof data.gender === 'string' ? data.gender : '',
    service: EVA_SERVICES.some((service) => service.id === data.service) ? data.service! : null,
    answers: data.answers && typeof data.answers === 'object' ? data.answers : {},
    stage: data.stage === 'choice' || data.stage === 'quiz'
      ? 'preferences'
      : ['basic', 'api', 'preferences', 'done'].includes(data.stage ?? '') ? data.stage! : 'basic',
    memories: Array.isArray(data.memories) ? data.memories.filter((item) => item && typeof item.id === 'string' && typeof item.text === 'string' && ['clothing', 'skin', 'hair', 'space', 'other'].includes(item.domain)).slice(0, 50) : [],
    preferences: data.preferences && typeof data.preferences.clothing === 'string' && typeof data.preferences.other === 'string'
      ? { clothing: data.preferences.clothing, other: data.preferences.other }
      : {
          clothing: PROFILE_QUESTIONS.filter((item) => item.domain === 'clothing').map((item) => data.answers?.[item.key] ? `${item.prompt}：${data.answers[item.key]}` : '').filter(Boolean).join('\n'),
          other: PROFILE_QUESTIONS.filter((item) => item.domain === 'skin' || item.domain === 'hair').map((item) => data.answers?.[item.key] ? `${item.prompt}：${data.answers[item.key]}` : '').filter(Boolean).join('\n'),
        },
    shoppingPreferences,
    shoppingPreferenceSurvey: readShoppingPreferenceSurvey(data.shoppingPreferenceSurvey),
    shoppingPreferenceProfile: buildShoppingPreferenceProfile(data.shoppingPreferenceSurvey),
  }
}

export function editEvaProfile(current: EvaProfile, body: Record<string, unknown>): EvaProfile {
  const profile = readEvaProfile(current)
  if (body.action === 'update') {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 40) throw new Error('请填写 40 字以内的称呼。')
    profile.name = name
    profile.ageRange = typeof body.ageRange === 'string' ? body.ageRange.trim().slice(0, 40) : ''
    profile.gender = typeof body.gender === 'string' ? body.gender.trim().slice(0, 40) : ''
    const preferences = body.preferences && typeof body.preferences === 'object' ? body.preferences as Record<string, unknown> : {}
    const clothing = typeof preferences.clothing === 'string' ? preferences.clothing.trim() : ''
    const other = typeof preferences.other === 'string' ? preferences.other.trim() : ''
    if (clothing.length > 2000 || other.length > 2000) throw new Error('每个填写框请控制在 2000 字以内。')
    profile.preferences = { clothing, other }
  } else if (body.action === 'memory') {
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text || text.length > 120) throw new Error('请输入 120 字以内的记忆。')
    if (!['clothing', 'skin', 'hair', 'other'].includes(String(body.domain))) throw new Error('请选择记忆类别。')
    if (profile.memories.length >= 50) throw new Error('记忆已达到 50 条。')
    profile.memories = [...profile.memories, { id: crypto.randomUUID(), domain: body.domain as EvaService | 'other', text }]
  } else if (body.action === 'forget') {
    if (typeof body.id !== 'string') throw new Error('记忆不存在。')
    profile.memories = profile.memories.filter((item) => item.id !== body.id)
  } else throw new Error('操作无效。')
  return profile
}

export function advanceEvaProfile(current: EvaProfile, body: Record<string, unknown>): EvaProfile {
  const profile = { ...readEvaProfile(current), answers: { ...current.answers } }
  if (body.action === 'basic') {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length > 40) throw new Error('称呼请控制在 40 字以内。')
    if (name) profile.name = name
    const assistantName = typeof body.assistantName === 'string' ? body.assistantName.trim() : profile.assistantName
    if (!assistantName || assistantName.length > 24) throw new Error('请填写 24 字以内的助手称呼。')
    profile.assistantName = assistantName
    if (typeof body.avatarUrl === 'string') profile.avatarUrl = body.avatarUrl.slice(0, 2048)
    if (typeof body.ageRange === 'string' && ['18 岁以下', '18–24 岁', '25–34 岁', '35–44 岁', '45 岁以上', '不填写'].includes(body.ageRange)) profile.ageRange = body.ageRange
    if (typeof body.gender === 'string' && ['女', '男', '其他', '不填写'].includes(body.gender)) profile.gender = body.gender
    profile.stage = 'api'
  } else if (body.action === 'complete-onboarding') {
    if (profile.stage !== 'api' && profile.stage !== 'done') throw new Error('请先完成个人资料。')
    if (!profile.assistantName) throw new Error('请先完成个人资料。')
    profile.stage = 'done'
  } else if (body.action === 'preference') {
    if (profile.stage !== 'preferences') throw new Error('当前没有待回答的问题。')
    const question = nextShoppingPreferenceQuestion(profile.shoppingPreferences)
    if (!question || question.key !== body.key) throw new Error('请按顺序回答当前问题。')
    if (typeof body.answer !== 'string' || ![...question.options, '跳过'].includes(body.answer)) throw new Error('请选择当前问题的选项。')
    profile.shoppingPreferences = { ...profile.shoppingPreferences, [question.key]: body.answer }
    if (SHOPPING_PREFERENCE_QUESTIONS.every((item) => item.key in profile.shoppingPreferences)) profile.stage = 'done'
  } else if (body.action === 'shopping-preference-answer') {
    profile.shoppingPreferenceSurvey = answerShoppingPreferenceQuestion(profile.shoppingPreferenceSurvey, String(body.key ?? ''), body.answer)
    profile.shoppingPreferenceProfile = buildShoppingPreferenceProfile(profile.shoppingPreferenceSurvey)
    if (profile.shoppingPreferenceSurvey.status === 'complete') profile.stage = 'done'
  } else if (body.action === 'shopping-preference-ladder') {
    if (body.answer !== 'premium' && body.answer !== 'base') throw new Error('请选择当前溢价档位。')
    profile.shoppingPreferenceSurvey = answerShoppingPreferenceLadderStep(profile.shoppingPreferenceSurvey, String(body.key ?? ''), body.answer)
    profile.shoppingPreferenceProfile = buildShoppingPreferenceProfile(profile.shoppingPreferenceSurvey)
    if (profile.shoppingPreferenceSurvey.status === 'complete') profile.stage = 'done'
  } else if (body.action === 'shopping-preference-skip') {
    profile.shoppingPreferenceSurvey = skipShoppingPreferenceQuestion(profile.shoppingPreferenceSurvey, String(body.key ?? ''))
    profile.shoppingPreferenceProfile = buildShoppingPreferenceProfile(profile.shoppingPreferenceSurvey)
    if (profile.shoppingPreferenceSurvey.status === 'complete') profile.stage = 'done'
  } else if (body.action === 'shopping-preference-pause') {
    profile.shoppingPreferenceSurvey = { ...profile.shoppingPreferenceSurvey, status: 'paused', updatedAt: new Date().toISOString() }
    profile.shoppingPreferenceProfile = buildShoppingPreferenceProfile(profile.shoppingPreferenceSurvey)
    profile.stage = 'done'
  } else if (body.action === 'shopping-preference-reset') {
    profile.shoppingPreferenceSurvey = { ...emptyShoppingPreferenceSurvey, answers: {}, skipped: [], ladders: {} }
    profile.shoppingPreferenceProfile = null
    profile.stage = 'done'
  } else if (body.action === 'service') {
    if (profile.stage !== 'choice') throw new Error('请先填写个人信息。')
    if (body.service === 'browse') profile.stage = 'done'
    else if (EVA_SERVICES.some((item) => item.id === body.service)) {
      profile.service = body.service as EvaService
      profile.stage = 'quiz'
    } else throw new Error('请选择一项服务。')
  } else if (body.action === 'answer') {
    if (profile.stage !== 'quiz' || !profile.service) throw new Error('当前没有待回答的问题。')
    const questions = questionsForService(profile.service)
    const next = questions.find((question) => !(question.key in profile.answers))
    if (!next || typeof body.answer !== 'string' || ![...next.options, '跳过'].includes(body.answer)) throw new Error('请选择当前问题的选项。')
    profile.answers[next.key] = body.answer
    if (questions.every((question) => question.key in profile.answers)) profile.stage = 'done'
  } else throw new Error('操作无效。')
  return profile
}
