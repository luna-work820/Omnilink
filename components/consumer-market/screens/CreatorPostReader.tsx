'use client'

import { DisplayPrice } from '../components/DisplayPrice';

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { ExternalLink, X } from 'lucide-react'
import type { ProductItem, ScenePost } from '../types'

const ArticleReader = dynamic(() => import('@/components/creator-content/ArticlePhonePreview').then((module) => module.ArticlePhonePreview), { ssr: false, loading: () => <p className="p-6" role="status">正在读取文章…</p> })

export function CreatorPostReader({ post, onClose, onOpenProduct }: {
  post: ScenePost
  onClose: () => void
  onOpenProduct: (product: ProductItem) => void
}) {
  const surface = useRef<HTMLDivElement>(null)
  const previousFocus = useRef(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !surface.current) return
      const elements = [...surface.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],video[controls],[tabindex="0"]')].filter((element) => element.getClientRects().length)
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && (document.activeElement === first || !surface.current.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    const returnTo = previousFocus.current
    return () => { window.removeEventListener('keydown', onKeyDown); if (returnTo?.isConnected) returnTo.focus() }
  }, [onClose])
  const publication = post.publication
  if (publication) return <div ref={surface} role="dialog" aria-modal="true" aria-label={post.title} className="fixed inset-0 z-50 overflow-y-auto bg-[var(--canvas)] text-[var(--market-ink)]">
    <div className="mx-auto max-w-2xl pb-16">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between bg-[var(--canvas)] px-4"><span className="text-sm">{post.editorName}</span><button type="button" autoFocus onClick={onClose} aria-label="关闭内容" className="grid size-10 place-items-center rounded-full"><X size={20} /></button></header>
      {publication.kind === 'article' && publication.article ? <ArticleReader draft={publication.article} frame={false} /> : <article className="px-4">
        {publication.kind === 'video' ? <video src={publication.media[0]} poster={publication.coverUrl} controls playsInline preload="metadata" controlsList={publication.fields.allowSave ? undefined : 'nodownload'} className="max-h-[75vh] w-full" aria-label="作品视频" /> : publication.media.map((url, index) => <Image key={url} src={url} alt={`作品图片 ${index + 1}`} width={900} height={1200} sizes="(max-width: 640px) 100vw, 680px" unoptimized className="mb-3 h-auto w-full object-contain" />)}
        <h1 className="mt-6 text-2xl font-semibold">{publication.fields.title}</h1>
        {publication.fields.summary && <p className="mt-4 whitespace-pre-wrap text-base leading-8">{publication.fields.summary}</p>}
        {publication.fields.topics && <p className="mt-4 text-sm text-[var(--text-secondary)]">{publication.fields.topics}</p>}
        {publication.fields.location && <p className="mt-4 text-sm text-[var(--text-secondary)]">{publication.fields.location}</p>}
      </article>}
    </div>
  </div>
  return (
    <div ref={surface} role="dialog" aria-modal="true" aria-label={post.title} className="fixed inset-0 z-50 overflow-y-auto bg-[#FCFDFE] text-[var(--market-ink)]">
      <div className="mx-auto max-w-2xl px-4 pb-20 sm:px-6">
        <div className="sticky top-0 z-10 flex h-14 items-center justify-between bg-[#FCFDFE]">
          <span className="text-sm font-semibold">内容</span>
          <button type="button" autoFocus onClick={onClose} aria-label="关闭内容" className="grid size-10 place-items-center rounded-[var(--radius-control)] hover:bg-[#E9EDF2] focus-visible:outline-2 focus-visible:outline-[#315BFF]"><X size={20} /></button>
        </div>
        <Image unoptimized src={post.coverImage} alt="" width={800} height={600} className="aspect-[4/3] w-full rounded-[var(--radius-card)] object-cover" />
        <p className="mt-6 text-sm text-[var(--market-text-secondary)]">{post.editorName}</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">{post.title}</h1>
        {post.linkedProducts.length > 0 && <button type="button" onClick={() => document.getElementById('post-look')?.scrollIntoView({ behavior: 'smooth' })} className="mt-5 min-h-11 rounded-full bg-black px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315BFF]">做同款</button>}
        <div className="mt-6 space-y-7">{post.blocks?.length ? post.blocks.map((block) => {
          if (block.type === 'text') return <p key={block.id} className="whitespace-pre-wrap text-base leading-8">{block.text}</p>
          if (block.type === 'image') return block.url ? <Image key={block.id} unoptimized src={block.url} alt="" width={800} height={500} className="w-full rounded-[var(--radius-card)]" /> : null
          if (block.type === 'video') return block.url ? <video key={block.id} controls playsInline preload="metadata" className="max-h-[70vh] w-full rounded-[var(--radius-card)] bg-black" aria-label="作品视频"><source src={block.url} type={block.url.split('?')[0].toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4'} />浏览器不支持播放此视频。</video> : null
          const products = block.productIds.map((id) => post.linkedProducts.find((item) => item.id === id)).filter((item): item is ProductItem => Boolean(item))
          return <div key={block.id} className={block.type === 'group' ? 'grid gap-4 sm:grid-cols-2' : ''}>{products.map((product) => <button key={product.id} type="button" onClick={() => onOpenProduct(product)} className="flex w-full items-center gap-3 rounded-[var(--radius-control)] p-2 text-left hover:bg-[#E9EDF2] focus-visible:outline-2 focus-visible:outline-[#315BFF]"><Image unoptimized src={product.mainImage} alt="" width={72} height={72} className="size-18 rounded-[var(--radius-control)] object-cover" /><span className="min-w-0"><span className="block text-sm font-semibold">{product.name}</span><span className="mt-1 block text-sm text-[var(--market-text-secondary)]"><DisplayPrice product={product} /></span></span></button>)}</div>
        }) : <p className="whitespace-pre-wrap text-base leading-8">{post.description}</p>}</div>
        {post.linkedProducts.length > 0 && <section id="post-look" aria-labelledby="post-products" className="mt-10 border-t border-[var(--market-border)] pt-6 scroll-mt-20">
          <h2 id="post-products" className="mb-2 text-lg font-semibold">同款清单</h2>
          <div className="space-y-3">{post.linkedProducts.map((product, index) => {
            const links = Object.entries(product.outboundLinks ?? {}).filter((entry): entry is ['xiaohongshu' | 'douyin', string] => Boolean(entry[1]));
            return <div key={product.id} className="grid grid-cols-[80px_minmax(0,1fr)] items-start gap-3 rounded-[var(--radius-card)] p-2 hover:bg-[#E9EDF2] sm:grid-cols-[96px_minmax(0,1fr)]">
              <button type="button" onClick={() => onOpenProduct(product)} aria-label={`查看${product.name}`} className="focus-visible:outline-2 focus-visible:outline-[#315BFF]"><Image unoptimized src={product.mainImage} alt="" width={96} height={96} className="aspect-square w-full rounded-[var(--radius-control)] object-cover" /></button>
              <div className="min-w-0"><p className="text-xs text-[var(--market-text-secondary)]">{String(index + 1).padStart(2, '0')}</p><button type="button" onClick={() => onOpenProduct(product)} className="mt-1 text-left text-sm font-semibold hover:underline">{product.name}</button><p className="mt-1 text-sm text-[var(--market-text-secondary)]"><DisplayPrice product={product} /></p><div className="mt-2 flex flex-wrap gap-3">{links.map(([platform, url]) => <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 text-sm text-[#315BFF] hover:underline focus-visible:outline-2 focus-visible:outline-[#315BFF]">前往{platform === 'xiaohongshu' ? '小红书' : '抖音'}<ExternalLink size={13} /></a>)}</div></div>
            </div>
          })}</div>
        </section>}
      </div>
    </div>
  )
}
