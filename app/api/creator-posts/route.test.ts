import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({auth:vi.fn(),store:vi.fn(),from:vi.fn(),rpc:vi.fn()}))
vi.mock('@/lib/api/auth', () => ({requireUser:m.auth,getOwnedStore:m.store}))
vi.mock('next/cache', () => ({revalidatePath:vi.fn()}))
import { GET } from './route'
const store = {id:'store',organization_id:'organization'}
beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ok:true,user:{id:'editor'},supabase:{from:m.from,rpc:m.rpc}})
  m.store.mockResolvedValue(store)
  m.from.mockImplementation((table) => {
    const chain = {select:vi.fn(),eq:vi.fn(),neq:vi.fn(),order:vi.fn(),limit:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:store,error:null})}
    for (const method of ['select','eq','neq','order'] as const) chain[method].mockReturnValue(chain)
    chain.limit.mockResolvedValue({data:[],error:null})
    if (table !== 'stores' && table !== 'catalog_items') throw new Error('Draft read must use the editor RPC')
    return chain
  })
  m.rpc.mockResolvedValue({data:[{id:'post',draft_version:{title:'Pending changes'}}],error:null})
})
describe('creator editor reads', () => {
  it('uses the ownership checked draft RPC while leaving the public projection restricted',async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    expect(m.rpc).toHaveBeenCalledWith('get_creator_posts_for_editor',{p_store_id:store.id})
    expect(await response.json()).toMatchObject({posts:[{draft_version:{title:'Pending changes'}}]})
  })
})
