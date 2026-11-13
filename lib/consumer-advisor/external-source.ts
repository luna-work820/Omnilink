import 'server-only'
import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'
import { DiscoveryError } from './discovery-contract'

export function isPublicAddress(address: string): boolean {
  if (isIP(address)===4) {
    const [a,b,c]=address.split('.').map(Number)
    return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)
      ||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||(b===88&&c===99)))
      ||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113))
  }
  if (isIP(address)===6) {
    if(!/^[23][0-9a-f]{3}:/i.test(address))return false
    const [first,second]=address.toLowerCase().split(':').map((value)=>parseInt(value||'0',16))
    return first!==0x2002&&first!==0x3fff&&!(first===0x2001&&(second<=0x1ff||second===0xdb8))
  }
  return false
}
export function externalUrl(value: string): URL {
  let url: URL
  try { url=new URL(value) } catch { throw new DiscoveryError('URL_INVALID',400,'网址无效。') }
  const host=url.hostname.replace(/^\[|\]$/g,'').toLowerCase()
  if (url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||value.length>2048
    ||!host.includes('.')&&!isIP(host)||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')
    ||(isIP(host)&&!isPublicAddress(host))) throw new DiscoveryError('URL_BLOCKED',400,'请使用可公开访问的 HTTPS 网页。')
  url.hash=''
  return url
}
function plain(value: string) {
  return value.replace(/<(script|style|noscript|svg|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
    .replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g,(v)=>({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[v]!))
    .replace(/&#(\d{1,6});/g,(_match,n)=>{const code=Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):''})
    .replace(/\s+/g,' ').trim()
}
export function parseExternalHtml(html: string, url: string) {
  const title=plain(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? new URL(url).hostname).slice(0,240)
  const excerpt=plain(html).slice(0,6000)
  if(excerpt.length<20)throw new DiscoveryError('SOURCE_UNREADABLE',422,'网页没有可读取的正文。')
  return {url,title,excerpt}
}
type Download = { status: number; location?: string; html: string }
export async function fetchExternalSource(value: string, signal?: AbortSignal) {
  const budget=AbortSignal.any([AbortSignal.timeout(10_000),...(signal?[signal]:[])])
  let url=externalUrl(value)
  for(let redirect=0;redirect<=3;redirect++) {
    budget.throwIfAborted()
    const host=url.hostname.replace(/^\[|\]$/g,'')
    const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await Promise.race([lookup(host,{all:true,verbatim:true}),new Promise<never>((_,reject)=>{
      budget.addEventListener('abort',()=>reject(budget.reason),{once:true})
    })])
    if(!addresses.length||addresses.some((entry)=>!isPublicAddress(entry.address)))throw new DiscoveryError('URL_BLOCKED',400,'网址解析到了受限地址。')
    const address=addresses.find((entry)=>entry.family===4)??addresses[0]
    const result=await new Promise<Download>((resolve,reject)=>{
      const req=request(url,{signal:budget,hostname:address.address,servername:isIP(host)?undefined:host,port:443,
        headers:{Host:url.host,'User-Agent':'Omnilink/2.1 (user-requested source reader)','Accept':'text/html,text/plain','Accept-Encoding':'identity'}},(res)=>{
        if(res.statusCode&&[301,302,303,307,308].includes(res.statusCode)) {
          res.resume();resolve({status:res.statusCode,location:res.headers.location,html:''});return
        }
        if(res.statusCode!==200){res.resume();reject(new DiscoveryError('SOURCE_UNAVAILABLE',502,'网页暂时无法读取。'));return}
        if(!/^text\/(html|plain)(?:;|$)/i.test(res.headers['content-type']??'')||res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){
          res.resume();reject(new DiscoveryError('SOURCE_FORMAT',415,'当前仅支持 HTML 和纯文本网页。'));return
        }
        const chunks:Buffer[]=[];let bytes=0
        res.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>512_000)req.destroy(new DiscoveryError('SOURCE_TOO_LARGE',413,'网页内容过大。'));else chunks.push(chunk)})
        res.on('end',()=>resolve({status:200,html:Buffer.concat(chunks).toString('utf8')}));res.on('error',reject)
      })
      req.on('error',reject);req.end()
    })
    if(result.status===200)return parseExternalHtml(result.html,url.href)
    if(!result.location||redirect===3)throw new DiscoveryError('SOURCE_REDIRECT',422,'网页跳转次数过多。')
    url=externalUrl(new URL(result.location,url).href)
  }
  throw new DiscoveryError('SOURCE_UNAVAILABLE',502,'网页暂时无法读取。')
}
