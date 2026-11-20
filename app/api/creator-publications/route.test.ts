import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { publicationDefaults } from '@/lib/creator-publication-document'

const m=vi.hoisted(()=>({auth:vi.fn(),store:vi.fn(),verify:vi.fn(),rpc:vi.fn()}))
vi.mock('@/lib/api/auth',()=>({requireUser:m.auth}))
vi.mock('@/lib/creator-publication-service',()=>({creatorPublicationStore:m.store,verifyPublicationAssets:m.verify}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
import { GET, POST, PATCH } from './route'
const id='50000000-0000-4000-8000-000000000001'
const document={version:1,kind:'image',fields:{...publicationDefaults,title:'发布测试'},media:['https://example.com/test.webp'],coverUrl:'https://example.com/test.webp',excerpt:''}
const row={id,publication:document,status:'published',created_at:'2026-11-18T00:00:00Z',updated_at:'2026-11-18T00:00:00Z',published_at:'2026-11-18T00:00:00Z'}
const request=(body:unknown,method='POST')=>new NextRequest('http://localhost/api/creator-publications',{method,body:JSON.stringify(body),headers:{'Content-Type':'application/json'}})
beforeEach(()=>{
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ok:true,user:{id:'owner'},supabase:{rpc:m.rpc}})
  m.store.mockResolvedValue({id:'owned-store',organization_id:'owned-org'})
  m.verify.mockResolvedValue([])
  m.rpc.mockResolvedValue({data:row,error:null})
})
describe('current publisher API',()=>{
  it('saves against the authenticated space and returns a restorable record',async()=>{
    const response=await POST(request({document,status:'published',storeId:'forged'}))
    expect(response.status).toBe(201)
    expect(m.rpc).toHaveBeenCalledWith('manage_creator_publication',expect.objectContaining({p_store_id:'owned-store',p_id:null,p_status:'published'}))
    expect((await response.json()).record).toMatchObject({id,content:{kind:'image',fields:{title:'发布测试'}}})
  })
  it('does not save invalid media or incomplete publishing data',async()=>{
    expect((await POST(request({document:{...document,media:['blob:http://localhost/file']},status:'published'}))).status).toBe(400)
    expect((await POST(request({document:{...document,coverUrl:''},status:'published'}))).status).toBe(422)
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it('requires verified authentication',async()=>{
    m.auth.mockResolvedValue({ok:false,response:Response.json({error:'Unauthorized'},{status:401})})
    expect((await POST(request({document,status:'published'}))).status).toBe(401)
    expect(m.store).not.toHaveBeenCalled()
  })
  it('uses the editor-only projection for loading pending changes',async()=>{
    m.rpc.mockResolvedValue({data:[{...row,draft_version:{publication:{...document,fields:{...document.fields,title:'修改稿'}}}}],error:null})
    const response=await GET(new NextRequest(`http://localhost/api/creator-publications?id=${id}`))
    expect(m.rpc).toHaveBeenCalledWith('get_creator_publication_for_editor',{p_store_id:'owned-store',p_id:id})
    expect((await response.json()).record.pending.fields.title).toBe('修改稿')
  })
  it('archives existing legacy records without requiring a new document',async()=>{
    m.rpc.mockResolvedValue({data:{id,status:'archived'},error:null})
    expect((await PATCH(request({id,action:'archive'},'PATCH'))).status).toBe(200)
    expect(m.verify).not.toHaveBeenCalled()
  })
})
