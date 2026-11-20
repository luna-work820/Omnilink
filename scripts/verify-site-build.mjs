import {createServer} from 'vite'
import {writeFile} from 'node:fs/promises'
const dev=await createServer({configFile:false,server:{middlewareMode:true},resolve:{alias:{'@':process.cwd()}},plugins:[{name:'server-only-test',resolveId(id){if(id==='server-only')return '\0server-only'},load(id){if(id==='\0server-only')return 'export {}'}}]})
let runtime
let stop
try{
 const {applySiteChanges}=await dev.ssrLoadModule('/lib/site-builder/source.ts')
 const {buildSiteSource,startSiteRuntime,stopSiteRuntime}=await dev.ssrLoadModule('/lib/site-builder/runtime.ts');stop=stopSiteRuntime
 const component=`import {useState} from 'react';import {formatSitePrice,type SitePageProps} from '@omnilink/site-sdk';export default function Page({store,products,product}:SitePageProps){const [n,setN]=useState(0);return <main><h1>{product?.name||store.name}</h1><button onClick={()=>setN(n+1)}>计数 {n}</button><a href="/products">商品列表</a>{products.map(p=><a key={p.id} href={'/products/'+p.id}>{p.name} {formatSitePrice(p.price)}</a>)}</main>}`
 const source=applySiteChanges(null,{protocolVersion:'1',baseRevisionId:null,changes:['home','products','product'].map(page=>({operation:'write',path:`src/pages/${page}.tsx`,content:component}))})
 const artifacts=await buildSiteSource(source)
 const data={store:{slug:'verification',name:'SSR 验证商家 <安全>',description:null,logoUrl:null,contact:{}},products:[{id:'sample',name:'验证商品',description:null,category:null,price:{kind:'amount',amount:199,currency:'CNY'},imageUrl:null,images:[],attributes:{},options:[],variants:[],outboundLinks:[]}]}
 runtime=await startSiteRuntime({artifacts,data,mode:'preview',appOrigin:'http://localhost:3001',lease:crypto.randomUUID()})
 const result=await fetch(`${runtime.url}/?access=${runtime.access}`);const html=await result.text()
 if(!html.includes('SSR 验证商家')||!html.includes('验证商品'))throw Error('SSR content missing')
 const forbidden=await fetch(runtime.url);if(forbidden.status!==403)throw Error('Preview authentication missing')
 await writeFile('/private/tmp/omnilink-site-runtime-live.json',JSON.stringify(runtime),{mode:0o600})
 console.log(JSON.stringify({ssr:true,artifacts:Object.keys(artifacts),privatePreview:true}))
 if(process.env.SITE_KEEP_VERIFICATION_RUNTIME==='1'){console.log('Runtime preserved for browser checks; it expires automatically.');runtime=null}
}finally{if(runtime&&stop)await stop(runtime);await dev.close()}
