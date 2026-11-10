'use client'

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUp, LockKeyhole, LockKeyholeOpen, Plus, RotateCcw, Sparkles, X } from 'lucide-react'
import { LiquidGlass } from '@/components/ui/liquid-glass'
import { AI_ASSISTANT_SKILLS, type AiAssistantSkillId } from '@/components/consumer-market/components/CapabilityLibrary'
import styles from './preview.module.css'

const PINNED_SKILLS_STORAGE_KEY = 'omnilink_pinned_skills_v1'

type ChoiceId = 'light' | 'storage' | 'order' | 'focus' | 'other'

type ChatImage = { src: string; name: string }

const exampleImage: ChatImage = {
  src: '/consumer-market/ssd-import/plant-filled-workspace.webp',
  name: '工作区照片',
}

const exampleMessage = '我喜欢被绿植围住的工作区，但桌面有点乱。想找适合我的单品。'

const choices: ReadonlyArray<{
  id: ChoiceId
  label: string
  reply: string
  product?: { name: string; price: string; image: string; reason: string }
}> = [
  {
    id: 'light',
    label: '绿植与自然光营造的松弛感',
    reply: '你喜欢绿植和自然光带来的松弛感。傍晚可以用一盏局部照明延续这种氛围。',
    product: {
      name: '包豪斯弧形台灯',
      price: '¥280',
      image: '/consumer-market/img_product_lamp.jpg',
      reason: '局部照亮桌面，避免在夜间依赖顶灯。',
    },
  },
  {
    id: 'storage',
    label: '物件、收藏和使用痕迹',
    reply: '你喜欢物件围绕书桌的生活感。分层收纳能保留收藏，同时清出操作空间。',
    product: {
      name: '三层铝合金桌面模块化收纳箱',
      price: '¥125',
      image: '/consumer-market/ssd-import/modular-desk-storage.webp',
      reason: '分层收纳常用工具，桌面仍能留出工作区。',
    },
  },
  {
    id: 'focus',
    label: '一个能让我安静专注的角落',
    reply: '你在意的是能安静专注的工作氛围。声音环境也是这个角落的一部分。',
    product: {
      name: '方圆极简无线降噪头戴耳机',
      price: '¥340',
      image: '/consumer-market/ssd-import/retro-headphones.webp',
      reason: '需要专注时使用，保持空间原本的开放感。',
    },
  },
  {
    id: 'order',
    label: '桌面整洁、工具顺手的工作感',
    reply: '你在意桌面是否清楚好用。分层收纳可以让常用物件顺手，也为工作留出空间。',
    product: {
      name: '三层铝合金桌面模块化收纳箱',
      price: '¥125',
      image: '/consumer-market/ssd-import/modular-desk-storage.webp',
      reason: '分层放置常用工具，减少桌面杂乱。',
    },
  },
  {
    id: 'other',
    label: '其他',
    reply: '我会结合你前面表达的偏好继续筛选。',
  },
]

