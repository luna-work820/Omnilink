import 'server-only'
import { embedLocalBge } from './local-bge'
import type { EmbeddingProfile } from './embedding-profile'

export type EmbeddingResult = {vectors: number[][]; calls: number; inputTokens: number | null; durationMs: number}
export class EmbeddingError extends Error {
  constructor(readonly code: string, readonly calls = 0) { super(code) }
}

export function validateEmbeddingVectors(value: unknown, count: number, dimensions: number): asserts value is number[][] {
  if (!Array.isArray(value) || value.length !== count || value.some((vector) => !Array.isArray(vector)
    || vector.length !== dimensions || vector.some((n) => typeof n !== 'number' || !Number.isFinite(n))
    || !vector.some((n) => n !== 0))) throw new EmbeddingError('EMBEDDING_INVALID')
}

export async function embedConsumerTexts(profile: EmbeddingProfile, texts: string[], mode: 'query' | 'document', signal?: AbortSignal): Promise<EmbeddingResult> {
  if (!texts.length || texts.length > (profile.provider === 'qwen' ? 10 : 24)) throw new EmbeddingError('EMBEDDING_BATCH_INVALID')
  signal?.throwIfAborted()
  const input = texts.map((text) => text.normalize('NFKC').trim())
  if (input.some((text) => !text || text.length > 4000)) throw new EmbeddingError('EMBEDDING_INPUT_INVALID')
  const started = performance.now()
  let calls = 0
  try {
    if (profile.provider === 'local-bge') {
      calls++
      const timeout=AbortSignal.timeout(mode==='query'?8000:45_000)
      const vectors = await embedLocalBge(input, mode, signal?AbortSignal.any([signal,timeout]):timeout)
      validateEmbeddingVectors(vectors, input.length, profile.dimensions)
      return {vectors, calls, inputTokens: null, durationMs: Math.round(performance.now() - started)}
    }
    const key = process.env.DASHSCOPE_API_KEY
    const workspace = process.env.BAILIAN_WORKSPACE_ID
    const base = (process.env.DASHSCOPE_BASE_URL || (workspace
      ? `https://${workspace}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
      : 'https://dashscope.aliyuncs.com/compatible-mode/v1')).replace(/\/$/, '')
    if (!key) throw new EmbeddingError('EMBEDDING_NOT_CONFIGURED')
    calls++
    const response = await fetch(`${base}/embeddings`, {
      method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${key}`},
      body: JSON.stringify({model: profile.model, input, dimensions: profile.dimensions, encoding_format: 'float'}),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new EmbeddingError('EMBEDDING_UNAVAILABLE', calls)
    const data = await response.json() as {model?: string; data?: {index: number; embedding: number[]}[]; usage?: {total_tokens?: number}}
    if (data.model && data.model !== profile.model) throw new EmbeddingError('EMBEDDING_MODEL_MISMATCH', calls)
    const entries = data.data?.slice().sort((a, b) => a.index - b.index)
    if (!entries || entries.some((entry, i) => entry.index !== i)) throw new EmbeddingError('EMBEDDING_INVALID', calls)
    const vectors = entries.map((entry) => entry.embedding)
    validateEmbeddingVectors(vectors, input.length, profile.dimensions)
    return {vectors, calls, inputTokens: typeof data.usage?.total_tokens === 'number' ? data.usage.total_tokens : null,
      durationMs: Math.round(performance.now() - started)}
  } catch (error) {
    if (signal?.aborted) throw error
    throw new EmbeddingError(error instanceof EmbeddingError ? error.code : 'EMBEDDING_UNAVAILABLE', calls)
  }
}
