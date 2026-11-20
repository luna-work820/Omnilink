import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { readPersonalAssistantInstructions } from './personal-assistant-skill'
it('loads the replaced skill under its requested display name and relevant references', async () => {
  const instructions = await readPersonalAssistantInstructions('我想了解肤质和四季色彩')
  expect(instructions).toContain('# 个人助手')
  expect(instructions).toContain('运行环境：当前没有向模型开放 Python')
  expect(instructions).toContain('skin')
  expect(instructions).toContain('/consumer-market/skills/personal-assistant/')
  expect(instructions).not.toContain('allowed-tools:')
})
it('loads references only from fixed resource names', async () => {
  const instructions = await readPersonalAssistantInstructions('../../../../.env.local')
  expect(instructions).toContain('# 个人助手')
  expect(instructions).not.toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY=')
})
