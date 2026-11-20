import 'server-only'
import { Sandbox } from '@vercel/sandbox'
import { createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { SiteSourceRevision } from './source'
import type { SitePageProps } from './contracts'

export const artifactsSchema = z.object({ 'render.mjs':z.string().max(4_000_000), 'site.js':z.string().max(4_000_000), 'site.css':z.string().max(500_000) }).strict()
export type SiteArtifacts = z.infer<typeof artifactsSchema>
const root='/tmp/omnilink-site'
const templatePath=path.join(process.cwd(),'lib/site-builder/template')
const template=async(name:string)=>readFile(path.join(templatePath,name+'.txt'),'utf8')
export function artifactDigest(artifacts:SiteArtifacts){return createHash('sha256').update(JSON.stringify(artifactsSchema.parse(artifacts))).digest('hex')}
export function sandboxConfigured(){return Boolean(process.env.VERCEL_OIDC_TOKEN || (process.env.VERCEL_TOKEN&&process.env.VERCEL_TEAM_ID&&process.env.VERCEL_PROJECT_ID))}
function authentication(){return process.env.VERCEL_OIDC_TOKEN?{}:{token:process.env.VERCEL_TOKEN,teamId:process.env.VERCEL_TEAM_ID,projectId:process.env.VERCEL_PROJECT_ID}}
async function command(sandbox:Sandbox,cmd:string,args:string[]){
  const result=await sandbox.runCommand({cmd,args,cwd:root})
  if(result.exitCode!==0)throw new Error((await result.stderr()).slice(-1800)||'网站构建失败')
  return result
}
export async function buildSiteSource(source:SiteSourceRevision,signal?:AbortSignal):Promise<SiteArtifacts>{
  if(!sandboxConfigured())throw new Error('请先配置 Vercel Sandbox 认证')
  const sandbox=await Sandbox.create({...authentication(),persistent:false,timeout:150_000,networkPolicy:{allow:['registry.npmjs.org']}})
  try{
    signal?.throwIfAborted()
    await sandbox.runCommand({cmd:'mkdir',args:['-p',root]})
    await sandbox.writeFiles(await Promise.all(['package.json','package-lock.json'].map(async name=>({path:`${root}/${name}`,content:Buffer.from(await template(name))}))))
    await command(sandbox,'npm',['ci','--ignore-scripts','--no-audit','--no-fund'])
    await sandbox.update({networkPolicy:'deny-all'})
    signal?.throwIfAborted()
    const files={...source.files,'tsconfig.json':await template('tsconfig.json'),'platform/sdk.ts':await template('sdk.ts'),'platform/client.tsx':await template('client.tsx'),'platform/render.tsx':await template('render.tsx'),'build.mjs':await template('build.mjs')}
    await command(sandbox,'mkdir',['-p',...new Set(Object.keys(files).map(file=>path.posix.dirname(`${root}/${file}`)))])
    await sandbox.writeFiles(Object.entries(files).map(([file,content])=>({path:`${root}/${file}`,content:Buffer.from(content)})))
    await command(sandbox,'node',['node_modules/typescript/bin/tsc','--noEmit'])
    await command(sandbox,'node',['build.mjs',...Object.keys(source.files).filter(file=>file.endsWith('.css'))])
    signal?.throwIfAborted()
    const artifacts=Object.fromEntries(await Promise.all(['render.mjs','site.js','site.css'].map(async file=>{
      const bytes=await sandbox.readFileToBuffer({path:`${root}/dist/${file}`});if(!bytes)throw new Error('缺少网站构建产物');return [file,bytes.toString('utf8')]
    })))
    return artifactsSchema.parse(artifacts)
  }finally{await sandbox.stop()}
}
export type SiteRuntime = {lease:string;sandboxId:string;url:string;access:string;expiresAt:string}
export async function startSiteRuntime(input:{artifacts:SiteArtifacts;data:Pick<SitePageProps,'store'|'products'>;mode:'preview'|'public';dataOrigin?:string;appOrigin:string;lease:string}):Promise<SiteRuntime>{
  if(!sandboxConfigured())throw new Error('请先配置 Vercel Sandbox 认证')
  if(input.mode==='public'&&(!input.dataOrigin||new URL(input.dataOrigin).protocol!=='https:'))throw new Error('请配置公开的网站数据接口地址 SITE_DATA_ORIGIN')
  const access=randomBytes(32).toString('hex'),expiresAt=new Date(Date.now()+8*60_000).toISOString()
  const sandbox=await Sandbox.create({...authentication(),persistent:false,timeout:9*60_000,ports:[3000],networkPolicy:input.mode==='public'?{allow:[new URL(input.dataOrigin!).hostname]}:'deny-all'})
  try{
    await sandbox.runCommand({cmd:'mkdir',args:['-p',root]})
    const files={...input.artifacts,'server.mjs':await template('server.mjs'),'runtime.json':JSON.stringify({access,expiresAt:Date.parse(expiresAt),mode:input.mode,dataOrigin:input.dataOrigin,storeSlug:input.data.store.slug,appOrigin:input.appOrigin}),'data.json':JSON.stringify(input.data)}
    await sandbox.writeFiles(Object.entries(files).map(([file,content])=>({path:`${root}/${file}`,content:Buffer.from(content)})))
    await sandbox.runCommand({cmd:'node',args:['server.mjs'],cwd:root,detached:true})
    const url=sandbox.domain(3000)
    for(let attempt=0;attempt<12;attempt++){
      try{const result=await fetch(`${url}/?access=${access}`,{signal:AbortSignal.timeout(5000),redirect:'error'});if(result.ok){await result.body?.cancel();return {lease:input.lease,sandboxId:sandbox.name,url,access,expiresAt}}await result.body?.cancel()}catch{}
      await new Promise(resolve=>setTimeout(resolve,500))
    }
    throw new Error('网站预览未能正常启动')
  }catch(error){await sandbox.stop();throw error}
}
export async function refreshPreview(runtime:SiteRuntime,data:Pick<SitePageProps,'store'|'products'>){
  const sandbox=await Sandbox.get({...authentication(),name:runtime.sandboxId})
  await sandbox.writeFiles([{path:`${root}/data.json`,content:Buffer.from(JSON.stringify(data))}])
}
export async function stopSiteRuntime(runtime:SiteRuntime){const sandbox=await Sandbox.get({...authentication(),name:runtime.sandboxId});await sandbox.stop()}
