'use client'

import { useEffect, useRef } from 'react'
import { Crepe } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/kit/core'
import '@milkdown/crepe/theme/common/style.css'

const suggestionIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M6 9h8M6 13h5"/><circle cx="18" cy="17" r="3"/><path d="m20.2 19.2 1.3 1.3"/></svg>`
const embedIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H8l-4 3V5Z"/><path d="m9 10 2-2M9 14l5-5"/></svg>`

interface MilkdownDetailEditorProps {
  value: string
  onChange: (value: string) => void
  onFocus?: () => void
  readOnly?: boolean
  placeholder?: string
}

export function MilkdownDetailEditor({ value, onChange, onFocus, readOnly = false, placeholder = '输入商品详情…' }: MilkdownDetailEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Crepe | null>(null)
  const initialValueRef = useRef(value)
  const placeholderRef = useRef(placeholder)
  const onChangeRef = useRef(onChange)
  const onFocusRef = useRef(onFocus)

  useEffect(() => {
    onChangeRef.current = onChange
    onFocusRef.current = onFocus
  }, [onChange, onFocus])

  useEffect(() => {
    if (!rootRef.current) return

    const editor = new Crepe({
      root: rootRef.current,
      defaultValue: initialValueRef.current,
      features: {
        [Crepe.Feature.AI]: false,
        [Crepe.Feature.TopBar]: false,
      },
      featureConfigs: {
        [Crepe.Feature.BlockEdit]: {
          blockHandle: {
            root: rootRef.current,
          },
          textGroup: {
            label: '基本区块',
            text: { label: '文本' },
            h1: { label: '标题 1' },
            h2: { label: '标题 2' },
            h3: null,
            h4: null,
            h5: null,
            h6: null,
            quote: null,
            divider: null,
          },
          listGroup: null,
          advancedGroup: null,
          buildMenu: (builder) => {
            const suggested = builder.addGroup('suggested', '建议')
            suggested.addItem('ai-note', {
              label: 'AI 速记',
              icon: suggestionIcon,
              onRun: (ctx) => {
                const view = ctx.get(editorViewCtx)
                view.dispatch(view.state.tr.insertText('> AI 速记\n\n'))
              },
            })
            suggested.addItem('html-embed', {
              label: 'HTML · 嵌入',
              icon: embedIcon,
              onRun: (ctx) => {
                const view = ctx.get(editorViewCtx)
                view.dispatch(view.state.tr.insertText('```html\n\n```'))
              },
            })
          },
          slashMenu: {
            root: rootRef.current,
            // Keep Milkdown's built-in flip middleware so the menu opens
            // below when there is room and above when the caret is near the bottom.
            floatingUIOptions: { placement: 'bottom-start' },
          },
        },
        [Crepe.Feature.Placeholder]: { text: placeholderRef.current },
      },
    })

    editor.on((listener) => {
      listener.markdownUpdated((_, markdown, previous) => {
        if (markdown !== previous) onChangeRef.current(markdown)
      })
      listener.focus(() => onFocusRef.current?.())
    })

    editorRef.current = editor
    void editor.create().then(() => {
      const editable = rootRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')
      editable?.setAttribute('aria-label', placeholderRef.current)
    })

    return () => {
      void editor.destroy()
      editorRef.current = null
    }
  }, [])

  useEffect(() => {
    editorRef.current?.setReadonly(readOnly)
  }, [readOnly])

  return <div ref={rootRef} className="milkdown-product-detail w-full" aria-label={placeholder} />
}
