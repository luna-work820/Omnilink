type CreatorUpload = { kind: 'video'; file: File } | { kind: 'image'; files: File[] }

let stagedUpload: CreatorUpload | null = null

export function stageCreatorUpload(upload: CreatorUpload) {
  stagedUpload = upload
}

export function takeStagedCreatorUpload() {
  const upload = stagedUpload
  stagedUpload = null
  return upload
}

export function isCreatorVideo(file: File) {
  return file.type === 'video/mp4' || file.type === 'video/webm' || /\.(mp4|webm)$/i.test(file.name)
}

export function isCreatorImage(file: File) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name))
}

export const MAX_CREATOR_VIDEO_BYTES = 100 * 1024 * 1024
export const MAX_CREATOR_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_CREATOR_IMAGE_COUNT = 9

export function validateCreatorImages(files: File[], existingCount = 0): string | null {
  if (files.some((file) => !isCreatorImage(file))) return '图片请选择 JPG、PNG 或 WebP 格式。'
  if (files.some((file) => file.size > MAX_CREATOR_IMAGE_BYTES)) return '每张图片不能超过 5 MB。'
  if (existingCount + files.length > MAX_CREATOR_IMAGE_COUNT) return '最多上传 9 张图片。'
  return null
}
