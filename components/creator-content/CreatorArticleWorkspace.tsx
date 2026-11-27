'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core'
import { zh } from '@blocknote/core/locales'
import {
  FormattingToolbar,
  FormattingToolbarController,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  useBlockNoteEditor,
  useCreateBlockNote,
  useEditorState,
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { Dialog, Popover } from 'radix-ui'
import { Check, Eye, ImagePlus, Palette, ShoppingBag, Store, X } from 'lucide-react'
import { readArticleDraft, writeArticleDraft, type ArticleDraft } from '@/lib/creator-article-draft'
import { articleBackgrounds, getArticleBackground } from '@/lib/creator-article-backgrounds'
import { articleBlocksForEditor, articleBlocksFromEditor, articleSchema } from '@/lib/creator-article-editor'
import { readArticleImage } from '@/lib/creator-article-media'
import { ArticlePhonePreview } from './ArticlePhonePreview'
import { getLocalPublication } from '@/lib/creator-publications'
import { readRemotePublication } from '@/lib/creator-publication-client'
import '@blocknote/shadcn/style.css'
import styles from './CreatorArticleWorkspace.module.css'

const allowedMenuTitles = new Set([
  zh.slash_menu.paragraph.title,
  zh.slash_menu.heading.title,
  zh.slash_menu.heading_2.title,
  zh.slash_menu.heading_3.title,
  zh.slash_menu.bullet_list.title,
  zh.slash_menu.numbered_list.title,
  zh.slash_menu.check_list.title,
  zh.slash_menu.quote.title,
  zh.slash_menu.divider.title,
  zh.slash_menu.image.title,
])

function ArticleFormattingToolbar() {
  const editor = useBlockNoteEditor<typeof articleSchema.blockSchema, typeof articleSchema.inlineContentSchema, typeof articleSchema.styleSchema>()
  const productSelected = useEditorState({
    editor,
    selector: ({ editor }) => (editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block]).some((block) => block.type === 'productLink'),
  })
  if (productSelected) return null
  return <FormattingToolbar>{getFormattingToolbarItems().filter((item) => !['colorStyleButton', 'addCommentButton', 'addTiptapCommentButton'].includes(String(item.key)))}</FormattingToolbar>
}

type ArticleWorkspaceProps = { draftKey: string; ownerKey: string; recordId?: string; previewMode?: boolean; onSaveDraft: (draft: ArticleDraft) => Promise<void> }

export default function CreatorArticleWorkspace({ draftKey, ownerKey, recordId, previewMode = false, onSaveDraft }: ArticleWorkspaceProps) {
  const [loaded, setLoaded] = useState<{ draft: ArticleDraft | null } | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const readPublication = () => !recordId ? Promise.resolve(null) : previewMode ? getLocalPublication(ownerKey, recordId) : readRemotePublication(recordId).catch(async (cause) => { const local = await getLocalPublication(ownerKey, recordId); if (!local) throw cause; return local })
    Promise.all([readArticleDraft(draftKey), readPublication()]).then(([saved, record]) => {
      const content = record?.pending ?? record?.content
      const article = content?.kind === 'article' ? content.article : null
      const draft = saved && saved.updatedAt >= (record?.updatedAt ?? 0) ? saved : article ?? saved
      if (!cancelled) { setLoaded({ draft }); setLoadError(false) }
    }).catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [draftKey, ownerKey, recordId, previewMode, attempt])

  if (loadError) return <div className={styles.loading} role="alert"><p>草稿读取失败，请检查浏览器存储权限。</p><button type="button" className={styles.control} onClick={() => { setLoadError(false); setAttempt((current) => current + 1) }}>重试</button></div>
  if (!loaded) return <p className={styles.loading} role="status">正在读取文章草稿…</p>
  return <ArticleEditor key={draftKey} draftKey={draftKey} initialDraft={loaded.draft} onSaveDraft={onSaveDraft} />
}