export default function AiChatPreviewPage() {
  const [message, setMessage] = useState<{ text: string; image: ChatImage | null }>({
    text: exampleMessage,
    image: exampleImage,
  })
  const [selected, setSelected] = useState<ChoiceId | null>(null)
  const [confirmed, setConfirmed] = useState<ChoiceId | 'custom' | null>(null)
  const [customAnswer, setCustomAnswer] = useState('')
  const [draft, setDraft] = useState('')
  const [pendingImage, setPendingImage] = useState<ChatImage | null>(null)
  const [error, setError] = useState('')
  const [skillMenuOpen, setSkillMenuOpen] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<AiAssistantSkillId | null>(null)
  const [pinnedSkillIds, setPinnedSkillIds] = useState<AiAssistantSkillId[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(PINNED_SKILLS_STORAGE_KEY) ?? '[]')
      if (Array.isArray(saved)) {
        setPinnedSkillIds(AI_ASSISTANT_SKILLS.map((skill) => skill.id).filter((id) => saved.includes(id)))
      }
    } catch {
      setPinnedSkillIds([])
    }
  }, [])

  useEffect(() => {
    if (confirmed) resultRef.current?.scrollIntoView({ block: 'nearest' })
  }, [confirmed])

  const chosen = choices.find((choice) => choice.id === confirmed)

  function reset() {
    setMessage({ text: exampleMessage, image: exampleImage })
    setSelected(null)
    setConfirmed(null)
    setCustomAnswer('')
    setDraft('')
    setPendingImage(null)
    setError('')
    setSkillMenuOpen(false)
    setSelectedSkill(null)
  }

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('请选择 PNG、JPEG 或 WebP 图片。')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('图片不能超过 3 MB。')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPendingImage({ src: reader.result, name: file.name })
        setError('')
      }
    }
    reader.onerror = () => setError('图片读取失败，请重试。')
    reader.readAsDataURL(file)
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text && !pendingImage) {
      setError('请输入内容或添加图片。')
      return
    }

    if (pendingImage || confirmed) {
      setMessage({ text, image: pendingImage })
      setSelected(null)
      setConfirmed(null)
      setCustomAnswer('')
    } else {
      setCustomAnswer(text)
      setConfirmed('custom')
    }
    setDraft('')
    setPendingImage(null)
    setError('')
  }

  function submitChoice() {
    if (!selected) return
    setCustomAnswer('')
    setConfirmed(selected)
  }

  function togglePinnedSkill(id: AiAssistantSkillId) {
    const next = pinnedSkillIds.includes(id)
      ? pinnedSkillIds.filter((item) => item !== id)
      : [...pinnedSkillIds, id]
    setPinnedSkillIds(next)
    localStorage.setItem(PINNED_SKILLS_STORAGE_KEY, JSON.stringify(next))
  }

  return (
    <main data-ai-chat-preview className={`consumer-market-shell ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/discover?demoLogin=1" className={styles.iconLink} aria-label="返回发现">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <div className={styles.heading}>
            <span className={styles.title}>Omnilink</span>
            <span className={styles.previewLabel}>界面预览</span>
          </div>
          <button type="button" onClick={reset} className={styles.reset} aria-label="重置示例对话">
            <RotateCcw size={17} aria-hidden="true" />
            <span>重置</span>
          </button>
        </div>
      </header>

      <div className={styles.scroller}>
        <div className={styles.thread}>
          <div className={`${styles.userTurn} ${message.image ? styles.userTurnWithImage : ''}`}>
            {message.image && (
              <img className={styles.userImage} src={message.image.src} alt={message.image.name} />
            )}
            {message.text && <p className={styles.userText}>{message.text}</p>}
          </div>

          <section className={styles.assistantTurn} aria-label="Omnilink 回复">
            {!confirmed && (
              <fieldset className={styles.question}>
                <legend className={styles.questionTitle}>看到这张图时，最先打动你的是什么？</legend>
                <div className={styles.options}>
                  {choices.map((choice, index) => (
                    <label key={choice.id} className={styles.option} data-selected={selected === choice.id}>
                      <input
                        className={styles.radioInput}
                        type="radio"
                        name="shopping-focus"
                        value={choice.id}
                        checked={selected === choice.id}
                        onChange={() => setSelected(choice.id)}
                      />
                      <span className={styles.radioMark} aria-hidden="true" />
                      <span className={styles.optionContent}>
                        <span className={styles.optionCode}>{String.fromCharCode(65 + index)}.</span>
                        <span>{choice.label}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className={styles.questionFooter}>
                  <button type="button" className={styles.submitButton} disabled={!selected} onClick={submitChoice}>
                    提交答案
                  </button>
                </div>
              </fieldset>
            )}
          </section>

          {confirmed && (
            <div ref={resultRef} className={styles.followup}>
              <div className={styles.answerBubble}>
                {chosen?.label ?? customAnswer}
                {chosen && customAnswer && <span className={styles.answerNote}>{customAnswer}</span>}
              </div>
              <section className={styles.result} aria-label="推荐结果示例">
                <p className={styles.assistantText}>{chosen?.reply ?? '我会按你补充的想法继续筛选。'}</p>
                {chosen?.product && (
                  <article className={styles.product}>
                    <img src={chosen.product.image} alt="" className={styles.productImage} />
                    <div className={styles.productContent}>
                      <h2 className={styles.productName}>{chosen.product.name}</h2>
                      <p className={styles.productReason}>{chosen.product.reason}</p>
                      <span className={styles.productPrice}>{chosen.product.price}</span>
                    </div>
                  </article>
                )}
                <button type="button" className={styles.textButton} onClick={() => { setConfirmed(null); setSelected(null); setCustomAnswer('') }}>
                  重新选择
                </button>
              </section>
            </div>
          )}
        </div>
      </div>

      <div className={styles.composerArea}>
        <div className={styles.composerDock}>
          <div className={styles.skillRail}>
            <button
              type="button"
              className={styles.skillTrigger}
              onClick={() => setSkillMenuOpen((open) => !open)}
              aria-label={skillMenuOpen ? '关闭技能' : '选择技能'}
              aria-expanded={skillMenuOpen}
              aria-controls={skillMenuOpen ? 'ai-chat-skills' : undefined}
            >
              {skillMenuOpen ? <X size={16} aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
            </button>
            {pinnedSkillIds.map((id) => {
              const skill = AI_ASSISTANT_SKILLS.find((item) => item.id === id)
              if (!skill) return null
              const Icon = skill.icon
              return (
                <button key={id} type="button" className={styles.pinnedSkill} onClick={() => setSelectedSkill(id)} aria-pressed={selectedSkill === id}>
                  <Icon size={14} aria-hidden="true" />
                  <span>{skill.title}</span>
                </button>
              )
            })}
            {skillMenuOpen && (
              <section id="ai-chat-skills" className={styles.skillPanel} aria-label="选择技能">
                {AI_ASSISTANT_SKILLS.map((skill) => {
                  const Icon = skill.icon
                  const pinned = pinnedSkillIds.includes(skill.id)
                  return (
                    <div key={skill.id} className={styles.skillOption}>
                      <button type="button" onClick={() => { setSelectedSkill(skill.id); setSkillMenuOpen(false) }} aria-pressed={selectedSkill === skill.id}>
                        <Icon size={17} aria-hidden="true" />
                        <span>{skill.title}</span>
                      </button>
                      <button type="button" onClick={() => togglePinnedSkill(skill.id)} aria-label={`${pinned ? '取消固定' : '固定'}${skill.title}`} aria-pressed={pinned} title={pinned ? '取消固定' : '固定到输入框上方'}>
                        {pinned ? <LockKeyhole size={17} aria-hidden="true" /> : <LockKeyholeOpen size={17} aria-hidden="true" />}
                      </button>
                    </div>
                  )
                })}
              </section>
            )}
          </div>
        <form className={styles.composer} onSubmit={send}>
          <input ref={fileInputRef} className={styles.hiddenInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImage} aria-label="选择图片" />
          <LiquidGlass
            radius={999}
            bevelDepth={12}
            scale={28}
            aberration={0.8}
            frost={0.6}
            tint={0.78}
            interactive
            className={`${styles.composerGlass} ai-assistant-composer-surface`}
          >
            <div className={styles.composerRow}>
              <button type="button" className={`${styles.addImage} ai-assistant-composer-plus`} onClick={() => fileInputRef.current?.click()} aria-label="添加图片" title="添加图片">
                <Plus size={16} aria-hidden="true" />
              </button>
              <div className={styles.composerInputGroup}>
                {selectedSkill && (() => {
                  const skill = AI_ASSISTANT_SKILLS.find((item) => item.id === selectedSkill)
                  if (!skill) return null
                  const Icon = skill.icon
                  return <span className={styles.selectedSkill}><Icon size={13} aria-hidden="true" />{skill.title}<button type="button" onClick={() => setSelectedSkill(null)} aria-label={`移除${skill.title}`}><X size={13} aria-hidden="true" /></button></span>
                })()}
                {pendingImage && (
                  <div className={styles.pendingImage}>
                    <img src={pendingImage.src} alt="待发送图片" />
                    <span>{pendingImage.name}</span>
                    <button type="button" onClick={() => setPendingImage(null)} aria-label="移除待发送图片"><X size={16} aria-hidden="true" /></button>
                  </div>
                )}
                <textarea
                  className={`ai-assistant-composer-input ${styles.textarea}`}
                  value={draft}
                  onChange={(event) => { setDraft(event.target.value); if (error) setError('') }}
                  rows={1}
                  placeholder="问问 Omnilink"
                  aria-label="聊天内容"
                  onKeyDown={(event) => {
                    if (event.key === '@') setSkillMenuOpen(true)
                    if (event.key === 'Escape') setSkillMenuOpen(false)
                  }}
                />
              </div>
              <span className={styles.modelName}>DeepSeek V4 Pro</span>
              <button type="submit" className={`${styles.sendButton} ai-assistant-composer-send`} disabled={!draft.trim() && !pendingImage} aria-label="发送消息">
                <ArrowUp size={16} aria-hidden="true" />
              </button>
            </div>
          </LiquidGlass>
        </form>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </main>
  )
}
