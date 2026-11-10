export const PROFILE_GOAL = '建立我的个人形象档案'

type ProfileDomain = 'priority' | 'clothing' | 'skin' | 'hair'
type ProfileKey = 'priority' | 'scene' | 'style' | 'colors' | 'fit' | 'changePace' | 'cleansingFeel' | 'productReaction' | 'skinGoal' | 'scalpOil' | 'hairTexture' | 'hairGoal' | 'hairTime'
type ProfileQuestion = { key: ProfileKey; domain: ProfileDomain; prompt: string; options: readonly string[] }

export const PROFILE_QUESTIONS: readonly ProfileQuestion[] = [
  { key: 'priority', domain: 'priority', prompt: '你最希望形象管理先帮你处理什么？', options: ['穿搭与衣橱', '护肤体验', '头发与造型', '先全面了解自己'] },
  { key: 'scene', domain: 'clothing', prompt: '一周里，你最常见的穿衣场景是？', options: ['工作与通勤', '校园与日常', '居家与休闲', '社交与活动', '每天变化很大'] },
  { key: 'style', domain: 'clothing', prompt: '目前你最愿意尝试哪种穿搭感觉？', options: ['简洁利落', '柔和松弛', '复古有细节', '大胆有表达', '还不确定'] },
  { key: 'colors', domain: 'clothing', prompt: '你的衣橱里最常穿哪类颜色？', options: ['黑白灰', '米色和大地色', '明亮或对比色', '各种颜色都穿'] },
  { key: 'fit', domain: 'clothing', prompt: '穿衣时，你通常喜欢什么松量？', options: ['偏贴身', '合体', '偏宽松', '看单品而定'] },
  { key: 'changePace', domain: 'clothing', prompt: '你希望怎样调整现在的穿衣方式？', options: ['从现有衣橱微调', '适度尝试新单品', '想明显改变', '还不确定'] },
  { key: 'cleansingFeel', domain: 'skin', prompt: '温和清洁后约半小时、不涂产品时，脸部通常是什么感觉？', options: ['大多舒适', '脸颊容易紧绷', '容易油亮', '局部紧绷又有油光', '没观察过'] },
  { key: 'productReaction', domain: 'skin', prompt: '使用普通护肤品后，你自己感觉有过刺痛、发痒或持续泛红吗？', options: ['没有明显不适', '偶尔出现', '反复出现', '不确定'] },
  { key: 'skinGoal', domain: 'skin', prompt: '目前你最想改善哪种日常护肤体验？', options: ['保湿与舒适', '减少油光', '简化护理步骤', '暂时没有目标'] },
  { key: 'scalpOil', domain: 'hair', prompt: '洗头后，头皮通常多久会明显出油？', options: ['当天', '第二天', '两三天后或更久', '不确定'] },
  { key: 'hairTexture', domain: 'hair', prompt: '自然风干、没有拉直或卷烫时，发丝更接近哪种形态？', options: ['直发', '波浪', '卷曲', '不确定'] },
  { key: 'hairGoal', domain: 'hair', prompt: '现在最希望头发护理帮你做到什么？', options: ['保持清爽', '柔顺少打结', '减少毛躁', '更蓬松', '暂时没有目标'] },
  { key: 'hairTime', domain: 'hair', prompt: '平日你愿意花多少时间打理头发？', options: ['少于 5 分钟', '5–15 分钟', '15 分钟以上', '看当天情况'] },
]

export type AdvisorProfile = {
  version: 1
  selfReported: Record<ProfileKey, string | null>
}

export const PROFILE_SECTIONS: readonly { label: string; keys: readonly ProfileKey[] }[] = [
  { label: '当前关注', keys: ['priority'] },
  { label: '穿衣与颜色', keys: ['scene', 'style', 'colors', 'fit', 'changePace'] },
  { label: '护肤体验', keys: ['cleansingFeel', 'productReaction', 'skinGoal'] },
  { label: '头发与头皮', keys: ['scalpOil', 'hairTexture', 'hairGoal', 'hairTime'] },
]

export function isProfileGoal(goal: string): boolean {
  return goal.trim() === PROFILE_GOAL
}

