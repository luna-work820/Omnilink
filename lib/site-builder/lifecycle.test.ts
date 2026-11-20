import { describe, expect, it } from 'vitest'
import { advanceSiteJob, assertSiteReleaseAllowed, type SiteBuildRecord } from './lifecycle'
const build:SiteBuildRecord={id:'build-a',siteId:'site-a',storeId:'store-a',sourceRevisionId:'source-a',status:'ready',artifactDigest:'a'.repeat(64),dataVersion:'1',runtimeVersion:'1'}
const site={id:'site-a',storeId:'store-a',expectedSourceRevisionId:'source-a'}
describe('site task and publication preconditions',()=>{
 it('rejects stale completions after cancellation and prevents ready from returning to generation',()=>{
  const job={id:'job-a',status:'building' as const,revision:2}
  const cancelled=advanceSiteJob(job,2,'cancelled')
  expect(()=>advanceSiteJob(cancelled,2,'ready')).toThrow('JOB_VERSION_CONFLICT')
  expect(()=>advanceSiteJob(cancelled,3,'ready')).toThrow('INVALID_JOB_TRANSITION')
  expect(()=>advanceSiteJob({...job,status:'ready'},2,'generating')).toThrow()
 })
 it('does not allow skipping generation/build verification',()=>{
  expect(()=>advanceSiteJob({id:'a',status:'queued',revision:0},0,'ready')).toThrow()
 })
 it('allows owner/admin with matching ready artifact and rejects editor publication',()=>{
  expect(()=>assertSiteReleaseAllowed({build,site,role:'owner'})).not.toThrow()
  expect(()=>assertSiteReleaseAllowed({build,site,role:'admin'})).not.toThrow()
  expect(()=>assertSiteReleaseAllowed({build,site,role:'editor'})).toThrow('PUBLISH_FORBIDDEN')
 })
 it.each([{storeId:'other'},{siteId:'other'},{sourceRevisionId:'old'},{status:'building' as const},{artifactDigest:null},{dataVersion:'2'},{runtimeVersion:'2'}])('rejects ineligible build %j',(patch)=>{
  expect(()=>assertSiteReleaseAllowed({build:{...build,...patch},site,role:'owner'})).toThrow()
 })
})
