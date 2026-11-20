'use client'

import Image from 'next/image'
import template from './template.json'
import type {SitePageProps} from '@/lib/site-builder/contracts'
import {formatSitePrice} from '@/lib/site-builder/sdk'

export type StarterWebsiteData=Pick<SitePageProps,'store'|'products'>
type Content={title?:string;tag?:string;subtitle?:string;description?:string;imageUrl?:string;imagePosition?:string;buttonText?:string;buttonLink?:string;secondaryButtonText?:string;secondaryButtonLink?:string;announcement?:string;copyright?:string;trustBadge1?:string;trustBadge2?:string;trustBadge3?:string;testimonialsList?:{name:string;role:string;quote:string}[];faqList?:{question:string;answer:string}[]}
type Section={id:string;type:string;content:Content;style:{padding?:string;textAlign?:string}}
const sections=template.sections as Section[]
const header=sections.find(section=>section.type==='header')!.content
const primary='inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--text-primary)] px-6 py-3 text-sm font-semibold text-[var(--surface)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4'
const secondary='inline-flex min-h-11 items-center justify-center rounded-full border-[0.5px] border-[var(--border-subtle)] px-6 py-3 text-sm font-semibold hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-offset-4'
const container='mx-auto w-full max-w-7xl px-5 @min-[640px]:px-8 @min-[960px]:px-10'
function target(href?:string){return href==='#products'?'#optique-sec-products':href?.startsWith('#sec-')?'#optique-'+href.slice(1):'#optique-sec-products'}

