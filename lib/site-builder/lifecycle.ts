import { SITE_DATA_VERSION, SITE_RUNTIME_VERSION } from './contracts'

export type SiteJobStatus = 'queued' | 'generating' | 'building' | 'ready' | 'failed' | 'cancelled'
export type SiteJobState = Readonly<{ id: string; status: SiteJobStatus; revision: number }>
const transitions: Record<SiteJobStatus, readonly SiteJobStatus[]> = {
  queued: ['generating', 'cancelled'],
  generating: ['building', 'failed', 'cancelled'],
  building: ['ready', 'failed', 'cancelled'],
  ready: [], failed: [], cancelled: [],
}
export function advanceSiteJob(current: SiteJobState, expectedRevision: number, status: SiteJobStatus): SiteJobState {
  if (current.revision !== expectedRevision) throw new Error('JOB_VERSION_CONFLICT')
  if (!transitions[current.status].includes(status)) throw new Error('INVALID_JOB_TRANSITION')
  return Object.freeze({ ...current, status, revision: current.revision + 1 })
}
export type SiteBuildRecord = Readonly<{
  id: string; siteId: string; storeId: string; sourceRevisionId: string; status: SiteJobStatus
  dataVersion: string; runtimeVersion: string; artifactDigest: string | null
}>
export function assertSiteReleaseAllowed(input: {
  build: SiteBuildRecord
  site: { id: string; storeId: string; expectedSourceRevisionId: string }
  role: 'owner' | 'admin' | 'editor' | null
}) {
  if (input.role !== 'owner' && input.role !== 'admin') throw new Error('PUBLISH_FORBIDDEN')
  const { build, site } = input
  if (build.siteId !== site.id || build.storeId !== site.storeId) throw new Error('BUILD_SCOPE_MISMATCH')
  if (build.status !== 'ready' || !build.artifactDigest || !/^[a-f0-9]{64}$/.test(build.artifactDigest)) throw new Error('BUILD_NOT_READY')
  if (build.sourceRevisionId !== site.expectedSourceRevisionId) throw new Error('SOURCE_VERSION_CONFLICT')
  if (build.dataVersion !== SITE_DATA_VERSION || build.runtimeVersion !== SITE_RUNTIME_VERSION) throw new Error('INCOMPATIBLE_BUILD')
}
