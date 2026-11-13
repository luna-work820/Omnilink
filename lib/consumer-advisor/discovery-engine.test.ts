import { NextRequest,NextResponse } from 'next/server'
import { describe,expect,it,vi } from 'vitest'
vi.mock('server-only',()=>({}))
vi.mock('@/lib/supabase/service-role',()=>({createServiceRoleClient:vi.fn()}))
vi.mock('@/lib/storefront/service',()=>({mapStorefrontDiscoveryRows:vi.fn()}))
import { attachDiscoveryActor,decodeDiscoveryCursor,discoveryActor,encodeDiscoveryCursor } from './discovery-engine'

const session='10000000-0000-4000-8000-000000000001'
describe('discovery cursor and guest identity',()=>{
  it('rejects forged, expired and cross-key cursors',()=>{
    const data={r:crypto.randomUUID(),s:session,o:20,v:3,e:Date.now()+60_000}
    const cursor=encodeDiscoveryCursor(data,'key-a')
    expect(decodeDiscoveryCursor(cursor,'key-a')).toEqual(data)
    expect(()=>decodeDiscoveryCursor(cursor,'key-b')).toThrow('续页地址无效')
    const [body,signature]=cursor.split('.')
    const changed=Buffer.from(JSON.stringify({...data,o:40})).toString('base64url')
    expect(()=>decodeDiscoveryCursor(`${changed}.${signature}`,'key-a')).toThrow('续页地址无效')
    expect(()=>decodeDiscoveryCursor(`${body}.${signature}.extra`,'key-a')).toThrow('续页地址无效')
    expect(()=>decodeDiscoveryCursor(encodeDiscoveryCursor({...data,e:Date.now()-1},'key-a'),'key-a')).toThrow('搜索已过期')
  })
  it('keeps guest tokens HTTP-only, hashes owners and never accepts a guest token as an authenticated identity',()=>{
    const first=discoveryActor(new NextRequest('http://localhost'),null,session)
    expect(first.newGuestToken).toMatch(/^[a-f0-9]{64}$/)
    expect(first.guestHash).not.toBe(first.newGuestToken)
    const response=attachDiscoveryActor(NextResponse.json({ok:true}),first)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.cookies.get('omnilink_discovery_guest')?.httpOnly).toBe(true)
    const returning=new NextRequest('http://localhost',{headers:{cookie:`omnilink_discovery_guest=${first.newGuestToken}`}})
    expect(discoveryActor(returning,null,session)).toMatchObject({guestHash:first.guestHash})
    expect(discoveryActor(returning,'verified-user',session)).toEqual({userId:'verified-user',guestHash:null,sessionId:session})
  })
})
