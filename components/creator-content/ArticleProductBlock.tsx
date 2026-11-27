'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import type { ReactCustomBlockRenderProps } from '@blocknote/react'
import Image from 'next/image'
import { ImagePlus, ShoppingBag, Store, X } from 'lucide-react'
import type { articleProductBlockConfig } from '@/lib/creator-article-editor'
import { galleryItems, type GalleryItem } from '@/lib/creator-article-editor'
import { articleProductUrl, readArticleImage } from '@/lib/creator-article-media'
import styles from './CreatorArticleWorkspace.module.css'

type ProductBlockProps = ReactCustomBlockRenderProps<typeof articleProductBlockConfig>
type ProductFields = ProductBlockProps['block']['props']

const productGallery = galleryItems

function ProductCardContent({ fields }: { fields: ProductFields }) {
  return <>
    <span className={styles.productImage}>{fields.image ? <Image src={fields.image} alt="" width={80} height={80} unoptimized /> : <ShoppingBag size={24} strokeWidth={1.5} aria-hidden="true" />}</span>
    <span className={styles.productInfo}>
      <span className={styles.productName}>{fields.name.trim() || '商品'}</span>
      {fields.price.trim() && <span className={styles.productPrice}>{fields.price}</span>}
    </span>
  </>
}

function ShopCardContent({ fields, editable = false }: { fields: ProductFields; editable?: boolean }) {
  const url = articleProductUrl(fields.url)
  const gallery = productGallery(fields.gallery)
  const shopHref = url ?? '#'
  const safeHref = (link: string) => articleProductUrl(link) ?? shopHref
  return <>
    <a href={editable ? undefined : shopHref} target="_blank" rel="noopener noreferrer" className={styles.shopHeader} aria-label={editable ? undefined : `进入${fields.name.trim() || '店铺'}`} onClick={editable ? (event) => event.preventDefault() : undefined}>
      <span className={styles.shopImage}>{fields.image ? <Image src={fields.image} alt="" width={56} height={56} unoptimized /> : <Store size={22} strokeWidth={1.5} aria-hidden="true" />}</span>
      <span className={styles.shopInfo}>
        <span className={styles.shopName}>{fields.name.trim() || '店铺'}</span>
        {fields.subtitle.trim() && <span className={styles.shopSubtitle}>{fields.subtitle}</span>}
      </span>
    </a>
    {gallery.length > 0 && <span className={styles.shopGallery}>
      {gallery.map((item, index) => <a key={`${index}-${item.url.slice(-24)}`} href={editable ? undefined : safeHref(item.link)} target="_blank" rel="noopener noreferrer" className={styles.shopGalleryTile} onClick={editable ? (event) => event.preventDefault() : undefined}>
        <span className={styles.shopGalleryImage}><Image src={item.url} alt={item.name || `${fields.name.trim() || '店铺'}图片 ${index + 1}`} width={240} height={320} unoptimized /></span>
        {(item.name || item.price) && <span className={styles.shopGalleryCaption}>
          {item.name && <span className={styles.shopGalleryName}>{item.name}</span>}
          {item.price && <span className={styles.shopGalleryPrice}>{item.price}</span>}
        </span>}
      </a>)}
    </span>}
  </>
}

export function ArticleProductExternalCard({ block }: ProductBlockProps) {
  const url = articleProductUrl(block.props.url)
  const isShop = block.props.kind === 'shop'
  if (!url) return <div className={styles.productEmpty}>{isShop ? '店铺链接尚未填写' : '商品链接尚未填写'}</div>
  if (isShop) return <div className={styles.shopCard}><ShopCardContent fields={block.props} /></div>
  return <a href={url} target="_blank" rel="noopener noreferrer" className={styles.productCard}><ProductCardContent fields={block.props} /></a>
}

