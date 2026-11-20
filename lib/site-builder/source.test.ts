import { describe, expect, it } from 'vitest'
import { applySiteChanges, isEditableSitePath, SITE_ENTRIES, SOURCE_LIMITS } from './source'
const writes=()=>Object.values(SITE_ENTRIES).map((path)=>({operation:'write' as const,path,content:'export default function Page(){return null}'}))
const initial=()=>applySiteChanges(null,{protocolVersion:'1',baseRevisionId:null,changes:writes()})
describe('site source revisions',()=>{
 it('creates immutable reproducible source versions and does not mutate a baseline',()=>{
  const a=initial(),b=applySiteChanges(null,{protocolVersion:'1',baseRevisionId:null,changes:writes().reverse()})
  expect(a.id).toBe(b.id);expect(Object.isFrozen(a.files)).toBe(true)
  const c=applySiteChanges(a,{protocolVersion:'1',baseRevisionId:a.id,changes:[{operation:'write',path:'src/styles/site.css',content:'body {color: black}'}]})
  expect(c.id).not.toBe(a.id);expect(c.parentId).toBe(a.id);expect(a.files).not.toHaveProperty('src/styles/site.css')
 })
 it('rejects an edit based on an old revision instead of overwriting the current version',()=>{
  const a=initial(),b=applySiteChanges(a,{protocolVersion:'1',baseRevisionId:a.id,changes:[{operation:'write',path:'src/styles/site.css',content:'body {}'}]})
  expect(()=>applySiteChanges(b,{protocolVersion:'1',baseRevisionId:a.id,changes:writes()})).toThrow('网站已更新')
 })
 it.each(['../secret','/src/pages/a.tsx','src/../package.json','src/pages/../../a.tsx','src\\pages\\a.tsx','src/pages/%2e%2e/a.tsx','src/pages/.env.ts','package.json','src/sdk.ts','src/pages/a.js','src/styles/a.ts','src/components/x.tsx/../a.tsx'])('blocks protected or ambiguous path %s',(path)=>{
  expect(isEditableSitePath(path)).toBe(false)
  expect(()=>applySiteChanges(initial(),{protocolVersion:'1',baseRevisionId:initial().id,changes:[{operation:'write',path,content:'bad'}]})).toThrow()
 })
 it('refuses executable command and dependency fields instead of silently ignoring them',()=>{
  expect(()=>applySiteChanges(null,{protocolVersion:'1',baseRevisionId:null,changes:writes(),commands:['npm install evil']})).toThrow()
  expect(()=>applySiteChanges(null,{protocolVersion:'1',baseRevisionId:null,changes:writes(),packages:['anything']})).toThrow()
 })
 it('rejects duplicate writes and missing required pages',()=>{
  expect(()=>applySiteChanges(null,{protocolVersion:'1',baseRevisionId:null,changes:[...writes(),writes()[0]]})).toThrow()
  const a=initial();expect(()=>applySiteChanges(a,{protocolVersion:'1',baseRevisionId:a.id,changes:[{operation:'delete',path:SITE_ENTRIES.product}]})).toThrow('缺少')
 })
 it('counts UTF-8 bytes rather than JS characters for file limits',()=>{
  const a=initial();expect(()=>applySiteChanges(a,{protocolVersion:'1',baseRevisionId:a.id,changes:[{operation:'write',path:'src/components/large.tsx',content:'字'.repeat(Math.ceil(SOURCE_LIMITS.fileBytes/3))}]})).toThrow('文件过大')
 })
 it('does not accept null bytes or deletion of absent files',()=>{
  const a=initial()
  expect(()=>applySiteChanges(a,{protocolVersion:'1',baseRevisionId:a.id,changes:[{operation:'write',path:'src/components/a.tsx',content:'\0'}]})).toThrow()
  expect(()=>applySiteChanges(a,{protocolVersion:'1',baseRevisionId:a.id,changes:[{operation:'delete',path:'src/components/missing.tsx'}]})).toThrow()
 })
})
