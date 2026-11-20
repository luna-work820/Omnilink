import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/service-role', () => ({ createServiceRoleClient: () => mock }))
import { consolidateRecentMemories } from './memory-consolidation'

beforeEach(() => vi.resetAllMocks())
it('uses owned server user messages across sessions and ignores temporary or quoted preferences', async () => {
  const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn() }
  for (const key of ['select', 'eq', 'order'] as const) chain[key].mockReturnValue(chain)
  mock.from.mockReturnValue(chain)
  chain.limit.mockResolvedValue({ data: [
    { id: 'new', content: '我不喜欢红色' }, { id: 'temporary', content: '这次我喜欢蓝色' },
    { id: 'old', content: '我喜欢绿色' }, { id: 'quote', content: '文章说“我喜欢黑色”' },
  ], error: null })
  mock.rpc.mockResolvedValue({ data: { status: 'proposed' }, error: null })
  await consolidateRecentMemories('user-a')
  expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-a')
  expect(chain.eq).toHaveBeenCalledWith('role', 'user')
  expect(chain.limit).toHaveBeenCalledWith(12)
  expect(mock.rpc).toHaveBeenCalledTimes(2)
  expect(mock.rpc.mock.calls.map((call) => call[1].p_message_id)).toEqual(['old', 'new'])
  expect(mock.rpc.mock.calls[0][1]).toMatchObject({ p_user_id: 'user-a', p_candidate: { evidence: '我喜欢绿色' } })
})
it('does not process invented sources after a database read failure', async () => {
  const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn().mockResolvedValue({ data: null, error: {} }) }
  for (const key of ['select', 'eq', 'order'] as const) chain[key].mockReturnValue(chain)
  mock.from.mockReturnValue(chain)
  await expect(consolidateRecentMemories('user-a')).rejects.toThrow('记忆来源读取失败')
  expect(mock.rpc).not.toHaveBeenCalled()
})