export function ArticleProductBlockView({ block, editor }: ProductBlockProps) {
  const dialogId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [fields, setFields] = useState<ProductFields>(block.props)
  const [error, setError] = useState('')
  const [readingImage, setReadingImage] = useState(false)
  const [readingGallery, setReadingGallery] = useState(false)
  const isShop = fields.kind === 'shop'
  const gallery = productGallery(fields.gallery)
  const productUrl = articleProductUrl(block.props.url)

  function openEditor() {
    setFields(block.props)
    setError('')
    dialogRef.current?.showModal()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const url = articleProductUrl(fields.url)
    if (!url) { setError(`请输入有效的 http 或 https ${isShop ? '店铺' : '商品'}链接。`); return }
    if (isShop && !fields.name.trim()) { setError('请输入店名。'); return }
    editor.updateBlock(block, { props: {
      ...fields,
      url,
      name: fields.name.trim(),
      price: fields.price.trim(),
      subtitle: fields.subtitle.trim(),
      gallery: JSON.stringify(gallery),
    } })
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

  async function selectGallery(files: FileList | null) {
    if (!files?.length) return
    const selected = Array.from(files)
    const available = Math.max(0, 9 - gallery.length)
    const accepted = selected.slice(0, available)
    const exceeded = selected.length > accepted.length
    if (!accepted.length) { setError('图片流最多添加 9 张。'); return }
    setReadingGallery(true)
    try {
      const images = await Promise.all(accepted.map(readArticleImage))
      const additions: GalleryItem[] = images.map((url) => ({ url, name: '', price: '', link: '' }))
      setFields((current) => ({ ...current, gallery: JSON.stringify([...productGallery(current.gallery), ...additions].slice(0, 9)) }))
      setError(exceeded ? '图片流最多添加 9 张，超出的图片未添加。' : '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '图片读取失败，请重试。')
    } finally {
      setReadingGallery(false)
    }
  }

  if (!editor.isEditable) return <ArticleProductExternalCard block={block} editor={editor} />

  return <div className={styles.productBlock} contentEditable={false}>
    {isShop ? <div className={styles.shopCard} data-liquid-skip="" role="button" tabIndex={0} onClick={openEditor} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEditor() } }} aria-label={productUrl ? `编辑店铺卡片：${block.props.name || new URL(productUrl).hostname}` : '添加店铺链接'}>
      <ShopCardContent fields={block.props} editable />
    </div> : <button type="button" className={styles.productCard} data-liquid-skip="" onClick={openEditor} aria-label={productUrl ? `编辑商品卡片：${block.props.name || new URL(productUrl).hostname}` : '添加商品链接'}>
      <ProductCardContent fields={block.props} />
    </button>}
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={dialogId} onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close() }}>
      <form onSubmit={submit}>
        <div className={styles.dialogHeading}><h2 id={dialogId}>{isShop ? productUrl ? '编辑店铺' : '添加店铺' : productUrl ? '编辑商品' : '添加商品'}</h2><button type="button" data-liquid-skip="" className={styles.close} aria-label="关闭卡片编辑" onClick={() => dialogRef.current?.close()}><X size={18} aria-hidden="true" /></button></div>
        <div className={styles.productForm}>
          {isShop ? <>
            <div className={styles.formSectionTitle}>店铺信息</div>
            <label>店名<input data-liquid-skip="" aria-label="店名" placeholder="店铺名称" required maxLength={100} value={fields.name} onChange={(event) => setFields((current) => ({ ...current, name: event.target.value }))} /></label>
            <label>副标题<input data-liquid-skip="" aria-label="店铺副标题" placeholder="选填" maxLength={120} value={fields.subtitle} onChange={(event) => setFields((current) => ({ ...current, subtitle: event.target.value }))} /></label>
            <label>店铺链接<input type="url" data-liquid-skip="" aria-label="店铺链接" placeholder="https://" required value={fields.url} onChange={(event) => setFields((current) => ({ ...current, url: event.target.value }))} /></label>
            <div className={styles.productImageField}>
              {fields.image && <Image src={fields.image} alt="店铺 logo" width={64} height={64} unoptimized />}
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="选择店铺 logo" onChange={(event) => { void selectImage(event.target.files?.[0]); event.target.value = '' }} />
              <button type="button" data-liquid-skip="" className={styles.control} disabled={readingImage} onClick={() => imageInputRef.current?.click()}><ImagePlus size={16} aria-hidden="true" />{readingImage ? '读取中…' : fields.image ? '更换 logo' : '添加 logo'}</button>
              {fields.image && <button type="button" data-liquid-skip="" className={styles.control} onClick={() => setFields((current) => ({ ...current, image: '' }))}>移除 logo</button>}
            </div>

            <div className={styles.formSectionTitle}>产品列表 <span className={styles.sectionCount}>{gallery.length}/9</span></div>
            {gallery.length > 0 && <div className={styles.galleryList}>{gallery.map((item, index) => <div key={`${index}-${item.url.slice(-24)}`} className={styles.galleryRow}>
              <Image className={styles.galleryThumb} src={item.url} alt={item.name || `产品 ${index + 1}`} width={48} height={64} unoptimized />
              <div className={styles.galleryRowFields}>
                <div className={styles.galleryRowLine}>
                  <input data-liquid-skip="" aria-label={`第 ${index + 1} 个产品名`} placeholder="产品名" maxLength={60} value={item.name} onChange={(event) => setFields((current) => {
                    const next = productGallery(current.gallery)
                    if (next[index]) next[index] = { ...next[index], name: event.target.value }
                    return { ...current, gallery: JSON.stringify(next) }
                  })} />
                  <input data-liquid-skip="" aria-label={`第 ${index + 1} 个产品价格`} placeholder="价格" maxLength={30} value={item.price} onChange={(event) => setFields((current) => {
                    const next = productGallery(current.gallery)
                    if (next[index]) next[index] = { ...next[index], price: event.target.value }
                    return { ...current, gallery: JSON.stringify(next) }
                  })} />
                </div>
                <input type="url" data-liquid-skip="" aria-label={`第 ${index + 1} 个产品的跳转链接`} placeholder="链接（留空跳店铺）" value={item.link} onChange={(event) => setFields((current) => {
                  const next = productGallery(current.gallery)
                  if (next[index]) next[index] = { ...next[index], link: event.target.value }
                  return { ...current, gallery: JSON.stringify(next) }
                })} />
              </div>
              <button type="button" data-liquid-skip="" className={styles.galleryRemove} aria-label={`移除第 ${index + 1} 个产品`} onClick={() => setFields((current) => ({ ...current, gallery: JSON.stringify(productGallery(current.gallery).filter((_, i) => i !== index)) }))}><X size={16} aria-hidden="true" /></button>
            </div>)}</div>}
            <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden aria-label="添加产品图片" onChange={(event) => { void selectGallery(event.target.files); event.target.value = '' }} />
            <button type="button" data-liquid-skip="" className={styles.control} disabled={readingGallery || gallery.length >= 9} onClick={() => galleryInputRef.current?.click()}><ImagePlus size={16} aria-hidden="true" />{readingGallery ? '读取中…' : gallery.length >= 9 ? '已添加 9 个' : '添加产品图片'}</button>
          </> : <>
            <label>链接<input type="url" data-liquid-skip="" required aria-label="商品链接" placeholder="https://" value={fields.url} onChange={(event) => setFields((current) => ({ ...current, url: event.target.value }))} /></label>
            <label>名称<input data-liquid-skip="" aria-label="商品名称" placeholder="选填" maxLength={100} value={fields.name} onChange={(event) => setFields((current) => ({ ...current, name: event.target.value }))} /></label>
            <label>价格<input data-liquid-skip="" aria-label="商品价格" placeholder="选填" maxLength={30} value={fields.price} onChange={(event) => setFields((current) => ({ ...current, price: event.target.value }))} /></label>
            <div className={styles.productImageField}>
              {fields.image && <Image src={fields.image} alt="商品图片" width={64} height={64} unoptimized />}
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="选择商品图片" onChange={(event) => { void selectImage(event.target.files?.[0]); event.target.value = '' }} />
              <button type="button" data-liquid-skip="" className={styles.control} disabled={readingImage} onClick={() => imageInputRef.current?.click()}><ImagePlus size={16} aria-hidden="true" />{readingImage ? '读取中…' : fields.image ? '更换图片' : '添加图片'}</button>
              {fields.image && <button type="button" data-liquid-skip="" className={styles.control} onClick={() => setFields((current) => ({ ...current, image: '' }))}>移除图片</button>}
            </div>
          </>}
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.dialogActions}><button type="button" data-liquid-skip="" className={styles.control} onClick={() => dialogRef.current?.close()}>取消</button><button type="submit" data-liquid-skip="" className={styles.primary} disabled={readingImage || readingGallery}>保存卡片</button></div>
      </form>
    </dialog>
  </div>
}
