import { beforeEach, describe, expect, it, vi } from 'vitest'
const m=vi.hoisted(()=>({getUser:vi.fn(),refresh:vi.fn(),profile:vi.fn(),store:vi.fn(),project:vi.fn(),initStore:vi.fn(),initProject:vi.fn(),update:vi.fn()}))
vi.mock('server-only',()=>({}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClientServer:async()=>({auth:{getUser:m.getUser,refreshSession:m.refresh,updateUser:m.profile}})}))
vi.mock('@/lib/supabase/service-role',()=>({createServiceRoleClient:()=>({auth:{admin:{updateUserById:m.update}}})}))
vi.mock('@/lib/stores/service',()=>({getStoreByOwnerId:m.store,initializeMerchantStore:m.initStore}))
vi.mock('@/lib/brand/workspace',()=>({getBrandProjectByUserId:m.project,initializeBrandProject:m.initProject}))
import { createStoreAction, dismissCreatorUploadIntroAction } from '@/app/actions/onboarding'
function form(capability='creator'){const f=new FormData();f.set('capability',capability);f.set('store_name','测试名称');f.set('user_id','another-user');return f}
beforeEach(()=>{vi.resetAllMocks();m.getUser.mockResolvedValue({data:{user:{id:'current-user',app_metadata:{}}},error:null});m.update.mockResolvedValue({error:null});m.profile.mockResolvedValue({error:null});m.store.mockResolvedValue(null);m.project.mockResolvedValue(null);m.refresh.mockResolvedValue({error:null})})
describe('workspace activation',()=>{
 it('creates creator storage without silently enabling merchant and ignores submitted owner',async()=>{
  expect(await createStoreAction(form())).toEqual({success:true,redirectUrl:'/dashboard/content'})
  expect(m.initStore).toHaveBeenCalledWith(expect.objectContaining({owner_id:'current-user'}))
  expect(m.update).toHaveBeenCalledWith('current-user',{app_metadata:{creator_enabled:true,merchant_enabled:false}})
  expect(m.profile).toHaveBeenCalledWith({data:{creator_profile:{name:'测试名称',bio:''},creator_upload_intro_pending:true}})
 })
 it('adds creator to a legacy merchant and preserves its project',async()=>{
  m.store.mockResolvedValue({id:'existing-store'});m.project.mockResolvedValue({id:'existing-project'})
  await createStoreAction(form())
  expect(m.update).toHaveBeenCalledWith('current-user',{app_metadata:{creator_enabled:true,merchant_enabled:true}})
  expect(m.initProject).not.toHaveBeenCalled()
  expect(m.profile).toHaveBeenCalledWith({data:{creator_profile:{name:'测试名称',bio:''},creator_upload_intro_pending:true}})
 })
 it('adds merchant without disabling creator',async()=>{
  m.getUser.mockResolvedValue({data:{user:{id:'current-user',app_metadata:{creator_enabled:true,merchant_enabled:false}}}})
  await createStoreAction(form('merchant'))
  expect(m.update).toHaveBeenCalledWith('current-user',{app_metadata:{merchant_enabled:true}})
  expect(m.profile).not.toHaveBeenCalled()
 })
 it('does not enable creator when provisioning fails',async()=>{
  m.initStore.mockRejectedValue(new Error('unavailable'))
  expect((await createStoreAction(form())).success).toBe(false);expect(m.update).not.toHaveBeenCalledWith('current-user',expect.objectContaining({app_metadata:expect.objectContaining({creator_enabled:true})}))
 })
 it('reports metadata failure instead of claiming success',async()=>{
  m.update.mockResolvedValue({error:{message:'failed'}})
  expect((await createStoreAction(form())).success).toBe(false)
 })
 it('retries a partially provisioned creator without enabling merchant',async()=>{
  m.getUser.mockResolvedValue({data:{user:{id:'current-user',app_metadata:{merchant_enabled:false}}}})
  m.store.mockResolvedValue({id:'existing-store'})
  await createStoreAction(form())
  expect(m.update).toHaveBeenCalledWith('current-user',{app_metadata:{creator_enabled:true,merchant_enabled:false}})
 })
 it('requires login',async()=>{
  m.getUser.mockResolvedValue({data:{user:null},error:null})
  expect((await createStoreAction(form())).success).toBe(false);expect(m.initStore).not.toHaveBeenCalled()
 })
 it('rejects arbitrary capabilities',async()=>{
  expect((await createStoreAction(form('admin'))).success).toBe(false);expect(m.update).not.toHaveBeenCalled()
 })
 it('saves trimmed creator identity without replacing the merchant project',async()=>{
  m.store.mockResolvedValue({id:'merchant-store'});m.project.mockResolvedValue({id:'merchant-project'})
  const input=form();input.set('store_name','  独立创作者  ');input.set('description','  日常摄影  ')
  expect(await createStoreAction(input)).toEqual({success:true,redirectUrl:'/dashboard/content'})
  expect(m.profile).toHaveBeenCalledWith({data:{creator_profile:{name:'独立创作者',bio:'日常摄影'},creator_upload_intro_pending:true}});expect(m.initProject).not.toHaveBeenCalled()
 })
 it('does not grant creator access if its profile cannot be saved',async()=>{
  m.profile.mockResolvedValue({error:{message:'database unavailable'}})
  expect((await createStoreAction(form())).success).toBe(false)
  expect(m.update).not.toHaveBeenCalledWith('current-user',expect.objectContaining({app_metadata:expect.objectContaining({creator_enabled:true})}))
 })
 it.each([['store_name',' '],['store_name','x'.repeat(41)],['description','x'.repeat(241)]])('validates %s on the server',async(key,value)=>{
  const input=form();input.set(key,value)
  expect((await createStoreAction(input)).success).toBe(false);expect(m.initStore).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled()
 })
 it('reports a failed session refresh after activation',async()=>{
  m.refresh.mockResolvedValue({error:{message:'refresh failed'}})
  expect(await createStoreAction(form())).toEqual({success:false,error:'登录状态刷新失败，请重新登录后继续'})
 })
 it('shows the upload intro only for newly enabled creators',async()=>{
  m.getUser.mockResolvedValue({data:{user:{id:'current-user',app_metadata:{creator_enabled:true,merchant_enabled:false}}},error:null})
  await createStoreAction(form())
  expect(m.profile).toHaveBeenCalledWith({data:{creator_profile:{name:'测试名称',bio:''}}})
 })
 it('saves dismissal for the authenticated creator',async()=>{
  m.getUser.mockResolvedValue({data:{user:{id:'current-user',app_metadata:{creator_enabled:true},user_metadata:{creator_upload_intro_pending:true}}},error:null})
  await dismissCreatorUploadIntroAction()
  expect(m.profile).toHaveBeenCalledWith({data:{creator_upload_intro_pending:false}})
 })
 it('does not save dismissal for an unauthenticated visitor',async()=>{
  m.getUser.mockResolvedValue({data:{user:null},error:null})
  await dismissCreatorUploadIntroAction()
  expect(m.profile).not.toHaveBeenCalled()
 })
})
