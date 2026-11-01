import questionBank from './shopping-preference-survey/questions.json'
import weightRules from './shopping-preference-survey/weights.json'

type QuestionOption = { label: string; value: string | number }
export type ShoppingPreferenceQuestion = {
  id: string
  domain: string
  type: 'single_choice' | 'numeric' | 'pairwise' | 'ladder' | 'multi_choice'
  required: boolean
  prompt: string
  hint?: string
  field?: string
  options?: QuestionOption[]
  left?: QuestionOption
  right?: QuestionOption
  tie_option?: QuestionOption
  steps?: { pct: number; options: QuestionOption[] }[]
  min?: number
  max?: number
  max_select?: number
  depends_on?: Record<string, 'at_least_one' | 'at_least_two'>
}

const questionData = questionBank as unknown as { questions: ShoppingPreferenceQuestion[] }
export const SHOPPING_PREFERENCE_DEEP_QUESTIONS = questionData.questions
export const SHOPPING_PREFERENCE_DEEP_VERSION = '1.1.0'

export type ShoppingPreferenceSurvey = {
  version: string
  status: 'not_started' | 'in_progress' | 'paused' | 'complete'
  answers: Record<string, unknown>
  skipped: string[]
  ladders: Record<string, { step: number; premiumPct: number; done: boolean; capped: boolean }>
  updatedAt: string | null
}

export type ShoppingPreferenceProfile = {
  version: string
  status: ShoppingPreferenceSurvey['status']
  completedAt: string | null
  preferences: Record<string, unknown>
}

