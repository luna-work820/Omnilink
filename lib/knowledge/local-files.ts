export const KNOWLEDGE_FILES_STORAGE_KEY = 'omnilink_knowledge_files_v1'
export const KNOWLEDGE_FILES_UPDATED_EVENT = 'omnilink:knowledge-files-updated'

export interface LinkedProductReference {
  id?: string
  name: string
  imageUrl?: string
}

export interface StoredKnowledgeFile {
  id: string
  title: string
  excerpt: string
  date: string
  kind: 'document'
  fileType: string
  tags: string[]
  fileLink?: string
  markdown: string
  parsedJson: Record<string, unknown>
  folderId?: string
  linkedProducts?: LinkedProductReference[]
  sizeBytes?: number
  uploadedAt?: string
  updatedAt?: string
}

function isStoredKnowledgeFile(value: unknown): value is StoredKnowledgeFile {
  if (!value || typeof value !== 'object') return false
  const file = value as Partial<StoredKnowledgeFile>
  return typeof file.id === 'string'
    && typeof file.title === 'string'
    && typeof file.markdown === 'string'
    && typeof file.fileType === 'string'
    && Array.isArray(file.tags)
    && Boolean(file.parsedJson && typeof file.parsedJson === 'object')
}

export function readStoredKnowledgeFiles(): StoredKnowledgeFile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KNOWLEDGE_FILES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter(isStoredKnowledgeFile) : []
  } catch {
    return []
  }
}

export function writeStoredKnowledgeFiles(files: StoredKnowledgeFile[]) {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(KNOWLEDGE_FILES_STORAGE_KEY, JSON.stringify(files))
    window.dispatchEvent(new CustomEvent(KNOWLEDGE_FILES_UPDATED_EVENT))
    return true
  } catch {
    return false
  }
}

export function upsertStoredKnowledgeFiles(files: StoredKnowledgeFile[]) {
  const next = new Map(readStoredKnowledgeFiles().map((file) => [file.id, file]))
  files.forEach((file) => next.set(file.id, file))
  if (!writeStoredKnowledgeFiles(Array.from(next.values()))) {
    throw new Error('Knowledge file storage is unavailable')
  }
}

export function unlinkStoredKnowledgeFileFromProduct(fileId: string, productId: string) {
  const next = readStoredKnowledgeFiles().map((file) => file.id === fileId
    ? { ...file, linkedProducts: file.linkedProducts?.filter((product) => product.id !== productId) }
    : file)
  return writeStoredKnowledgeFiles(next)
}

export function formatKnowledgeFileSize(sizeBytes?: number) {
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes)) return ''
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileTypeLabel(file: File) {
  const extension = file.name.split('.').pop()?.trim().toUpperCase()
  return extension || file.type || 'FILE'
}

function canReadAsText(file: File) {
  return file.type.startsWith('text/')
    || /\.(md|markdown|txt|json|csv|xml|html|css|js|jsx|ts|tsx)$/i.test(file.name)
}

async function buildMarkdownPreview(file: File) {
  if (!canReadAsText(file)) {
    return `# ${file.name}\n\n文件已上传并建立商品关联。AI 解析完成后，正文会显示在这里。`
  }

  const text = (await file.text()).slice(0, 100_000)
  if (/\.(md|markdown)$/i.test(file.name)) return text || `# ${file.name}`
  return `# ${file.name}\n\n\`\`\`${file.name.toLowerCase().endsWith('.json') ? 'json' : 'text'}\n${text}\n\`\`\``
}

export async function createStoredKnowledgeFile(
  file: File,
  linkedProduct?: LinkedProductReference,
): Promise<StoredKnowledgeFile> {
  const uploadedAt = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title: file.name,
    excerpt: '文件已上传，正在等待 AI 解析。',
    date: '刚刚上传',
    kind: 'document',
    fileType: fileTypeLabel(file),
    tags: linkedProduct ? ['商品关联'] : ['文件'],
    markdown: await buildMarkdownPreview(file),
    parsedJson: {
      parseStatus: 'pending',
      originalFileName: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
      sourceKind: 'upload',
    },
    linkedProducts: linkedProduct ? [linkedProduct] : undefined,
    sizeBytes: file.size,
    uploadedAt,
    updatedAt: uploadedAt,
  }
}
