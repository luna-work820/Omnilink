'use client'

import { useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  Image as ImageIcon,
  MoreHorizontal,
  PenLine,
  Plus,
  Search,
  Settings,
  SquareCheck,
} from 'lucide-react'

type NoteKind = 'document' | 'image'

type Note = {
  id: string
  title: string
  excerpt: string
  date: string
  kind: NoteKind
  tags: string[]
  imageUrl?: string
  example?: boolean
}

const EXAMPLE_NOTES: Note[] = [
  {
    id: 'example-database',
    title: '产品资料示例',
    excerpt: '这是一个示例文件预览。上传真实文件后，文件内容会显示在右侧阅读区。',
    date: '示例预览',
    kind: 'document',
    tags: ['产品资料', '示例'],
    example: true,
  },
  {
    id: 'example-manual',
    title: '使用说明示例',
    excerpt: '把规格、使用方式和注意事项集中在一份可追溯的文件里。',
    date: '示例预览',
    kind: 'document',
    tags: ['说明', '示例'],
    example: true,
  },
  {
    id: 'example-image',
    title: '商品图片示例',
    excerpt: '图片资产会在这里显示缩略图，并可以从右侧维护它与商品的关系。',
    date: '示例预览',
    kind: 'image',
    tags: ['图片', '示例'],
    example: true,
  },
]