export function OptiqueTemplate({data,page,onPageChange,error}:{data:StarterWebsiteData|null;page:string;onPageChange:(page:string)=>void;error?:string}){
 const products=data?.products??[]
 const product=page.startsWith('/products/')?products.find(item=>item.id===decodeURIComponent(page.slice('/products/'.length))):null
 return <div aria-label="OPTIQUE ATELIER 初始模板预览" className="@container min-w-0 w-full bg-[var(--surface)] text-[var(--text-primary)]">
  <header className="border-b-[0.5px] border-[var(--border-subtle)]">
   {header.announcement&&<div className="bg-[var(--text-primary)] px-5 py-2.5 text-center text-xs font-semibold text-[var(--surface)]">{header.announcement}</div>}
   <div className={container+' flex min-h-20 flex-wrap items-center justify-between gap-4 py-4'}>
    <button type="button" onClick={()=>onPageChange('/')} className="flex items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-4"><span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--text-primary)] text-sm font-bold text-[var(--surface)]">O</span><span className="text-sm font-extrabold tracking-tight">{header.title}</span></button>
    <nav aria-label="店铺导航" className="flex items-center gap-5 text-sm font-medium">
     <button type="button" aria-current={page==='/'?'page':undefined} onClick={()=>onPageChange('/')} className="min-h-11 hover:underline focus-visible:outline-2">Home</button>
     <button type="button" aria-current={page.startsWith('/products')?'page':undefined} onClick={()=>onPageChange('/products')} className="min-h-11 hover:underline focus-visible:outline-2">Products</button>
    </nav>
   </div>
  </header>
  {product?<article className={container+' grid gap-8 py-12 @min-[640px]:grid-cols-2'}>
   <ProductImage product={product}/><div className="space-y-5"><h2 className="text-2xl font-semibold">{product.name}</h2><p className="text-sm">{formatSitePrice(product.price)}</p>{product.description&&<p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)]">{product.description}</p>}{product.outboundLinks.map(link=><a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className={primary}>{link.label}</a>)}</div>
  </article>:page==='/products'?<div className={container+' py-12'}><Products products={products} onPageChange={onPageChange} error={error}/></div>:sections.filter(s=>s.type!=='header'&&s.type!=='footer').map(section=>{
   const c=section.content
   const spacing=section.style.padding==='spacious'?'py-16 @min-[960px]:py-24':'py-12 @min-[960px]:py-16'
   return <section key={section.id} id={'optique-'+section.id} className={container+' '+spacing}>
    {section.type==='hero'?<div className="grid items-center gap-8 @min-[640px]:grid-cols-12">
     <div className="space-y-5 @min-[640px]:col-span-7"><Copy content={c} hero/><div className="flex flex-wrap gap-3 pt-3">{c.buttonText&&<a href={target(c.buttonLink)} className={primary}>{c.buttonText}</a>}{c.secondaryButtonText&&<a href={target(c.secondaryButtonLink)} className={secondary}>{c.secondaryButtonText}</a>}</div></div>
     {c.imageUrl&&<div className="@min-[640px]:col-span-5"><TemplateImage src={c.imageUrl} alt="OPTIQUE ATELIER eyewear" priority/></div>}
    </div>:section.type==='featured_products'?<><div className="mb-8"><Copy content={c}/></div><Products products={products} onPageChange={onPageChange} error={error}/></>:section.type==='collection'||section.type==='image_text'?<div className="grid items-center gap-8 @min-[640px]:grid-cols-2"><div className={'space-y-4 '+(c.imagePosition==='left'?'@min-[640px]:order-2':'')}><Copy content={c}/>{c.buttonText&&<a href={target(c.buttonLink)} className={primary}>{c.buttonText}</a>}</div>{c.imageUrl&&<div className={c.imagePosition==='left'?'@min-[640px]:order-1':''}><TemplateImage src={c.imageUrl} alt={c.title||'Eyewear'}/></div>}</div>:section.type==='rich_text'?<div className="mx-auto max-w-3xl space-y-4 text-center"><Copy content={c}/></div>:section.type==='testimonials'?<><Copy content={c}/><div className="mt-8 grid gap-8 @min-[640px]:grid-cols-3">{c.testimonialsList?.map(item=><figure key={item.name} className="space-y-4"><blockquote className="text-sm leading-relaxed">“{item.quote}”</blockquote><figcaption className="text-xs text-[var(--text-secondary)]">{item.name}<br/>{item.role}</figcaption></figure>)}</div></>:section.type==='faq'?<div className="mx-auto max-w-3xl"><Copy content={c}/><div className="mt-6">{c.faqList?.map(item=><details key={item.question} className="border-b-[0.5px] border-[var(--border-subtle)] py-5"><summary className="cursor-pointer text-sm font-semibold focus-visible:outline-2">{item.question}</summary><p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">{item.answer}</p></details>)}</div></div>:section.type==='cta'?<div className="mx-auto max-w-3xl rounded-lg border-[0.5px] border-[var(--border-subtle)] px-6 py-12 text-center"><Copy content={c}/>{c.buttonText&&<a href={target(c.buttonLink)} className={primary+' mt-6'}>{c.buttonText}</a>}</div>:null}
   </section>
  })}
  <footer className="border-t-[0.5px] border-[var(--border-subtle)] py-10"><div className={container+' space-y-6'}><p className="text-sm font-bold">{header.title}</p><p className="text-xs text-[var(--text-secondary)]">{sections.find(s=>s.type==='footer')?.content.copyright}</p></div></footer>
 </div>
}
function Copy({content,hero=false}:{content:Content;hero?:boolean}){
 return <>{content.tag&&<p className="mb-3 text-xs font-semibold uppercase tracking-wider">{content.tag}</p>}<h2 className={hero?'text-[32px] font-bold leading-tight tracking-tight':'text-2xl font-bold leading-tight tracking-tight'}>{content.title}</h2>{content.subtitle&&<p className="mt-4 text-sm font-medium leading-relaxed">{content.subtitle}</p>}{content.description&&<p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">{content.description}</p>}</>
}
function TemplateImage({src,alt,priority=false}:{src:string;alt:string;priority?:boolean}){
 return <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[var(--surface-muted)]"><Image src={src} alt={alt} fill priority={priority} sizes="(max-width:640px) 100vw, 50vw" className="object-cover"/></div>
}
function Products({products,onPageChange,error}:{products:StarterWebsiteData['products'];onPageChange:(page:string)=>void;error?:string}){
 if(error)return <p role="alert" className="py-8 text-sm text-[var(--text-secondary)]">{error}</p>
 if(!products.length)return <p className="py-8 text-sm text-[var(--text-secondary)]">暂无商品</p>
 return <div aria-label="商品目录" className="grid grid-cols-2 gap-6 @min-[960px]:grid-cols-4">{products.map(product=><button type="button" key={product.id} onClick={()=>onPageChange('/products/'+encodeURIComponent(product.id))} className="min-w-0 rounded-lg text-left hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-offset-4"><ProductImage product={product}/><div className="space-y-2 px-1 py-4 text-sm"><p className="font-medium">{product.name}</p><p className="text-[var(--text-secondary)]">{formatSitePrice(product.price)}</p></div></button>)}</div>
}
function ProductImage({product}:{product:StarterWebsiteData['products'][number]}){
 return <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-[var(--surface-muted)]">{product.imageUrl?<Image src={product.imageUrl} alt={product.name} fill unoptimized sizes="(max-width:640px) 50vw, 25vw" className="object-cover"/>:<span className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-[var(--text-secondary)]">{product.name}</span>}</div>
}
