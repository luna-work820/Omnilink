import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { normalizeProduct,type CatalogItemRow } from '@/lib/storefront/normalize'
import { projectSiteProduct,projectSiteStore } from './projection'
import type { SitePageProps } from './contracts'

export async function readBuilderData(storeId:string):Promise<Pick<SitePageProps,'store'|'products'>>{
  const db=createServiceRoleClient()
  const {data:store,error}=await db.from('stores').select('id,organization_id,name,slug,currency,status').eq('id',storeId).single()
  if(error||!store||store.status!=='active')throw new Error('店铺不可用')
  const {data:items,error:itemError}=await db.from('catalog_items').select('id,title,description,cover_image,details,catalog_variants(id,price,currency_code,availability_type,availability_value,details),catalog_media(storage_path,media_role,media_type)')
    .eq('organization_id',store.organization_id).eq('item_type','product').in('status',['active','draft']).order('created_at',{ascending:false}).limit(50)
  if(itemError)throw new Error('读取商品失败')
  const products=(items??[]).map((item:CatalogItemRow)=>{
    const variant=item.catalog_variants?.[0]
    return projectSiteProduct(normalizeProduct({id:item.id,name:item.title,description:item.description,cover_image:item.cover_image,price:variant?.price??null,currency:variant?.currency_code??store.currency,
      details:item.details,media:(item.catalog_media??[]).map(m=>({url:m.storage_path??null,role:m.media_role==='cover'?'public':m.media_type??null})),
      variants:(item.catalog_variants??[]).map(v=>({id:v.id,sku:null,price:v.price??null,currency:v.currency_code??store.currency,inventory:v.availability_type==='stock'&&v.availability_value!=null?Number(v.availability_value):null,status:'active',option_values:v.details??{}}))},
      {storeSlug:store.slug,storeCurrency:store.currency}))
  })
  return {store:projectSiteStore({id:store.id,slug:store.slug,name:store.name,currency:store.currency,description:null,logoUrl:null,themeId:null}),products}
}
export async function readGeneratedStoreState(slug:string){
  const db=createServiceRoleClient()
  const {data:store,error}=await db.from('stores').select('id,name,slug,currency').eq('slug',slug).eq('status','active').maybeSingle()
  if(error)throw new Error('公开店铺读取失败')
  if(!store)return {managed:false,store:null}
  const {data:site,error:siteError}=await db.from('ai_websites').select('published_build_id').eq('store_id',store.id).maybeSingle()
  if(siteError){if(siteError.code==='42P01'||siteError.code==='PGRST205')return {managed:false,store:null};throw new Error('网站发布状态读取失败')}
  if(!site)return {managed:false,store:null}
  return {managed:true,store:site.published_build_id?{...store,description:null,logoUrl:null,themeId:null}:null}
}

export async function readGeneratedPublishedStore(slug:string){return (await readGeneratedStoreState(slug)).store}
