import { describe,expect,it,vi } from 'vitest'
import { EventEmitter } from 'node:events'
vi.mock('server-only',()=>({}))
const dns=vi.hoisted(()=>vi.fn())
const download=vi.hoisted(()=>vi.fn())
vi.mock('node:dns/promises',()=>({lookup:dns}))
vi.mock('node:https',()=>({request:download}))
import { externalUrl,isPublicAddress,fetchExternalSource,parseExternalHtml } from './external-source'
describe('external source boundary',()=>{
  it.each(['http://example.com','https://localhost','https://127.0.0.1','https://2130706433','https://[::1]','https://10.0.0.1','https://169.254.169.254',
    'https://example.com:8443','https://user:password@example.com','https://anything.local'])('rejects %s',url=>expect(()=>externalUrl(url)).toThrow())
  it.each(['127.0.0.1','10.1.2.3','172.16.0.1','192.168.1.1','100.64.0.1','169.254.1.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1','2002:a00:1::1','3fff::1'])('blocks reserved address %s',ip=>expect(isPublicAddress(ip)).toBe(false))
  it('allows public addresses and removes URL fragments',()=>{
    expect(isPublicAddress('8.8.8.8')).toBe(true);expect(isPublicAddress('2606:4700:4700::1111')).toBe(true)
    expect(externalUrl('https://example.com/path#part').href).toBe('https://example.com/path')
  })
  it('rejects a public-looking hostname if any DNS answer resolves privately',async()=>{
    dns.mockResolvedValue([{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}])
    await expect(fetchExternalSource('https://example.com')).rejects.toMatchObject({code:'URL_BLOCKED'})
  })
  it('extracts inert text with source attribution and strips executable content',()=>{
    const result=parseExternalHtml('<title>家具 &amp; 材料</title><script>steal()</script><main>这是一篇关于公开商品的资料，正文作为待核验的数据保留。</main>','https://example.com')
    expect(result.title).toBe('家具 & 材料');expect(result.excerpt).not.toContain('steal()');expect(result.url).toBe('https://example.com')
  })
  it('pins the validated address while retaining TLS and HTTP host identity',async()=>{
    dns.mockResolvedValue([{address:'93.184.216.34',family:4}])
    download.mockImplementation((_url,options,receive)=>{
      const req=new EventEmitter() as EventEmitter & {end:()=>void}
      req.end=()=>{const response=Object.assign(new EventEmitter(),{statusCode:200,headers:{'content-type':'text/html'}});receive(response)
        response.emit('data',Buffer.from('<title>Example</title><p>This is sufficient public source text for the reader.</p>'));response.emit('end')}
      expect(options.hostname).toBe('93.184.216.34');expect(options.servername).toBe('example.com');expect(options.headers.Host).toBe('example.com')
      expect(options.rejectUnauthorized).not.toBe(false);expect(options.agent).not.toBe(false)
      return req
    })
    expect((await fetchExternalSource('https://example.com')).title).toBe('Example')
  })
  it('revalidates redirect destinations before connecting again',async()=>{
    dns.mockResolvedValue([{address:'93.184.216.34',family:4}]);download.mockClear()
    download.mockImplementation((_url,_options,receive)=>{
      const req=Object.assign(new EventEmitter(),{end:()=>receive({statusCode:302,headers:{location:'https://127.0.0.1/private'},resume(){}})})
      return req
    })
    await expect(fetchExternalSource('https://example.com')).rejects.toMatchObject({code:'URL_BLOCKED'})
    expect(download).toHaveBeenCalledTimes(1)
  })
})
