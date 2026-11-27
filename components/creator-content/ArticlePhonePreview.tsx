'use client'

import { useEffect, type CSSProperties } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { zh } from '@blocknote/core/locales'
import { articleBlocksForEditor, articleSchema } from '@/lib/creator-article-editor'
import type { ArticleDraft } from '@/lib/creator-article-draft'
import styles from './CreatorArticleWorkspace.module.css'
import { getArticleBackground } from '@/lib/creator-article-backgrounds'
import '@blocknote/shadcn/style.css'

export function ArticlePhonePreview({ draft, frame = true, showLabel = true }: { draft: ArticleDraft; frame?: boolean; showLabel?: boolean }) {
  const reader = useCreateBlockNote({
    schema: articleSchema,
    dictionary: zh,
    initialContent: draft.blocks.length ? articleBlocksForEditor(draft.blocks) : undefined,
    domAttributes: { editor: { 'aria-label': frame ? '手机文章正文' : '文章正文' } },
  })

  useEffect(() => {
    reader.replaceBlocks(reader.document, draft.blocks.length ? articleBlocksForEditor(draft.blocks) : [{ type: 'paragraph' }])
  }, [draft.blocks, reader])

  const Title = frame ? 'h2' : 'h1'
  const article = <article className={styles.phoneArticle} style={{ '--article-background': getArticleBackground(draft.background).color } as CSSProperties}>
    {draft.cover && <div className={styles.phoneCover}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={draft.cover.url} alt="文章封面" />
    </div>}
    <div className={styles.phoneBody}>
      <Title className={styles.title}>{draft.title.trim() || '未命名文章'}</Title>
      <BlockNoteView className={`${styles.editor} ${styles.phoneEditor}`} editor={reader} theme="light" editable={false} formattingToolbar={false} slashMenu={false} sideMenu={false} filePanel={false} linkToolbar={false} tableHandles={false} emojiPicker={false} />
      {!draft.blocks.length && <p className={styles.empty}>正文尚未填写</p>}
    </div>
  </article>
  if (!frame) return article
  return <aside className={styles.deviceColumn} aria-label="手机阅读预览">
    {showLabel && <div className={styles.deviceLabel}>手机预览</div>}
    <div className={styles.device}>
      <div className={styles.deviceCamera} aria-hidden="true" />
      <div className={styles.deviceViewport}>
        {article}
      </div>
      <div className={styles.deviceHome} aria-hidden="true" />
    </div>
  </aside>
}
