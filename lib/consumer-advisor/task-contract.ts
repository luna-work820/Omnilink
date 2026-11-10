import { isProfileGoal, nextMissingProfileQuestion, nextProfileQuestion, PROFILE_QUESTIONS, profileQuestionOptions, type AdvisorProfile } from './profile-intake'

export const PERSONAL_ADVISOR_SKILL_VERSION = '1.1.0'

export type AdvisorTaskStatus = 'waiting_for_user' | 'running' | 'completed' | 'failed' | 'cancelled'
export type AdvisorStepStatus = 'pending' | 'running' | 'waiting_for_user' | 'completed' | 'failed' | 'skipped'

export type AdvisorProduct = {
  id: string
  name: string
  price: number
  currency: string
  category: string
  image: string | null
  storeName: string
  storeSlug: string | null
  source: 'published' | 'demo_snapshot'
  description: string
}

export type AdvisorLook = {
  title: string
  reason: string
  productIds: string[]
  total: number
  currency: string
}

export type AdvisorResult = {
  summary: string
  looks: AdvisorLook[]
  products: AdvisorProduct[]
  unknowns: string[]
  budget: number | null
  source: 'published' | 'demo_snapshot' | 'mixed'
  mode: 'model' | 'catalog_fallback' | 'profile'
  profile?: AdvisorProfile
}

export type AdvisorTask = {
  id: string
  goal: string
  answers: string[]
  status: AdvisorTaskStatus
  question: string | null
  result: AdvisorResult | null
  errorMessage: string | null
  revision: number
  updatedAt: string
  preview?: boolean
  steps: Array<{ stepNo: number; label: string; status: AdvisorStepStatus; outputSummary: string | null }>
}

type ChoiceQuestion = { prompt: string; options: readonly string[] }

const STYLE_DISCOVERY_QUESTIONS: readonly ChoiceQuestion[] = [
  { prompt: '下面哪种穿搭，你最愿意在日常穿出门？', options: ['简洁利落', '柔和松弛', '复古有细节', '还不确定'] },
  { prompt: '挑衣服时，你通常先看重什么？', options: ['活动方便', '版型和线条', '有趣的细节', '容易搭配现有衣服'] },
  { prompt: '你的衣橱里最常穿哪类颜色？', options: ['黑白灰', '米色和大地色', '明亮或对比色', '没有固定偏好'] },
]

const STYLING_CHOICE_QUESTION: ChoiceQuestion = {
  prompt: '这次搭配，你最想优先满足什么？',
  options: ['搭配已有衣物', '穿着舒适方便', '突出喜欢的风格', '还不确定'],
}

export const ADVISOR_QUESTION = STYLING_CHOICE_QUESTION.prompt

export function isStyleDiscoveryGoal(text: string): boolean {
  return /(我的风格|个人风格|穿衣风格|风格测试|风格定位|找.{0,4}风格|判断.{0,4}风格)/.test(text)
}

export function isSkinCareGoal(goal: string): boolean {
  return /(护肤|皮肤|面霜|洁面|精华|保湿|控油|护肤品)/i.test(goal)
}

export function initialAdvisorQuestion(goal: string, profile?: AdvisorProfile | null): string | null {
  if (isProfileGoal(goal)) return PROFILE_QUESTIONS[0].prompt
  if (profile) return nextMissingProfileQuestion(goal, profile.selfReported) ?? (isSkinCareGoal(goal) ? null : isStyleDiscoveryGoal(goal) ? STYLE_DISCOVERY_QUESTIONS[0].prompt : ADVISOR_QUESTION)
  return isStyleDiscoveryGoal(goal) ? STYLE_DISCOVERY_QUESTIONS[0].prompt : ADVISOR_QUESTION
}

export function advisorQuestionOptions(question: string | null): readonly string[] {
  return profileQuestionOptions(question).length ? profileQuestionOptions(question)
    : [...STYLE_DISCOVERY_QUESTIONS, STYLING_CHOICE_QUESTION].find((item) => item.prompt === question)?.options ?? []
}

export function nextAdvisorQuestion(goal: string, question: string | null, profile?: AdvisorProfile | null): string | null {
  if (isProfileGoal(goal)) return nextProfileQuestion(question)
  if (profile) return nextMissingProfileQuestion(goal, profile.selfReported, question)
  if (isSkinCareGoal(goal)) return null
  if (!isStyleDiscoveryGoal(goal)) return null
  const index = STYLE_DISCOVERY_QUESTIONS.findIndex((item) => item.prompt === question)
  return index >= 0 ? STYLE_DISCOVERY_QUESTIONS[index + 1]?.prompt ?? null : null
}

export function styleDirectionFromAnswers(goal: string, answers: string[]): string | null {
  if (!isStyleDiscoveryGoal(goal)) return null
  const first = answers[0]
  const direction = first === '简洁利落' ? '简洁利落' : first === '柔和松弛' ? '柔和松弛' : first === '复古有细节' ? '复古细节' : null
  return direction ? `从你的选择看，可以先探索「${direction}」方向；这只是目前的穿衣偏好，不是固定风格标签。` : '你还没有确定偏好的风格方向，可以从日常愿意穿的单品开始尝试。'
}

