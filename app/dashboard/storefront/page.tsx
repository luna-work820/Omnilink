import {WebsiteDesign} from '@/components/site-builder/WebsiteDesign'
import {createClientServer} from '@/lib/supabase/server'
import {getOwnedStore} from '@/lib/api/auth'
import {readBuilderData} from '@/lib/site-builder/data'
import type {StarterWebsiteData} from '@/components/site-builder/StarterWebsitePreview'

export default async function DashboardStorefrontPage(){
 const supabase=await createClientServer()
 const {data:{user}}=await supabase.auth.getUser()
 let starter:StarterWebsiteData|null=null
 let starterError=''
 if(user){
  const store=await getOwnedStore(supabase,user)
  if(store){try{starter=await readBuilderData(store.id)}catch{starterError='商品暂时无法读取'}}
 }
 return <WebsiteDesign starter={starter} starterError={starterError}/>
}
