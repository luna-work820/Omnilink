'use client'

import { useState, type ComponentType, type DragEvent, type MouseEvent } from 'react'
import FolderVisual from '@/components/Folder'
import themeTokens from '@/theme.json'

const DEFAULT_FOLDER_COLOR = themeTokens.colors.secondary

export type FolderItem = {
  title: string
  description?: string
  image?: string
  noteId?: string
}

type FolderVisualProps = {
  label: string
  items: FolderItem[]
  mode: 'book' | 'flap'
  variant: 'solid' | 'glass'
  color: string
  paperColor: string
  layout: 'stack' | 'row'
  size: number
  open: boolean
  onOpenChange: (expanded: boolean) => void
  onItemClick: (item: FolderItem, index: number) => void
  draggable: boolean
  tilt: number
  theme: 'light' | 'dark'
  intro: boolean
  peek: boolean
  zoomOnClick: boolean
  className: string
}

const ReactBitsFolder = FolderVisual as ComponentType<FolderVisualProps>

type FolderProps = {
  label: string
  items: FolderItem[]
  count?: number
  color?: string
  mode?: 'folder' | 'book'
  variant?: 'solid' | 'glass'
  layout?: 'stack' | 'row'
  tilt?: number
  theme?: 'light' | 'dark'
  onItemClick?: (item: FolderItem, index: number) => void
  onExpandedChange?: (expanded: boolean) => void
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave?: () => void
  onDrop?: (event: DragEvent<HTMLDivElement>) => void
  className?: string
}

function resolveColor(color: string) {
  if (!color.startsWith('var(')) return color
  if (typeof window === 'undefined') return DEFAULT_FOLDER_COLOR
  const token = color.slice(4, -1).split(',')[0].trim()
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || DEFAULT_FOLDER_COLOR
}

export default function Folder({
  label,
  items,
  count,
  color = DEFAULT_FOLDER_COLOR,
  mode = 'book',
  variant = 'solid',
  layout = 'row',
  tilt = 0.55,
  theme = 'light',
  onItemClick,
  onExpandedChange,
  onContextMenu,
  onDragOver,
  onDragLeave,
  onDrop,
  className = '',
}: FolderProps) {
  const [expanded, setExpanded] = useState(false)
  const resolvedColor = resolveColor(color)
  const displayedCount = count ?? items.length
  const folderItems = items.map(({ title, description, image, noteId }) => ({
    title,
    description,
    image,
    noteId,
  }))

  function updateExpanded(next: boolean) {
    setExpanded(next)
    onExpandedChange?.(next)
  }

  return (
    <div
      className={`knowledge-folder-shell ${expanded ? 'is-expanded' : ''} ${className}`}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="knowledge-folder-visual">
        <ReactBitsFolder
          label={label}
          items={folderItems}
          mode={mode === 'book' ? 'book' : 'flap'}
          variant={variant}
          color={resolvedColor}
          paperColor="#FFFFFF"
          layout={layout}
          size={0.82}
          open={expanded}
          onOpenChange={updateExpanded}
          onItemClick={(item: FolderItem, index: number) => onItemClick?.(item, index)}
          draggable={false}
          tilt={tilt}
          theme={theme}
          intro
          peek
          zoomOnClick={false}
          className="knowledge-folder__rendered"
        />
        <span className="knowledge-folder__count" aria-label={`${displayedCount} 个文件`}>
          {displayedCount} 个文件
        </span>
      </div>
    </div>
  )
}
