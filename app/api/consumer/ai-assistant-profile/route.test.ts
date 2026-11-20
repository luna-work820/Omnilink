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
    expect(m.manage).toHaveBeenCalledWith(userId,'manual',{text:'喜欢木质家具',domain:'space',evidence:'你手动保存的记忆',sourcePayload:{lifecycle:{subject:'self',scope:'long-term',expiresAt:null}}})
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

it('rejects a temporary memory without an expiry', async () => {
  const response = await PATCH(request({ action: 'memory', text: '出差期间住酒店', domain: 'other',
    lifecycle: { subject: 'self', scope: 'temporary', expiresAt: null } }))
  expect(response.status).toBe(400)
  expect(m.manage).not.toHaveBeenCalled()
})
it('persists an explicit temporary scope with an end time', async () => {
  const lifecycle = { subject: 'self', scope: 'temporary', expiresAt: '2099-01-01T00:00:00Z' }
  expect((await PATCH(request({ action: 'memory', text: '出差期间住酒店', domain: 'other', lifecycle }))).status).toBe(200)
  expect(m.manage).toHaveBeenCalledWith(userId, 'manual', expect.objectContaining({ sourcePayload: { lifecycle } }))
})

it('records invitation display separately from personal profile completion', async () => {
  const updateUser = vi.fn().mockResolvedValue({ error: null })
  m.auth.mockResolvedValueOnce({ ok: true, user: { id: userId, user_metadata: {} }, supabase: { auth: { updateUser } } })
  const response = await PATCH(request({ action: 'signup-invitation-seen', userId: id, complete: true }))
  expect(response.status).toBe(200)
  expect(updateUser).toHaveBeenCalledWith({ data: { signup_invitation_seen: true } })
  expect(m.manage).not.toHaveBeenCalled()
})
