import { isCreatorImage, MAX_CREATOR_IMAGE_BYTES } from '@/lib/creator-preview-upload'

export function readArticleImage(file: File): Promise<string> {
  if (!isCreatorImage(file) || file.size > MAX_CREATOR_IMAGE_BYTES) {
    return Promise.reject(new Error('请选择 5 MB 以内的 JPG、PNG 或 WebP 图片。'))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('图片读取失败，请重新选择。'))
    reader.readAsDataURL(file)
  })
}

export function articleProductUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}