export function styleDiscoveryProductScore(product: AdvisorProduct, answers: string[]): number {
  const words = `${product.name} ${product.description}`
  const preference = answers[0]
  let score = 0
  if (preference === '简洁利落') {
    const positive = /极简|简约|纯色|素色|几何|利落|深灰|黑白灰/.test(words) ? 4 : 0
    const negative = /汉服|国风|新中式|重工|亮片|蕾丝|花纱|朋克|流苏|公主/.test(words) ? 5 : 0
    score = positive - negative
  }
  if (preference === '柔和松弛') score = (/宽松|休闲|针织|亚麻|柔软|松弛/.test(words) ? 4 : 0) - (/重工|亮片|朋克/.test(words) ? 5 : 0)
  if (preference === '复古有细节') score = /复古|vintage|国风|新中式|肌理|做旧/.test(words) ? 4 : 0
  if (answers.includes('活动方便') && /宽松|休闲|弹力|轻薄/.test(words)) score += 1
  if (answers.includes('版型和线条') && /版型|剪裁|直筒|立领|线条|几何/.test(words)) score += 1
  if (answers.includes('有趣的细节') && /设计感|拼接|刺绣|肌理|花纹/.test(words)) score += 1
  if (answers.includes('容易搭配现有衣服') && /百搭|基础|纯色|素色/.test(words)) score += 1
  if (answers.includes('黑白灰') && /黑|白|灰/.test(words)) score += 1
  if (answers.includes('米色和大地色') && /米色|驼色|棕色|咖色|大地色/.test(words)) score += 1
  if (answers.includes('明亮或对比色') && /撞色|亮色|彩色|红色|绿色|蓝色/.test(words)) score += 1
  return score
}

export function readBudget(text: string): number | null {
  const matches = [...text.matchAll(/(?:预算(?:改成|调到|降低到|提高到|为|是)?|不超过|最多|控制在|上限)\s*(?:人民币|¥|￥)?\s*(\d{2,6})\s*(?:元|块)?/g)]
  return matches.length ? Number(matches[matches.length - 1][1]) : null
}

export function isStylingGoal(text: string): boolean {
  return /(穿搭|搭配|衣橱|服装|衣服|造型|形象管理|形象顾问|适合穿什么|护肤|皮肤|面霜|洁面|精华|保湿|控油|护肤品)/i.test(text) || isStyleDiscoveryGoal(text) || isProfileGoal(text)
}

export function isOutfitStylingGoal(text: string): boolean {
  return /(穿搭|穿衣搭配|衣橱|服装搭配|怎么穿|适合穿什么|整套造型|(?:搭配|配一套).{0,8}(?:衣服|衣物|衣橱|穿着|造型|风格|一套|鞋|裙|裤)|(?:衣服|衣物|衣橱|上衣|裤子|裙子|外套|鞋子|鞋|这件|这套).{0,8}(?:怎么搭|怎么配|搭配|穿|造型)|outfit|styling|what should i wear)/i.test(text)
}

export function parseAdvisorResult(raw: string, catalog: AdvisorProduct[], goal: string): AdvisorResult {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const value = JSON.parse(cleaned) as Record<string, unknown>
  const byId = new Map(catalog.map((product) => [product.id, product]))
  const budget = readBudget(goal)
  const currency = catalog[0]?.currency ?? 'CNY'
  const looks = Array.isArray(value.looks) ? value.looks.slice(0, 2).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const look = entry as Record<string, unknown>
    const ids = Array.isArray(look.productIds)
      ? [...new Set(look.productIds.filter((id): id is string => typeof id === 'string' && byId.has(id)))].slice(0, 3)
      : []
    if (!ids.length) return []
    const products = ids.map((id) => byId.get(id)!)
    if (products.some((product) => product.currency !== currency)) return []
    const total = products.reduce((sum, product) => sum + product.price, 0)
    if (budget !== null && total > budget) return []
    return [{
      title: typeof look.title === 'string' ? look.title.trim().slice(0, 80) : '搭配方案',
      reason: typeof look.reason === 'string' ? look.reason.trim().slice(0, 600) : '',
      productIds: ids,
      total,
      currency,
    }]
  }) : []
  const selectedIds = new Set(looks.flatMap((look) => look.productIds))
  const products = catalog.filter((product) => selectedIds.has(product.id))
  const sources = new Set(products.map((product) => product.source))
  return {
    summary: typeof value.summary === 'string' ? value.summary.trim().slice(0, 1000) : '',
    looks,
    products,
    unknowns: Array.isArray(value.unknowns)
      ? value.unknowns.filter((item): item is string => typeof item === 'string').slice(0, 4).map((item) => item.trim().slice(0, 160))
      : [],
    budget,
    source: sources.size > 1 ? 'mixed' : products[0]?.source ?? 'published',
    mode: 'model',
  }
}