export function profileQuestionMeta(question: string | null) {
  const index = PROFILE_QUESTIONS.findIndex((item) => item.prompt === question)
  if (index < 0) return null
  const domain = PROFILE_QUESTIONS[index].domain
  const section = PROFILE_SECTIONS.find((item) => item.keys.includes(PROFILE_QUESTIONS[index].key))?.label ?? '个人资料'
  return { index: index + 1, total: PROFILE_QUESTIONS.length, domain, section }
}

export function nextProfileQuestion(question: string | null): string | null {
  const index = PROFILE_QUESTIONS.findIndex((item) => item.prompt === question)
  return index >= 0 ? PROFILE_QUESTIONS[index + 1]?.prompt ?? null : null
}

export function profileQuestionOptions(question: string | null): readonly string[] {
  return PROFILE_QUESTIONS.find((item) => item.prompt === question)?.options ?? []
}

export function profileQuestionsForGoal(goal: string) {
  const skinGoal = /(护肤|皮肤|面霜|洁面|精华|保湿|控油|护肤品)/i.test(goal)
  const hairGoal = /(头发|头皮|洗发|护发|发质)/i.test(goal)
  const domain = skinGoal ? 'skin' : hairGoal ? 'hair' : 'clothing'
  return PROFILE_QUESTIONS.filter((item) => item.domain === domain)
}

export function nextMissingProfileQuestion(goal: string, selfReported: Record<string, string | null | undefined>, currentQuestion?: string | null): string | null {
  const questions = profileQuestionsForGoal(goal)
  const start = currentQuestion ? Math.max(0, questions.findIndex((item) => item.prompt === currentQuestion) + 1) : 0
  return [...questions.slice(start), ...questions.slice(0, start)]
    .find((item) => !selfReported[item.key])?.prompt ?? null
}

export function buildAdvisorProfile(answers: string[]): AdvisorProfile {
  const selfReported = Object.fromEntries(PROFILE_QUESTIONS.map((question, index) => [
    question.key, answers[index] && answers[index] !== '跳过' ? answers[index] : null,
  ])) as AdvisorProfile['selfReported']
  return { version: 1, selfReported }
}

export function advisorProfileFromAiAssistantProfile(value: unknown): AdvisorProfile {
  const answers = value && typeof value === 'object' ? (value as { answers?: unknown }).answers : null
  const source = answers && typeof answers === 'object' ? answers as Record<string, unknown> : {}
  const selfReported = Object.fromEntries(PROFILE_QUESTIONS.map(({ key }) => {
    const answer = source[key]
    return [key, typeof answer === 'string' && answer !== '跳过' && answer.trim() ? answer.trim() : null]
  })) as AdvisorProfile['selfReported']
  return { version: 1, selfReported }
}

export function profileSummary(profile: AdvisorProfile): string {
  const answered = Object.values(profile.selfReported).filter(Boolean).length
  const note = profile.selfReported.productReaction === '反复出现'
    ? '你提到护肤品后反复不适；若仍在持续，请先咨询专业人士，避免仅凭问卷选品。'
    : '这些是你自己的描述，不是皮肤、发质或色彩诊断。'
  return `已记录 ${answered}/${PROFILE_QUESTIONS.length} 项自述信息，按穿衣、护肤和头发分别保存。${note}`
}

export function buildProfileTaskResult(answers: string[]) {
  const profile = buildAdvisorProfile(answers)
  return {
    mode: 'profile' as const,
    profile,
    summary: profileSummary(profile),
    looks: [], products: [], unknowns: [], budget: null,
    source: 'published' as const,
  }
}

export function profileFieldLabel(key: ProfileKey): string {
  const labels: Record<ProfileKey, string> = {
    priority: '最关注', scene: '常见场景', style: '穿搭感觉', colors: '常穿颜色', fit: '松量偏好', changePace: '调整节奏',
    cleansingFeel: '洁面后感受', productReaction: '使用后不适', skinGoal: '护肤目标',
    scalpOil: '头皮出油', hairTexture: '自然发丝', hairGoal: '头发目标', hairTime: '打理时间',
  }
  return labels[key]
}
