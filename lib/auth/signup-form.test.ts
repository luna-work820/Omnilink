// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ signup: vi.fn(), resend: vi.fn() }))
vi.mock('@/app/actions/auth', () => ({ signupAction: mock.signup, resendSignupConfirmationAction: mock.resend }))
vi.mock('@/components/login-package/components/Shuffle', () => ({ default: ({ text }: { text: string }) => text }))
import { SignupForm } from '@/components/login-package/components/SignupForm'

let container: HTMLDivElement
let root: Root

function fill(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('signup confirmation', () => {
  it('lets the user resend to the address they submitted without resending their password', async () => {
    mock.signup.mockResolvedValue({ message: '请查收确认邮件', canResendConfirmation: true })
    mock.resend.mockResolvedValue({ message: '确认邮件发送请求已提交' })
    await act(async () => { root.render(createElement(SignupForm, { onSwitchToLogin: () => {} })) })

    await act(async () => {
      fill(container.querySelector<HTMLInputElement>('[name="name"]')!, '测试用户')
      fill(container.querySelector<HTMLInputElement>('[name="email"]')!, 'person@example.com')
      fill(container.querySelector<HTMLInputElement>('[name="password"]')!, 'test-password')
    })
    await act(async () => { container.querySelector('form')!.requestSubmit() })
    expect(container.textContent).toContain('请查收确认邮件')

    const resend = [...container.querySelectorAll('button')].find((button) => button.textContent === '重发确认邮件')!
    await act(async () => { resend.click() })
    const formData = mock.resend.mock.calls[0][1] as FormData
    expect(formData.get('email')).toBe('person@example.com')
    expect(formData.has('password')).toBe(false)
    expect(container.textContent).toContain('确认邮件发送请求已提交')
  })

  it.each([
    '该邮箱已被注册，请直接切换至「登录」模式。',
    '用户名已被使用，请更换用户名。',
  ])('shows the registration conflict to the user: %s', async (message) => {
    mock.signup.mockResolvedValue({ error: message })
    await act(async () => { root.render(createElement(SignupForm, { onSwitchToLogin: () => {} })) })
    await act(async () => {
      fill(container.querySelector<HTMLInputElement>('[name="name"]')!, '测试用户')
      fill(container.querySelector<HTMLInputElement>('[name="email"]')!, 'person@example.com')
      fill(container.querySelector<HTMLInputElement>('[name="password"]')!, 'test-password')
    })
    await act(async () => { container.querySelector('form')!.requestSubmit() })
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(message)
    expect(container.textContent).not.toContain('重发确认邮件')
  })
})