function ArticleEditor({ draftKey, initialDraft, onSaveDraft }: { draftKey: string; initialDraft: ArticleDraft | null } & Pick<ArticleWorkspaceProps, 'onSaveDraft'>) {
  const [draft, setDraft] = useState<ArticleDraft>(() => initialDraft ?? {
    version: 2, title: '', background: 'white', cover: null, blocks: [], updatedAt: 0,
  })
  const [preview, setPreview] = useState(false)
  const [canSplitPreview, setCanSplitPreview] = useState(false)
  const [saveState, setSaveState] = useState<'empty' | 'pending' | 'saving' | 'saved' | 'error'>(initialDraft ? 'saved' : 'empty')
  const [error, setError] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [coverLoading, setCoverLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const revision = useRef(0)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const workspaceRef = useRef<HTMLElement>(null)
  const previewButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return
    const measure = () => setCanSplitPreview(workspace.clientWidth >= 980)
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(workspace)
    return () => observer.disconnect()
  }, [])

  const editor = useCreateBlockNote({
    schema: articleSchema,
    dictionary: {
      ...zh,
      placeholders: { ...zh.placeholders, default: '输入正文，或输入 / 添加部件' },
    },
    initialContent: draft.blocks.length ? articleBlocksForEditor(draft.blocks) : undefined,
    domAttributes: { editor: { 'aria-label': '文章正文' } },
    uploadFile: async (file) => {
      try { const image = await readArticleImage(file); setError(''); return image }
      catch (cause) { setError(cause instanceof Error ? cause.message : '图片读取失败，请重试。'); throw cause }
    },
  })

  function updateDraft(change: Partial<ArticleDraft>) {
    revision.current += 1
    setDraft((current) => ({ ...current, ...change, updatedAt: Date.now() }))
    setSaveState('pending')
    setError('')
  }

  const persist = useCallback((snapshot: ArticleDraft, savedRevision: number) => {
    setSaveState('saving')
    const operation = saveQueue.current.catch(() => {}).then(() => writeArticleDraft(draftKey, snapshot))
    saveQueue.current = operation
    return operation.then(() => {
      if (revision.current === savedRevision) setSaveState('saved')
    }).catch(() => {
      if (revision.current === savedRevision) setSaveState('error')
    })
  }, [draftKey])

  useEffect(() => {
    if (!revision.current) return
    const currentRevision = revision.current
    saveTimer.current = setTimeout(() => { void persist(draft, currentRevision) }, 700)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [draft, persist])

  async function saveNow(register = false) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const snapshot = { ...draft, blocks: articleBlocksFromEditor(editor.document) }
    await persist(snapshot, revision.current)
    if (register) {
      setPublishing(true)
      try { await onSaveDraft(snapshot) }
      catch { setError('内容管理记录保存失败，请重试。') }
      finally { setPublishing(false) }
    }
  }

  async function selectCover(file: File | undefined) {
    if (!file) return
    setCoverLoading(true)
    try { updateDraft({ cover: { url: await readArticleImage(file), position: 50 } }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '封面读取失败，请重试。') }
    finally { setCoverLoading(false) }
  }

  const background = getArticleBackground(draft.background)
  const statusLabel = { empty: '草稿仅保存在本机', pending: '有未保存的修改', saving: '保存中…', saved: '已保存到本机', error: '保存失败，请检查存储空间后重试' }[saveState]
  const inlinePreview = preview && canSplitPreview

  return <section ref={workspaceRef} className={`${styles.workspace} ${inlinePreview ? styles.workspaceWithPreview : ''}`} aria-label="文章编辑器" style={{ '--article-background': background.color } as CSSProperties}>
    <div className={styles.toolbar}>
      <div className={styles.tools}>
        <Popover.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
          <Popover.Trigger asChild><button type="button" data-liquid-skip="" className={styles.control} aria-label="文章背景色盘"><Palette size={16} aria-hidden="true" />背景<span className={styles.currentColor} style={{ background: background.color }} aria-hidden="true" /></button></Popover.Trigger>
          <Popover.Portal><Popover.Content className={styles.paletteContent} align="start" sideOffset={8} aria-label="文章背景色盘">
            <div className={styles.paletteHeading}><span>背景颜色</span><Popover.Close asChild><button type="button" data-liquid-skip="" className={styles.close} aria-label="关闭色盘"><X size={16} aria-hidden="true" /></button></Popover.Close></div>
            <div className={styles.paletteGrid}>{articleBackgrounds.map((item) => <button key={item.id} type="button" data-liquid-skip="" className={styles.swatch} aria-label={`${item.label}背景`} aria-pressed={draft.background === item.id} title={item.label} onClick={() => { updateDraft({ background: item.id }); setPaletteOpen(false) }}><span style={{ background: item.color }}>{draft.background === item.id && <Check size={14} aria-hidden="true" />}</span></button>)}</div>
          </Popover.Content></Popover.Portal>
        </Popover.Root>
      </div>
      <div className={styles.actions}>
        <span className={styles.status} role="status">{saveState === 'error' ? '未保存' : statusLabel}</span>
        <button ref={previewButtonRef} type="button" data-liquid-skip="" className={styles.control} aria-expanded={preview} aria-haspopup={canSplitPreview ? undefined : 'dialog'} onClick={() => setPreview((current) => !current)}><Eye size={16} aria-hidden="true" />{inlinePreview ? '收起预览' : '预览'}</button>
        <button type="button" data-liquid-skip="" className={styles.primary} onClick={() => { void saveNow(true) }} disabled={saveState === 'saving' || publishing}>存草稿</button>
      </div>
    </div>

    {saveState === 'error' && <p className={styles.error} role="alert">{statusLabel}<button type="button" onClick={() => { void saveNow() }} className={styles.control}>重试</button></p>}
    {error && <p className={styles.error} role="alert">{error}</p>}

    <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="选择文章封面" onChange={(event) => { void selectCover(event.target.files?.[0]); event.target.value = '' }} />
    <div className={`${styles.documentLayout} ${inlinePreview ? styles.withPreview : ''}`}>
    <article className={styles.paper} aria-label="文章正文">
      {draft.cover ? <div className={styles.cover}>
        {/* The cover uses its intrinsic dimensions so uploads are never cropped or stretched. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={draft.cover.url} alt="文章封面" />
        <div className={styles.coverActions}><button type="button" data-liquid-skip="" className={styles.coverControl} disabled={coverLoading} onClick={() => coverInputRef.current?.click()}>更换封面</button><button type="button" data-liquid-skip="" className={styles.coverControl} onClick={() => updateDraft({ cover: null })}>移除</button></div>
      </div> : <div className={styles.emptyCover}><button type="button" data-liquid-skip="" className={styles.control} disabled={coverLoading} onClick={() => coverInputRef.current?.click()}><ImagePlus size={16} aria-hidden="true" />{coverLoading ? '读取封面中…' : '添加封面'}</button></div>}
      <div className={styles.paperBody}>
      <input className={styles.titleInput} data-liquid-skip="" aria-label="文章标题" value={draft.title} maxLength={100} placeholder="文章标题" onChange={(event) => updateDraft({ title: event.target.value })} />
      <BlockNoteView
        className={styles.editor}
        editor={editor}
        theme="light"
        editable
        formattingToolbar={false}
        slashMenu={false}
        sideMenu
        filePanel
        linkToolbar
        tableHandles={false}
        emojiPicker={false}
        onChange={() => updateDraft({ blocks: articleBlocksFromEditor(editor.document) })}
      >
          <SuggestionMenuController triggerCharacter="/" getItems={async (query) => filterSuggestionItems([
            ...getDefaultReactSlashMenuItems(editor).filter((item) => allowedMenuTitles.has(item.title)).map((item) => ({ ...item, subtext: undefined, group: undefined })),
            { title: '商品卡片', aliases: ['商品', '链接', 'product', 'shop'], icon: <ShoppingBag size={18} aria-hidden="true" />, onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'productLink' }) },
            { title: '店铺链接卡片', aliases: ['店铺', '商店', '淘宝店', 'shop link'], icon: <Store size={18} aria-hidden="true" />, onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'productLink', props: { kind: 'shop' } }) },
          ], query)} />
          <FormattingToolbarController formattingToolbar={ArticleFormattingToolbar} />
      </BlockNoteView>
      </div>
    </article>
    {inlinePreview && <ArticlePhonePreview draft={draft} />}
    </div>
    <Dialog.Root open={preview && !canSplitPreview} onOpenChange={setPreview}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.previewOverlay} />
        <Dialog.Content className={styles.previewDialog} style={{ '--article-background': background.color } as CSSProperties} aria-describedby={undefined} onCloseAutoFocus={(event) => { event.preventDefault(); previewButtonRef.current?.focus({ preventScroll: true }) }}>
          <div className={styles.previewHeading}>
            <Dialog.Title>手机预览</Dialog.Title>
            <Dialog.Close asChild><button type="button" data-liquid-skip="" className={styles.close} aria-label="关闭预览"><X size={18} aria-hidden="true" /></button></Dialog.Close>
          </div>
          <ArticlePhonePreview draft={draft} showLabel={false} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </section>
}
