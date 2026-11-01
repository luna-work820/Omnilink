import 'server-only'

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

export async function extractPdfText(base64: string) {
  const loadingTask = getDocument({
    data: new Uint8Array(Buffer.from(base64, 'base64')),
    useSystemFonts: true,
  })

  try {
    const pdf = await loadingTask.promise
    const pages: string[] = []
    let length = 0
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 20) && length < 16_000; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items.flatMap((item) => 'str' in item ? [item.str] : []).join(' ').trim()
      if (text) {
        pages.push(`第 ${pageNumber} 页：${text}`)
        length += text.length
      }
      page.cleanup()
    }
    const result = pages.join('\n').slice(0, 16_000)
    if (!result) throw new Error('PDF 中没有可提取的文字，请上传文本版 PDF。')
    return result
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('PDF 中没有可提取的文字')) throw error
    throw new Error('PDF 文件无效或无法读取。')
  } finally {
    await loadingTask.destroy()
  }
}
