import { describe, expect, it, vi } from 'vitest'
import { createSiteDataClient, SiteDataError } from './sdk'
const store={schemaVersion:'1',store:{slug:'store-a',name:'A',description:null,logoUrl:null,contact:{}}}
const response=(data:unknown,status=200)=>Response.json(data,{status})
describe('generated site data SDK',()=>{
 it('omits credentials, bypasses stale caches and reads fresh data on every call',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(response(store)).mockResolvedValueOnce(response({...store,store:{...store.store,name:'Updated'}}))
  const sdk=createSiteDataClient({origin:'https://data.example.com',storeSlug:'store-a',fetch:fetcher})
  expect((await sdk.store()).name).toBe('A');expect((await sdk.store()).name).toBe('Updated')
  expect(fetcher).toHaveBeenCalledWith('https://data.example.com/api/site-data/v1/store-a',expect.objectContaining({credentials:'omit',cache:'no-store',redirect:'error'}))
 })
 it('does not silently switch stores or accept a new contract version',async()=>{
  for(const data of [{...store,store:{...store.store,slug:'other'}},{...store,schemaVersion:'2'}]){
   const sdk=createSiteDataClient({origin:'https://data.example.com',storeSlug:'store-a',fetch:vi.fn().mockResolvedValue(response(data))})
   await expect(sdk.store()).rejects.toMatchObject({code:'CONTRACT_MISMATCH'})
  }
 })
 it('rejects oversized pages and malformed continuations',async()=>{
  const sdk=createSiteDataClient({origin:'https://data.example.com',storeSlug:'store-a',fetch:vi.fn().mockResolvedValue(response({schemaVersion:'1',storeSlug:'store-a',items:[],nextOffset:7}))})
  await expect(sdk.products({limit:2})).rejects.toMatchObject({code:'CONTRACT_MISMATCH'})
 })
 it('validates IDs and pagination before fetching',async()=>{
  const fetcher=vi.fn(),sdk=createSiteDataClient({origin:'https://data.example.com',storeSlug:'store-a',fetch:fetcher})
  await expect(sdk.product('../other')).rejects.toThrow('Invalid product ID')
  await expect(sdk.products({limit:51})).rejects.toThrow('Invalid product pagination')
  expect(fetcher).not.toHaveBeenCalled()
 })
 it('reports a public error without falling back to demo data',async()=>{
  const sdk=createSiteDataClient({origin:'https://data.example.com',storeSlug:'store-a',fetch:vi.fn().mockResolvedValue(response({error:{code:'STORE_NOT_FOUND',message:'未发布'}},404))})
  await expect(sdk.store()).rejects.toBeInstanceOf(SiteDataError)
 })
 it.each(['http://data.example.com','https://u:p@data.example.com','https://data.example.com/path','https://data.example.com?token=secret'])('rejects unsafe base %s',(origin)=>{
  expect(()=>createSiteDataClient({origin,storeSlug:'store-a'})).toThrow()
 })
})
