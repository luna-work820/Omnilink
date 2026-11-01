import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { generateWorkspaceText, ModelConfigurationError } from '@/lib/ai/workspace-generation'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const originalEnv = {
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
}

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = 'test-deepseek-key'
  delete process.env.DASHSCOPE_API_KEY
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
})

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  vi.unstubAllGlobals()
})

describe('model gateway upstream resilience', () => {
  it('retries a 429 and succeeds on the next attempt', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'rate limited' } }, 429))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'ok' } }] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateWorkspaceText('deepseek-flash', 'hi')).resolves.toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries a 503 but gives up after the attempt ceiling', async () => {
    // Each attempt must get its own Response, exactly like a real fetch.
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ error: { message: 'unavailable' } }, 503))
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateWorkspaceText('deepseek-flash', 'hi')).rejects.toThrow('unavailable')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry a 500 — a bad request stays a bad request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'internal error' } }, 500))
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateWorkspaceText('deepseek-flash', 'hi')).rejects.toThrow('internal error')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a 400', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'bad request' } }, 400))
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateWorkspaceText('deepseek-flash', 'hi')).rejects.toThrow('bad request')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives every provider request an abort signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }))
    vi.stubGlobal('fetch', fetchMock)

    await generateWorkspaceText('deepseek-flash', 'hi')
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('gives the Qwen branch an abort signal too', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-qwen-key'
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }))
    vi.stubGlobal('fetch', fetchMock)

    await generateWorkspaceText('qwen-plus', 'hi')
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })
})

describe('model gateway configuration errors', () => {
  it('reports a missing BYOK key as a 400-class configuration error', async () => {
    delete process.env.DEEPSEEK_API_KEY
    const error = await generateWorkspaceText('deepseek-flash', 'hi', undefined, { allowEnvironmentKey: false })
      .then(() => null, (e: unknown) => e)

    expect(error).toBeInstanceOf(ModelConfigurationError)
    expect((error as ModelConfigurationError).status).toBe(400)
    expect((error as ModelConfigurationError).code).toBe('MODEL_KEY_REQUIRED')
  })

  it('reports a missing platform key as a 500-class configuration error', async () => {
    delete process.env.DEEPSEEK_API_KEY
    const error = await generateWorkspaceText('deepseek-flash', 'hi')
      .then(() => null, (e: unknown) => e)

    expect(error).toBeInstanceOf(ModelConfigurationError)
    expect((error as ModelConfigurationError).status).toBe(500)
    expect((error as ModelConfigurationError).code).toBe('MODEL_PROVIDER_UNAVAILABLE')
  })

  it('uses the merchant key when one is supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }))
    vi.stubGlobal('fetch', fetchMock)

    await generateWorkspaceText('deepseek-flash', 'hi', undefined, { apiKey: 'merchant-key', allowEnvironmentKey: false })
    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer merchant-key')
  })
})
