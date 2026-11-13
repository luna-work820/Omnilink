import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({auth:vi.fn(),manage:vi.fn(),load:vi.fn()}))
vi.mock('@/lib/consumer-advisor/personal-context',()=>({loadPersonalContext:async()=>({version:1,memories:[]})}))
vi.mock('@/lib/api/auth', () => ({requireUser:m.auth}))
vi.mock('@/lib/consumer-advisor/ai-assistant-memory', () => ({manageAiAssistantMemory:m.manage,loadAiAssistantMemories:m.load,
  profileWithAiAssistantMemories:(_profile:unknown,memories:unknown[]) => ({memories})}))
import { PATCH } from './route'
const userId = '10000000-0000-4000-8000-000000000001'
const id = '20000000-0000-4000-8000-000000000001'
const request = (body:unknown) => new Request('http://localhost/api/consumer/ai-assistant-profile', {method:'PATCH',body:JSON.stringify(body)})
beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ok:true,user:{id:userId,user_metadata:{}},supabase:{}})
  m.load.mockResolvedValue([]); m.manage.mockResolvedValue({})
})
describe('memory API', () => {
  it('derives identity and manual provenance on the server',async () => {
    expect((await PATCH(request({action:'memory',text:'喜欢木质家具',domain:'space',userId:id,origin:'inferred',status:'active'}))).status).toBe(200)
    expect(m.manage).toHaveBeenCalledWith(userId,'manual',{text:'喜欢木质家具',domain:'space',evidence:'你手动保存的记忆'})
  })
  it('confirms a versioned record without rewriting its origin or evidence',async () => {
    expect((await PATCH(request({action:'confirm',id,revision:1,origin:'user',evidence:'forged'}))).status).toBe(200)
    expect(m.manage).toHaveBeenCalledWith(userId,'confirm',{id,revision:1})
  })
  it('requires the revision the user reviewed',async () => {
    expect((await PATCH(request({action:'confirm',id}))).status).toBe(400)
    expect(m.manage).not.toHaveBeenCalled()
  })
  it('returns a conflict instead of silently overwriting a newer record',async () => {
    m.manage.mockRejectedValueOnce({code:'40001'})
    expect((await PATCH(request({action:'correct',id,revision:1,text:'新内容'}))).status).toBe(409)
  })
})
