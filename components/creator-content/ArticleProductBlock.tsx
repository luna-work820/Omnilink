'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import type { ReactCustomBlockRenderProps } from '@blocknote/react'
import Image from 'next/image'
import { ImagePlus, ShoppingBag, X } from 'lucide-react'
import type { articleProductBlockConfig } from '@/lib/creator-article-editor'
import { articleProductUrl, readArticleImage } from '@/lib/creator-article-media'
import styles from './CreatorArticleWorkspace.module.css'

type ProductBlockProps = ReactCustomBlockRenderProps<typeof articleProductBlockConfig>
type ProductFields = ProductBlockProps['block']['props']

function ProductCardContent({ fields }: { fields: ProductFields }) {
  const url = articleProductUrl(fields.url)
  return <>
    <span className={styles.productImage}>{fields.image ? <Image src={fields.image} alt="" width={80} height={80} unoptimized /> : <ShoppingBag size={24} strokeWidth={1.5} aria-hidden="true" />}</span>
    <span className={styles.productInfo}>
      <span className={styles.productName}>{fields.name.trim() || (url ? new URL(url).hostname : '商品链接')}</span>
      {fields.price.trim() && <span className={styles.productPrice}>{fields.price}</span>}
      <span className={styles.productDomain}>{url ? new URL(url).hostname : '添加链接'}</span>
    </span>
  </>
}

export function ArticleProductExternalCard({ block }: ProductBlockProps) {
  const url = articleProductUrl(block.props.url)
  if (!url) return <div className={styles.productEmpty}>商品链接尚未填写</div>
  return <a href={url} target="_blank" rel="noopener noreferrer" className={styles.productCard}><ProductCardContent fields={block.props} /></a>
}

export function ArticleProductBlockView({ block, editor }: ProductBlockProps) {
  const dialogId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [fields, setFields] = useState<ProductFields>(block.props)
  const [error, setError] = useState('')
  const [readingImage, setReadingImage] = useState(false)
  const productUrl = articleProductUrl(block.props.url)

  function openEditor() {
    setFields(block.props)
    setError('')
    dialogRef.current?.showModal()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const url = articleProductUrl(fields.url)
    if (!url) { setError('请输入有效的 http 或 https 商品链接。'); return }
    editor.updateBlock(block, { props: { ...fields, url, name: fields.name.trim(), price: fields.price.trim() } })
    dialogRef.current?.close()
    editor.focus()
  }

  async function selectImage(file: File | undefined) {
    if (!file) return
    setReadingImage(true)
    try {
      const image = await readArticleImage(file)
      setFields((current) => ({ ...current, image }))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '图片读取失败，请重试。')
    } finally {
      setReadingImage(false)
    }
  }

  if (!editor.isEditable) return <ArticleProductExternalCard block={block} editor={editor} />

  return <div className={styles.productBlock} contentEditable={false}>
    <button type="button" className={styles.productCard} data-liquid-skip="" onClick={openEditor} aria-label={productUrl ? `编辑商品卡片：${block.props.name || new URL(productUrl).hostname}` : '添加商品链接'}><ProductCardContent fields={block.props} /></button>
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={dialogId} onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close() }}>
      <form onSubmit={submit}>
        <div className={styles.dialogHeading}><h2 id={dialogId}>商品卡片</h2><button type="button" className={styles.close} aria-label="关闭商品卡片" onClick={() => dialogRef.current?.close()}><X size={18} aria-hidden="true" /></button></div>
        <div className={styles.productForm}>
          <label>链接<input type="url" required aria-label="商品链接" placeholder="https://" value={fields.url} onChange={(event) => setFields((current) => ({ ...current, url: event.target.value }))} /></label>
          <label>名称<input aria-label="商品名称" placeholder="选填" maxLength={100} value={fields.name} onChange={(event) => setFields((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>价格<input aria-label="商品价格" placeholder="选填" maxLength={30} value={fields.price} onChange={(event) => setFields((current) => ({ ...current, price: event.target.value }))} /></label>
          <div className={styles.productImageField}>
            {fields.image && <Image src={fields.image} alt="商品图片" width={64} height={64} unoptimized />}
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="选择商品图片" onChange={(event) => { void selectImage(event.target.files?.[0]); event.target.value = '' }} />
            <button type="button" className={styles.control} disabled={readingImage} onClick={() => imageInputRef.current?.click()}><ImagePlus size={16} aria-hidden="true" />{readingImage ? '读取中…' : fields.image ? '更换图片' : '添加图片'}</button>
            {fields.image && <button type="button" className={styles.control} onClick={() => setFields((current) => ({ ...current, image: '' }))}>移除图片</button>}
          </div>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.dialogActions}><button type="button" className={styles.control} onClick={() => dialogRef.current?.close()}>取消</button><button type="submit" className={styles.primary} disabled={readingImage}>保存卡片</button></div>
      </form>
    </dialog>
  </div>
}
