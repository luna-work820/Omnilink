import { createHash } from 'node:crypto'
import { z } from 'zod'
import { SITE_DATA_VERSION, SITE_RUNTIME_VERSION } from './contracts'

export const SITE_ENTRIES = {
  home: 'src/pages/home.tsx', products: 'src/pages/products.tsx', product: 'src/pages/product.tsx',
} as const
export const SOURCE_LIMITS = { files: 48, fileBytes: 100_000, totalBytes: 500_000 } as const
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const changeSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('write'), path: z.string(), content: z.string() }).strict(),
  z.object({ operation: z.literal('delete'), path: z.string() }).strict(),
])
const changeSetSchema = z.object({
  protocolVersion: z.literal('1'), baseRevisionId: digest.nullable(),
  changes: z.array(changeSchema).min(1).max(64),
}).strict()
export type SiteChangeSet = z.infer<typeof changeSetSchema>
export type SiteSourceRevision = Readonly<{
  id: string; parentId: string | null; protocolVersion: '1'; dataVersion: '1'; runtimeVersion: '1'
  files: Readonly<Record<string, string>>
}>
export class SiteSourceError extends Error {
  constructor(public readonly code: 'INVALID_FILES' | 'VERSION_CONFLICT', message: string) { super(message); this.name = 'SiteSourceError' }
}
export function isEditableSitePath(path: string) {
  if (path.length > 200 || path.includes('\\') || path.includes('%') || path.includes('\0')) return false
  const parts = path.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))) return false
  return /^src\/(pages|components)\/[A-Za-z0-9_/-]+\.(tsx|ts)$/.test(path)
    || /^src\/styles\/[A-Za-z0-9_/-]+\.css$/.test(path)
}
export function applySiteChanges(current: SiteSourceRevision | null, input: unknown): SiteSourceRevision {
  const parsed = changeSetSchema.safeParse(input)
  if (!parsed.success) throw new SiteSourceError('INVALID_FILES', '网站文件变更协议无效')
  const changeSet = parsed.data
  if (changeSet.baseRevisionId !== (current?.id ?? null)) throw new SiteSourceError('VERSION_CONFLICT', '网站已更新，请基于最新版本修改')
  const files: Record<string, string> = { ...current?.files }
  const touched = new Set<string>()
  for (const change of changeSet.changes) {
    if (!isEditableSitePath(change.path) || touched.has(change.path)) throw new SiteSourceError('INVALID_FILES', '文件路径不允许修改或存在重复变更')
    touched.add(change.path)
    if (change.operation === 'delete') {
      if (!Object.hasOwn(files, change.path)) throw new SiteSourceError('INVALID_FILES', '待删除文件不存在')
      delete files[change.path]
    } else {
      if (Buffer.byteLength(change.content, 'utf8') > SOURCE_LIMITS.fileBytes || change.content.includes('\0')) throw new SiteSourceError('INVALID_FILES', '文件过大或不是有效文本')
      files[change.path] = change.content
    }
  }
  if (Object.keys(files).some((path) => !isEditableSitePath(path))) throw new SiteSourceError('INVALID_FILES', '源代码版本包含受保护文件')
  if (Object.keys(files).length > SOURCE_LIMITS.files || Object.values(files).reduce((bytes, content) => bytes + Buffer.byteLength(content, 'utf8'), 0) > SOURCE_LIMITS.totalBytes) throw new SiteSourceError('INVALID_FILES', '网站文件超过限制')
  if (Object.values(SITE_ENTRIES).some((entry) => !files[entry]?.trim())) throw new SiteSourceError('INVALID_FILES', '缺少首页、商品列表或商品详情入口')
  const canonicalFiles = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
  const payload = { protocolVersion: '1', dataVersion: SITE_DATA_VERSION, runtimeVersion: SITE_RUNTIME_VERSION, parentId: current?.id ?? null, files: canonicalFiles } as const
  const id = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  return Object.freeze({ ...payload, id, files: Object.freeze(canonicalFiles) })
}
