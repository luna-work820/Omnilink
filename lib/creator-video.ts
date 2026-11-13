export const CREATOR_VIDEO_BUCKET = 'creator-content-videos'
export const CREATOR_VIDEO_PREFIX = '/api/creator-posts/media/'
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const objectPath = new RegExp(`^${uuid}/${uuid}/${uuid}\\.(mp4|webm)$`, 'i')

export function isCreatorVideoPath(path: string): boolean {
  return objectPath.test(path)
}

export function creatorVideoUrl(path: string): string {
  if (!isCreatorVideoPath(path)) throw new Error('视频路径无效。')
  return `${CREATOR_VIDEO_PREFIX}${path}`
}

export function creatorVideoPath(url: string): string | null {
  if (!url.startsWith(CREATOR_VIDEO_PREFIX)) return null
  const path = url.slice(CREATOR_VIDEO_PREFIX.length)
  return isCreatorVideoPath(path) ? path : null
}
