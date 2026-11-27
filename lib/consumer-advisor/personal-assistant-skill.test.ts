import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { readPersonalAssistantInstructions } from './personal-assistant-skill'
it('loads the replaced skill under its requested display name and relevant references', async () => {
  const instructions = await readPersonalAssistantInstructions('我想了解肤质和四季色彩')
  expect(instructions).toContain('# 形象助手')
  expect(instructions).toContain('运行环境：当前没有向模型开放 Python')
  expect(instructions).toContain('skin')
  expect(instructions).toContain('/consumer-market/skills/personal-assistant/')
  expect(instructions).not.toContain('allowed-tools:')
})
it('loads references only from fixed resource names', async () => {
  const instructions = await readPersonalAssistantInstructions('../../../../.env.local')
  expect(instructions).toContain('# 形象助手')
  expect(instructions).not.toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY=')
})
it.each([
  ['我想进行肤质分析。', '# 肤质档案库'],
  ['我想了解自己的动物系长相。', '# 动物系与四季特征判定'],
  ['我想了解自己的四季色彩。', '# 动物系与四季特征判定'],
  ['我想进行身材分型。', '# 身材分型与穿搭建议'],
  ['我想获得穿搭建议。', '# 身材分型与穿搭建议'],
  ['我想了解自己的气质表现。', '# 气质描述'],
])('loads the matching reference for %s', async (prompt, heading) => {
  expect(await readPersonalAssistantInstructions(prompt)).toContain(heading)
})
