'use client'

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import Link from 'next/link'
import { AlertCircle, ExternalLink, FileText, Loader2, UploadCloud, X } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import {
  KNOWLEDGE_FILES_STORAGE_KEY,
  KNOWLEDGE_FILES_UPDATED_EVENT,
  createStoredKnowledgeFile,
  formatKnowledgeFileSize,
  readStoredKnowledgeFiles,
  unlinkStoredKnowledgeFileFromProduct,
  upsertStoredKnowledgeFiles,
  type StoredKnowledgeFile,
} from '@/lib/knowledge/local-files'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const ACCEPTED_FILE_TYPES = '.md,.markdown,.txt,.json,.csv,.pdf,.doc,.docx,.rtf,.xls,.xlsx,.ppt,.pptx'

interface ProductDocumentsSectionProps {
  productId?: string
  productName?: string
  productImageUrl?: string
}

export function ProductDocumentsSection({
  productId,
  productName,
  productImageUrl,
}: ProductDocumentsSectionProps) {
  const { isZh } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const [documents, setDocuments] = useState<StoredKnowledgeFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const syncDocuments = useCallback(() => {
    setDocuments(readStoredKnowledgeFiles())
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(syncDocuments)
    const handleStorage = (event: StorageEvent) => {
      if (event.key === KNOWLEDGE_FILES_STORAGE_KEY) syncDocuments()
    }
    window.addEventListener(KNOWLEDGE_FILES_UPDATED_EVENT, syncDocuments)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener(KNOWLEDGE_FILES_UPDATED_EVENT, syncDocuments)
      window.removeEventListener('storage', handleStorage)
    }
  }, [syncDocuments])

  const linkedDocuments = productId
    ? documents.filter((document) => document.linkedProducts?.some((product) => product.id === productId))
    : []

  const handleFiles = async (fileList: FileList | readonly File[]) => {
    if (!productId) {
      setError(isZh ? '请先创建商品，再上传关联文件。' : 'Create the product before attaching files.')
      return
    }

    const files = Array.from(fileList)
    if (!files.length) return
    const oversizedFile = files.find((file) => file.size > MAX_FILE_SIZE)
    if (oversizedFile) {
      setError(isZh ? `${oversizedFile.name} 超过 20 MB，请选择更小的文件。` : `${oversizedFile.name} exceeds 20 MB.`)
      return
    }

    setError('')
    setNotice('')
    setIsUploading(true)
    try {
      const records = await Promise.all(files.map((file) => createStoredKnowledgeFile(file, {
        id: productId,
        name: productName?.trim() || productId,
        imageUrl: productImageUrl,
      })))
      upsertStoredKnowledgeFiles(records)
      setNotice(isZh ? `已上传并关联 ${records.length} 个文件。` : `${records.length} file(s) uploaded and linked.`)
    } catch {
      setError(isZh ? '文件处理失败，请重新选择文件。' : 'The file could not be processed. Choose it again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    void handleFiles(event.dataTransfer.files)
  }

  const handleUnlink = (fileId: string) => {
    if (!productId) return
    if (!unlinkStoredKnowledgeFileFromProduct(fileId, productId)) {
      setError(isZh ? '无法保存更改，请刷新页面后重试。' : 'The change could not be saved. Refresh and try again.')
      return
    }
    setError('')
    setNotice(isZh ? '已解除商品关联，文件仍保留在知识库。' : 'Product link removed. The file remains in Knowledge.')
  }

  return (
    <section className="mt-6" aria-labelledby="product-files-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 id="product-files-title" className="text-sm font-semibold text-[var(--text-primary)]">
            {isZh ? '关联文件' : 'Linked files'}
          </h3>
        </div>
        <div className="flex h-10 shrink-0 items-center gap-2">
          <Link href="/dashboard/knowledge" className="inline-flex h-10 items-center gap-1.5 px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2">
            <ExternalLink size={14} aria-hidden="true" />
            {isZh ? '打开知识库' : 'Open Knowledge'}
          </Link>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) void handleFiles(event.target.files)
              event.target.value = ''
            }}
          />
        </div>
      </div>

      <div
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false)
        }}
        onDrop={handleDrop}
        className={`mt-4 flex min-h-12 items-center justify-center border border-dashed px-4 py-2 transition-colors ${isDragging ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)] bg-transparent'}`}
        aria-label={productId ? (isZh ? '拖入文件上传' : 'Drop files to upload') : (isZh ? '保存商品后即可上传文件' : 'Save the product before uploading')}
        title={productId ? (isZh ? '拖入文件上传' : 'Drop files to upload') : (isZh ? '保存商品后即可上传文件' : 'Save the product before uploading')}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!productId || isUploading}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)] text-white hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"
          aria-label={isZh ? '上传关联文件' : 'Upload linked files'}
          title={isZh ? '上传关联文件' : 'Upload linked files'}
        >
          {isUploading ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <UploadCloud size={15} aria-hidden="true" />}
        </button>
      </div>

      {error && <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-[#B42318]"><AlertCircle size={14} aria-hidden="true" />{error}</p>}
      {notice && <p role="status" className="mt-3 text-xs text-[var(--text-secondary)]">{notice}</p>}

      <div className="mt-4" aria-live="polite">
        {isLoading ? (
          <div className="flex min-h-16 items-center gap-2 text-xs text-[var(--text-secondary)]"><Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />{isZh ? '正在读取关联文件' : 'Loading linked files'}</div>
        ) : linkedDocuments.length ? (
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {linkedDocuments.map((document) => (
              <li key={document.id} className="flex min-h-14 items-center gap-3 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--surface-muted)] text-[var(--text-secondary)]"><FileText size={16} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--text-primary)]">{document.title}</span>
                  <span className="mt-0.5 block text-[11px] text-[var(--text-secondary)]">
                    {[document.fileType, formatKnowledgeFileSize(document.sizeBytes), document.date].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="hidden text-[11px] text-[var(--text-secondary)] sm:block">
                  {document.parsedJson.parseStatus === 'pending' ? (isZh ? '等待 AI 解析' : 'Awaiting AI parsing') : (isZh ? '已解析' : 'Parsed')}
                </span>
                <button type="button" onClick={() => handleUnlink(document.id)} className="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]" aria-label={isZh ? `解除 ${document.title} 与当前商品的关联` : `Unlink ${document.title}`} title={isZh ? '解除关联' : 'Unlink'}><X size={15} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
