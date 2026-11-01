import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { generateWorkspaceDeepSeekVisionText, generateWorkspaceText } from '@/lib/ai/workspace-generation'
import { extractPdfText } from '@/lib/consumer-advisor/pdf-text'

function samplePdf(text: string) {
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf).toString('base64')
}

const originalKey = process.env.DEEPSEEK_API_KEY

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = 'simulation-key'
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    choices: [{ message: { content: '{"analysisText":"模拟推荐","matchedProductIds":[]}' } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
})

afterEach(() => {
  if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY
  else process.env.DEEPSEEK_API_KEY = originalKey
  vi.unstubAllGlobals()
})

describe('DeepSeek recommendation transport', () => {
  it('requests structured output from V4 Pro in thinking mode', async () => {
    const result = await generateWorkspaceText('deepseek-v4-pro', '虚构用户想找台灯', '仅输出 JSON', { jsonOutput: true })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    const payload = JSON.parse(String(init?.body))

    expect(result).toContain('模拟推荐')
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect(payload.model).toBe('deepseek-v4-pro')
    expect(payload.thinking).toEqual({ type: 'enabled' })
    expect(payload.response_format).toEqual({ type: 'json_object' })
    expect(payload.messages[1].content).toBe('虚构用户想找台灯')
  })

  it('sends images to DeepSeek Flash without a Gemini request', async () => {
    await generateWorkspaceDeepSeekVisionText('描述图片', { mimeType: 'image/png', base64: 'aGVsbG8=' }, '只描述可见内容')
    const [, init] = vi.mocked(fetch).mock.calls[0]
    const payload = JSON.parse(String(init?.body))

    expect(payload.model).toBe('deepseek-flash')
    expect(payload.thinking).toEqual({ type: 'disabled' })
    expect(payload.messages[1].content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,aGVsbG8=', detail: 'original' },
    })
  })

  it('reports a provider balance failure for the route to handle', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      error: { message: 'Insufficient Balance' },
    }), { status: 402, headers: { 'Content-Type': 'application/json' } }))

    await expect(generateWorkspaceText('deepseek-v4-pro', '虚构需求', '仅输出 JSON', { jsonOutput: true }))
      .rejects.toThrow('Insufficient Balance')
  })

  it('extracts PDF text locally before asking DeepSeek', async () => {
    expect(await extractPdfText(samplePdf('Desk lamp under budget'))).toContain('Desk lamp under budget')
    expect(fetch).not.toHaveBeenCalled()
  })
})