export const emptyShoppingPreferenceSurvey: ShoppingPreferenceSurvey = {
  version: SHOPPING_PREFERENCE_DEEP_VERSION,
  status: 'not_started',
  answers: {},
  skipped: [],
  ladders: {},
  updatedAt: null,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function isValidShoppingPreferenceAnswer(question: ShoppingPreferenceQuestion, value: unknown): boolean {
  if (question.type === 'numeric') return typeof value === 'number' && Number.isFinite(value) && value >= (question.min ?? 0) && value <= (question.max ?? Number.MAX_SAFE_INTEGER)
  if (question.type === 'multi_choice') {
    if (!Array.isArray(value) || value.length > (question.max_select ?? Infinity)) return false
    const allowed = new Set((question.options ?? []).map((option) => option.value))
    return value.every((item) => allowed.has(item as string | number)) && new Set(value).size === value.length
  }
  if (question.type === 'pairwise') return [question.left?.value, question.right?.value, question.tie_option?.value].includes(value as string | number)
  if (question.type === 'ladder') return typeof value === 'number' && (value === 0 || (question.steps ?? []).some((step) => step.pct === value))
  return (question.options ?? []).some((option) => option.value === value)
}

export function readShoppingPreferenceSurvey(value: unknown): ShoppingPreferenceSurvey {
  if (!isRecord(value)) return { ...emptyShoppingPreferenceSurvey, answers: {}, skipped: [], ladders: {} }
  const rawAnswers = isRecord(value.answers) ? value.answers : {}
  const answers: Record<string, unknown> = {}
  for (const question of SHOPPING_PREFERENCE_DEEP_QUESTIONS) {
    if (isValidShoppingPreferenceAnswer(question, rawAnswers[question.id])) answers[question.id] = rawAnswers[question.id]
  }
  const skipped = Array.isArray(value.skipped)
    ? [...new Set(value.skipped.filter((id): id is string => typeof id === 'string' && SHOPPING_PREFERENCE_DEEP_QUESTIONS.some((question) => question.id === id) && !(id in answers)))]
    : []
  const ladders: ShoppingPreferenceSurvey['ladders'] = {}
  if (isRecord(value.ladders)) {
    for (const id of ['D1', 'D2']) {
      const ladder = value.ladders[id]
      if (!isRecord(ladder)) continue
      const step = typeof ladder.step === 'number' ? Math.max(0, Math.min(4, Math.floor(ladder.step))) : 0
      const premiumPct = typeof ladder.premiumPct === 'number' && [0, 10, 20, 35, 50].includes(ladder.premiumPct) ? ladder.premiumPct : 0
      ladders[id] = { step, premiumPct, done: ladder.done === true, capped: ladder.capped === true }
    }
  }
  const status = ['not_started', 'in_progress', 'paused', 'complete'].includes(String(value.status))
    ? value.status as ShoppingPreferenceSurvey['status'] : Object.keys(answers).length ? 'in_progress' : 'not_started'
  return {
    version: SHOPPING_PREFERENCE_DEEP_VERSION,
    status,
    answers,
    skipped,
    ladders,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
  }
}

export function applicableShoppingPreferenceQuestions(survey: ShoppingPreferenceSurvey) {
  const styleAnswer = survey.answers.E1
  const styles = Array.isArray(styleAnswer) ? styleAnswer : []
  const styleWasSkipped = survey.skipped.includes('E1')
  return SHOPPING_PREFERENCE_DEEP_QUESTIONS.filter((question) => {
    if (question.id === 'E2') return !styleWasSkipped && (!('E1' in survey.answers) || styles.length >= 1)
    if (question.id === 'E3') return !styleWasSkipped && (!('E1' in survey.answers) || styles.length >= 2)
    return true
  })
}

export function nextShoppingPreferenceDeepQuestion(surveyValue: unknown) {
  const survey = readShoppingPreferenceSurvey(surveyValue)
  return applicableShoppingPreferenceQuestions(survey).find((question) => !(question.id in survey.answers) && !survey.skipped.includes(question.id)) ?? null
}

export function shoppingPreferenceSurveyProgress(surveyValue: unknown) {
  const survey = readShoppingPreferenceSurvey(surveyValue)
  const questions = applicableShoppingPreferenceQuestions(survey)
  const completeCount = questions.filter((question) => question.id in survey.answers || survey.skipped.includes(question.id)).length
  return { completed: completeCount, total: questions.length, percent: questions.length ? Math.round((completeCount / questions.length) * 100) : 0 }
}

export function answerShoppingPreferenceQuestion(surveyValue: unknown, questionId: string, value: unknown): ShoppingPreferenceSurvey {
  const survey = readShoppingPreferenceSurvey(surveyValue)
  const question = nextShoppingPreferenceDeepQuestion(survey)
  if (!question || question.id !== questionId) throw new Error('请按顺序回答当前问题。')
  if (!isValidShoppingPreferenceAnswer(question, value)) throw new Error('答案格式与当前问题不符。')
  const next: ShoppingPreferenceSurvey = { ...survey, answers: { ...survey.answers, [questionId]: value }, skipped: survey.skipped.filter((id) => id !== questionId), status: 'in_progress', updatedAt: new Date().toISOString() }
  if (question.type === 'ladder') {
    next.ladders = { ...survey.ladders, [questionId]: { step: (question.steps ?? []).length, premiumPct: value as number, done: true, capped: value === 50 } }
  }
  if (!nextShoppingPreferenceDeepQuestion(next)) next.status = 'complete'
  return next
}

export function answerShoppingPreferenceLadderStep(surveyValue: unknown, questionId: string, answer: 'premium' | 'base') {
  const survey = readShoppingPreferenceSurvey(surveyValue)
  const question = nextShoppingPreferenceDeepQuestion(survey)
  if (!question || question.id !== questionId || question.type !== 'ladder') throw new Error('当前没有待回答的溢价阶梯。')
  const steps = question.steps ?? []
  const progress = survey.ladders[questionId] ?? { step: 0, premiumPct: 0, done: false, capped: false }
  const step = steps[progress.step]
  if (!step) throw new Error('溢价阶梯状态无效。')
  const premiumPct = answer === 'premium' ? step.pct : progress.premiumPct
  const done = answer === 'base' || progress.step === steps.length - 1
  const next: ShoppingPreferenceSurvey = {
    ...survey,
    answers: done ? { ...survey.answers, [questionId]: premiumPct } : { ...survey.answers },
    ladders: { ...survey.ladders, [questionId]: { step: done ? steps.length : progress.step + 1, premiumPct, done, capped: answer === 'premium' && progress.step === steps.length - 1 } },
    status: 'in_progress',
    updatedAt: new Date().toISOString(),
  }
  if (!nextShoppingPreferenceDeepQuestion(next)) next.status = 'complete'
  return next
}

export function skipShoppingPreferenceQuestion(surveyValue: unknown, questionId: string) {
  const survey = readShoppingPreferenceSurvey(surveyValue)
  const question = nextShoppingPreferenceDeepQuestion(survey)
  if (!question || question.id !== questionId) throw new Error('请按顺序跳过当前问题。')
  const next: ShoppingPreferenceSurvey = {
    ...survey,
    skipped: [...new Set([...survey.skipped, questionId])],
    ladders: { ...survey.ladders },
    status: 'in_progress',
    updatedAt: new Date().toISOString(),
  }
  if (!nextShoppingPreferenceDeepQuestion(next)) next.status = 'complete'
  return next
}

export function buildShoppingPreferenceProfile(surveyValue: unknown): ShoppingPreferenceProfile | null {
  const survey = readShoppingPreferenceSurvey(surveyValue)
  if (!Object.keys(survey.answers).length) return null
  const answers = survey.answers
  const profile: Record<string, Record<string, unknown>> = {
    price_anchor: {}, value_definition: {}, tradeoff_weights: {}, style_intensity: {}, category_context: {},
  }
  const put = (section: string, key: string, questionId: string) => {
    if (questionId in answers) profile[section][key] = answers[questionId]
  }
  put('price_anchor', 'category', 'A1')
  put('price_anchor', 'reference_price', 'A2')
  put('price_anchor', 'reference_consistency', 'A3')
  put('price_anchor', 'doubt_multiplier', 'B1')
  put('price_anchor', 'bargain_multiplier', 'B2')
  put('price_anchor', 'expensive_multiplier', 'B3')
  put('price_anchor', 'reject_multiplier', 'B4')

  const pairRules = (weightRules as unknown as { value_order: { dimensions: string[]; pairs: { id: string; a: string; b: string; repeat_of?: string }[] } }).value_order
  const scores: Record<string, number> = Object.fromEntries(pairRules.dimensions.map((dimension) => [dimension, 0]))
  const scoredPairs = pairRules.pairs.filter((pair) => pair.id in answers && (!pair.repeat_of || !(pair.repeat_of in answers)))
  for (const pair of scoredPairs) {
    const choice = answers[pair.id]
    if (choice === 'tie') { scores[pair.a] += 0.5; scores[pair.b] += 0.5 }
    else if (choice === pair.a || choice === pair.b) scores[String(choice)] += 1
  }
  const scoreTotal = Object.values(scores).reduce((sum, score) => sum + score, 0)
  const pairCount = pairRules.pairs.filter((pair) => pair.id in answers).length
  const reverseChoice = answers.C6
  const orderBiasDetected = 'C2' in answers && 'C6' in answers && answers.C2 !== reverseChoice
  if (scoreTotal > 0) profile.value_definition.weights = Object.fromEntries(Object.entries(scores).map(([dimension, score]) => [dimension, Math.round(score / scoreTotal * 100)]))
  profile.value_definition.answered_pairs = pairCount
  profile.value_definition.complete = pairCount === 6
  profile.value_definition.order_bias_detected = orderBiasDetected
  profile.value_definition.confidence = pairCount >= 6 && !orderBiasDetected ? 'high' : pairCount >= 4 ? 'medium' : pairCount ? 'low' : null

  const qualityPct = typeof answers.D1 === 'number' ? answers.D1 : null
  const designPct = typeof answers.D2 === 'number' ? answers.D2 : null
  if (qualityPct !== null) profile.tradeoff_weights.quality_premium_max_pct = qualityPct
  if (designPct !== null) profile.tradeoff_weights.design_premium_max_pct = designPct
  if ('D1' in survey.ladders) profile.tradeoff_weights.quality_capped = survey.ladders.D1.capped
  if ('D2' in survey.ladders) profile.tradeoff_weights.design_capped = survey.ladders.D2.capped
  if (qualityPct !== null && designPct !== null) {
    const qualityRoot = Math.sqrt(qualityPct)
    const designRoot = Math.sqrt(designPct)
    const total = qualityRoot + designRoot
    if (total > 0) {
      profile.tradeoff_weights.quality_weight = Math.round(qualityRoot / total * 1000) / 10
      profile.tradeoff_weights.design_weight = Math.round(designRoot / total * 1000) / 10
    }
    profile.tradeoff_weights.priority = qualityPct === 0 && designPct === 0
      ? 'balanced'
      : qualityPct >= designPct * 1.5 ? 'quality_dominant' : designPct >= qualityPct * 1.5 ? 'design_dominant' : 'balanced'
  }

  put('style_intensity', 'styles', 'E1')
  put('style_intensity', 'top_strength', 'E2')
  put('style_intensity', 'second_strength', 'E3')
  put('style_intensity', 'exceptions', 'E4')
  put('style_intensity', 'color_preference', 'E5')
  if (Array.isArray(answers.E4)) profile.style_intensity.rigidity = answers.E4.includes('none') ? 'rigid' : 'flexible'

  put('category_context', 'categories', 'F1')
  put('category_context', 'scenarios', 'F2')
  put('category_context', 'mode', 'F3')

  const bands = ['doubt_multiplier', 'bargain_multiplier', 'expensive_multiplier', 'reject_multiplier']
  const bandValues = bands.map((key) => profile.price_anchor[key]).filter((value): value is number => typeof value === 'number')
  if (bandValues.length === 4) {
    const [doubt, bargain, expensive, reject] = bandValues
    const consistent = doubt < bargain && bargain < expensive && expensive < reject
    profile.price_anchor.price_band_consistent = consistent
    if (!consistent) {
      profile.price_anchor.consistency_issues = bands.slice(0, -1).flatMap((key, index) => bandValues[index] >= bandValues[index + 1] ? [[key, bands[index + 1]]] : [])
    } else {
      profile.price_anchor.acceptable_low = bargain
      profile.price_anchor.acceptable_high = expensive
      profile.price_anchor.suspicion_gap = bargain - doubt
      profile.price_anchor.stretch_gap = reject - expensive
    }
    if (consistent && bargain > 0) {
      const sensitivity = (expensive - bargain) / bargain
      profile.price_anchor.sensitivity = sensitivity <= 0.5 ? 'high' : sensitivity <= 1 ? 'medium' : 'low'
    }
  }

  return { version: SHOPPING_PREFERENCE_DEEP_VERSION, status: survey.status, completedAt: survey.status === 'complete' ? survey.updatedAt : null, preferences: profile }
}