function NoteThumbnail({ note }: { note: Note }) {
  if (note.kind === 'image' && note.imageUrl) return <img src={note.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
  if (note.kind === 'image') return <span className="block h-full w-full bg-[linear-gradient(135deg,#202020_0%,#707070_48%,#E9E9E9_49%,#FAFAFA_100%)]" aria-hidden />
  return <span className="flex h-full w-full flex-col justify-between bg-[#F5F5F3] p-3" aria-hidden><span className="h-1.5 w-2/3 rounded-full bg-[#D1D1D1]" /><span className="space-y-1.5"><span className="block h-1.5 w-full rounded-full bg-[#E2E2E2]" /><span className="block h-1.5 w-4/5 rounded-full bg-[#E2E2E2]" /><span className="block h-1.5 w-3/5 rounded-full bg-[#E2E2E2]" /></span></span>
}

export function KnowledgeThreePane() {
  const [notes, setNotes] = useState<Note[]>(EXAMPLE_NOTES)
  const [activeId, setActiveId] = useState(EXAMPLE_NOTES[0].id)
  const [activeFolder, setActiveFolder] = useState('我的文件')
  const [query, setQuery] = useState('')
  const [format, setFormat] = useState('paragraph')
  const [showMenu, setShowMenu] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeNote = notes.find((note) => note.id === activeId) || notes[0]
  const filteredNotes = useMemo(() => notes.filter((note) => note.title.toLowerCase().includes(query.trim().toLowerCase())), [notes, query])

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const isImage = file.type.startsWith('image/')
    const note: Note = {
      id: crypto.randomUUID(),
      title: file.name,
      excerpt: '这是刚刚上传的文件，可以在右侧继续查看和维护关联。',
      date: '刚刚上传',
      kind: isImage ? 'image' : 'document',
      tags: [isImage ? '图片' : '文件'],
      imageUrl: isImage ? URL.createObjectURL(file) : undefined,
    }
    setNotes((current) => [note, ...current])
    setActiveId(note.id)
    setNotice('文件已加入当前空间')
  }

  const changeFolder = (folder: string) => {
    setActiveFolder(folder)
    setNotice(folder === '我的文件' ? null : `${folder}空间已选中`)
  }

  return (
    <main className="min-h-[calc(100vh-3rem)] bg-[#F2F2F0] p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-[1600px] overflow-hidden rounded-[8px] border border-[#E2E2E2] bg-white shadow-[0_12px_40px_rgba(28,28,28,0.08)] lg:grid-cols-[220px_320px_minmax(0,1fr)]">
        <aside className="border-b border-[#E2E2E2] bg-[#FBFBFA] p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between rounded-[10px] bg-white px-3 py-2.5 shadow-[0_1px_4px_rgba(28,28,28,0.05)]"><span className="flex items-center gap-2 text-sm font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#1C1C1C] text-xs font-bold text-white">O</span>Omnilink</span><ChevronDown size={15} className="text-[#636363]" /></div>
          <label className="relative mt-4 block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#636363]" /><span className="sr-only">搜索空间</span><input placeholder="搜索空间" className="h-9 w-full rounded-[8px] border border-[#E2E2E2] bg-white pl-9 pr-2 text-xs outline-none focus:border-[#024AD8] focus:ring-1 focus:ring-[#024AD8]" /></label>
          <nav className="mt-6 space-y-1" aria-label="知识库空间">
            {[['我的文件', FileText], ['待办事项', SquareCheck], ['项目', Folder], ['日志', PenLine], ['阅读清单', BookOpen]].map(([label, Icon]) => <button key={label as string} type="button" onClick={() => changeFolder(label as string)} className={`flex min-h-10 w-full items-center gap-3 rounded-[8px] px-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[#024AD8] ${activeFolder === label ? 'bg-white font-semibold shadow-[0_1px_4px_rgba(28,28,28,0.06)]' : 'text-[#636363] hover:bg-white'}`}><Icon size={15} /><span className="min-w-0 flex-1 truncate">{label as string}</span>{activeFolder === label && <MoreHorizontal size={15} />}</button>)}
          </nav>
          <div className="mt-8 space-y-1 border-t border-[#E2E2E2] pt-4"><button type="button" onClick={() => setNotice('新文件夹入口已准备好')} className="flex min-h-10 w-full items-center gap-3 rounded-[8px] px-3 text-left text-sm text-[#636363] hover:bg-white focus-visible:outline-2 focus-visible:outline-[#024AD8]"><Plus size={16} />新增文件夹</button><button type="button" onClick={() => setNotice('设置入口已准备好')} className="flex min-h-10 w-full items-center gap-3 rounded-[8px] px-3 text-left text-sm text-[#636363] hover:bg-white focus-visible:outline-2 focus-visible:outline-[#024AD8]"><Settings size={16} />设置</button></div>
        </aside>

        <section className="min-w-0 border-b border-[#E2E2E2] bg-[#F8F8F7] lg:border-b-0 lg:border-r">
          <div className="border-b border-[#E2E2E2] p-5"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.14em] text-[#636363]">{activeFolder}</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.03em]">我的文件</h1></div><input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} /><button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#1C1C1C] text-white focus-visible:outline-2 focus-visible:outline-[#024AD8]" aria-label="上传文件"><FilePlus2 size={17} /></button></div><label className="relative mt-5 block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#636363]" /><span className="sr-only">搜索文件</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件" className="h-10 w-full rounded-[8px] border border-[#E2E2E2] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#024AD8] focus:ring-1 focus:ring-[#024AD8]" /></label></div>
          <div className="space-y-2 p-3">{filteredNotes.map((note) => <button key={note.id} type="button" onClick={() => setActiveId(note.id)} className={`!rounded-[8px] w-full border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#024AD8] ${activeId === note.id ? 'border-[#024AD8] bg-white shadow-[0_2px_8px_rgba(28,28,28,0.06)]' : 'border-transparent hover:border-[#E2E2E2] hover:bg-white'}`}><div className="flex gap-3"><span className="h-16 w-20 shrink-0 overflow-hidden rounded-[6px] border border-[#E2E2E2]"><NoteThumbnail note={note} /></span><span className="min-w-0 flex-1"><span className="block text-[11px] uppercase tracking-[0.12em] text-[#636363]">{note.date}</span><span className="mt-1 block truncate text-sm font-semibold">{note.title}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-[#636363]">{note.excerpt}</span></span></div><span className="mt-3 flex flex-wrap gap-1.5">{note.tags.map((tag) => <span key={tag} className="rounded-[4px] bg-[#F2F2F0] px-2 py-1 text-[10px] text-[#636363]">{tag}</span>)}</span></button>)}</div>
        </section>

        <article className="min-w-0 bg-white">
          {activeNote ? <><header className="border-b border-[#E2E2E2] px-6 py-5 sm:px-8"><div className="flex items-center justify-between gap-4 text-xs text-[#636363]"><div className="flex min-w-0 items-center gap-1 truncate"><span>我的文件</span><ChevronRight size={13} /><span className="truncate">{activeNote.title}</span></div><div className="relative"><button type="button" onClick={() => setShowMenu((value) => !value)} className="flex min-h-10 min-w-10 items-center justify-center hover:bg-[#F2F2F0] focus-visible:outline-2 focus-visible:outline-[#024AD8]" aria-label="打开文件菜单"><MoreHorizontal size={18} /></button>{showMenu && <div className="absolute right-0 top-11 z-10 w-36 rounded-[8px] border border-[#E2E2E2] bg-white p-1 shadow-lg"><button type="button" onClick={() => { setNotice('文件已标记为重点'); setShowMenu(false) }} className="w-full px-3 py-2 text-left text-xs hover:bg-[#F2F2F0] focus-visible:outline-2 focus-visible:outline-[#024AD8]">标记重点</button></div>}</div></div><h2 className="mt-7 text-3xl font-bold tracking-[-0.04em]">{activeNote.title}</h2><div className="mt-4 grid max-w-xl grid-cols-[90px_1fr] gap-y-2 text-xs"><span className="text-[#636363]">来源</span><span>{activeNote.example ? '示例预览' : '刚刚上传的文件'}</span><span className="text-[#636363]">更新</span><span>{activeNote.date}</span><span className="text-[#636363]">标签</span><span className="flex flex-wrap gap-1.5">{activeNote.tags.map((tag) => <span key={tag} className="rounded-[4px] bg-[#F2F2F0] px-2 py-1">{tag}</span>)}</span></div></header><div className="border-b border-[#E2E2E2] px-6 py-3 sm:px-8"><div className="flex flex-wrap items-center gap-1"><button type="button" onClick={() => setFormat('paragraph')} aria-pressed={format === 'paragraph'} className={`min-h-9 px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[#024AD8] ${format === 'paragraph' ? 'bg-[#F2F2F0]' : 'hover:bg-[#F2F2F0]'}`}>正文</button><button type="button" onClick={() => setFormat('heading')} aria-pressed={format === 'heading'} className={`min-h-9 px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[#024AD8] ${format === 'heading' ? 'bg-[#F2F2F0]' : 'hover:bg-[#F2F2F0]'}`}>标题</button><span className="mx-2 h-5 w-px bg-[#E2E2E2]" /><span className="text-xs text-[#636363]">{format === 'heading' ? '标题样式已选中' : '阅读模式'}</span></div></div><div className="max-w-3xl px-6 py-8 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#636363]">{activeNote.example ? '示例预览' : '文件内容'}</p><h3 className="mt-5 text-2xl font-bold">内容摘要</h3><p className="mt-4 text-sm leading-7 text-[#4B4B4B]">{activeNote.excerpt} 右侧内容区用于承载文件的正文、图片或知识条目，保持阅读路径清晰，也让每个文件都能回到它所属的商品关系。</p>{activeNote.kind === 'image' && <div className="mt-7 flex h-56 max-w-xl items-center justify-center rounded-[8px] bg-[#F2F2F0]"><ImageIcon size={40} className="text-[#636363]" /></div>}</div></> : <div className="flex min-h-full items-center justify-center p-8 text-sm text-[#636363]">选择一个文件查看内容</div>}
          {notice && <div role="status" className="fixed bottom-5 right-5 z-20 flex items-center gap-2 rounded-[8px] bg-[#1C1C1C] px-4 py-3 text-sm text-white shadow-lg"><Check size={16} /><span>{notice}</span><button type="button" onClick={() => setNotice(null)} className="ml-2 text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-white" aria-label="关闭提示">×</button></div>}
        </article>
      </div>
    </main>
  )
}
