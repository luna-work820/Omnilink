// @vitest-environment jsdom
import { act, createElement, useState, type Provider } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  submitAttachment: vi.fn(),
}))

vi.mock('@/components/consumer-market/context/OmnilinkContext', async () => {
  const { createContext, useContext } = await import('react')
  const context = createContext<Record<string, unknown>>({})
  return { useOmnilink: () => useContext(context), TestProvider: context.Provider }
})
vi.mock('@/components/ui/liquid-glass', async () => {
  const { createElement } = await import('react')
  return { LiquidGlass: ({ children }: { children: React.ReactNode }) => createElement('div', null, children) }
})
vi.mock('@/components/kokonutui/ai-text-loading', () => ({ default: () => null }))
vi.mock('@phosphor-icons/react', () => ({
  Microphone: () => null, PaperPlaneRight: () => null, MagnifyingGlass: () => null, Plus: () => null,
}))

import { FeedChatDock } from '@/components/consumer-market/components/FeedChatDock'
import * as mockedContextModule from '@/components/consumer-market/context/OmnilinkContext'

const TestProvider = (mockedContextModule as unknown as { TestProvider: Provider<Record<string, unknown>> }).TestProvider
const installedSkills: ('personal-advisor')[] = ['personal-advisor']
let container: HTMLDivElement
let root: Root

function Harness({ initialSkill = null, disabled = false }: { initialSkill?: 'personal-advisor' | null; disabled?: boolean }) {
  const [skill, setSkill] = useState<'personal-advisor' | null>(initialSkill)
  const context = {
    activeAssistantSkillId: skill,
    setActiveAssistantSkillId: setSkill,
    openAiPage: vi.fn(), showToast: vi.fn(), stopAiResponse: vi.fn(), openPersonalView: vi.fn(),
    isAiThinking: false, discoveryBusy: false, products: [], savedProductIds: [],
  }
  return createElement(TestProvider, { value: context }, createElement(FeedChatDock, {
    selectedInsightValue: '', onInsightChange: () => {}, initialInstalledSkillIds: installedSkills,
    disabled, onSubmitMessage: mocks.submit, onSubmitAttachment: mocks.submitAttachment,
  }))
}

function button(label: string, within: ParentNode = container) {
  const found = [...within.querySelectorAll('button')].find((item) => item.textContent?.trim() === label)
  if (!found) throw new Error(`Button not found: ${label}`)
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
  const storage = () => {
    const values = new Map<string, string>()
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    }
  }
  vi.stubGlobal('localStorage', storage())
  vi.stubGlobal('sessionStorage', storage())
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('shows six actions on selection and starts the chosen analysis with the active skill', async () => {
  await act(async () => { root.render(createElement(Harness, {})) })
  expect(container.querySelector('[aria-label="形象助手功能"]')).toBeNull()
  await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="添加附件"]')!.click() })
  await act(async () => { button('形象助手').click() })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
  expect(document.activeElement?.textContent).toBe('肤质分析')

  const actions = container.querySelector('[aria-label="形象助手功能"]')!
  const choices = [
    ['肤质分析', '我想进行肤质分析。'],
    ['动物系长相', '我想了解自己的动物系长相。'],
    ['四季色彩', '我想了解自己的四季色彩。'],
    ['身材分型', '我想进行身材分型。'],
    ['穿搭建议', '我想获得穿搭建议。'],
    ['气质描述', '我想了解自己的气质表现。'],
  ]
  expect(actions.querySelectorAll('button')).toHaveLength(6)
  for (const [label, prompt] of choices) {
    await act(async () => { button(label, actions).click() })
    expect(mocks.submit).toHaveBeenLastCalledWith(prompt, [], true, 'personal-advisor')
  }
  await act(async () => { button('@形象助手 ×').click() })
  expect(container.querySelector('[aria-label="形象助手功能"]')).toBeNull()
})

it('sends a selected image and typed context with the chosen analysis', async () => {
  await act(async () => { root.render(createElement(Harness, { initialSkill: 'personal-advisor' })) })
  const input = container.querySelector<HTMLInputElement>('[aria-label="添加图片"]')!
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['photo'], 'photo.png', { type: 'image/png' })] })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
  const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '我想了解出油情况')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { button('肤质分析').click() })
  expect(mocks.submitAttachment).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'photo.png', kind: 'image', data: expect.stringMatching(/^data:image\/png;base64,/) }),
    '我想进行肤质分析。\n我想了解出油情况', [], true, 'personal-advisor',
  )
})

it('does not start an analysis while the composer is disabled', async () => {
  await act(async () => { root.render(createElement(Harness, { initialSkill: 'personal-advisor', disabled: true })) })
  const action = button('肤质分析')
  expect(action.disabled).toBe(true)
  await act(async () => { action.click() })
  expect(mocks.submit).not.toHaveBeenCalled()
})

it('keeps an unsent URL in the composer while starting an analysis', async () => {
  await act(async () => { root.render(createElement(Harness, { initialSkill: 'personal-advisor' })) })
  await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="添加附件"]')!.click() })
  await act(async () => { button('网址').click() })
  const input = container.querySelector<HTMLInputElement>('input[placeholder="https://"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'https://example.com')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { button('添加网址').click() })
  await act(async () => { button('身材分型').click() })
  expect(mocks.submit).toHaveBeenCalledWith('我想进行身材分型。', [], true, 'personal-advisor')
  expect(mocks.submitAttachment).not.toHaveBeenCalled()
  expect(container.textContent).toContain('example.com')
})
