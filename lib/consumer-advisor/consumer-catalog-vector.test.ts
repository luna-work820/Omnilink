import { beforeEach,describe,expect,it,vi } from 'vitest'
vi.mock('server-only',()=>({}))
const m=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),embed:vi.fn()}))
vi.mock('@/lib/supabase/service-role',()=>({createServiceRoleClient:()=>({rpc:m.rpc,from:m.from})}))
vi.mock('./local-bge',()=>({embedLocalBge:m.embed,localBgePgVector:JSON.stringify,LOCAL_BGE_MODEL:'test-model'}))
import { searchConsumerCatalogByVector } from './consumer-catalog-vector'
beforeEach(()=>{vi.clearAllMocks();m.embed.mockResolvedValue([[0,1]]);m.rpc.mockResolvedValue({data:[],error:null})})
describe('catalog search read boundary',()=>{
  it('embeds only the current query and never claims indexing jobs or writes during retrieval',async()=>{
    await expect(searchConsumerCatalogByVector('沙发',24,500)).resolves.toEqual([])
    expect(m.embed).toHaveBeenCalledExactlyOnceWith(['沙发'],'query')
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith('match_consumer_catalog_embeddings',expect.objectContaining({p_max_price:500,p_match_count:24}))
    expect(m.from).not.toHaveBeenCalled()
  })
})
