import { z } from 'zod'

export const embeddingProfileIdSchema = z.enum(['bge-small-zh-v1.5-512-v1', 'qwen-text-embedding-v4-1024-v1', 'bge-small-zh-v1.5-512-v2', 'qwen-text-embedding-v4-1024-v2'])
export const DEFAULT_EMBEDDING_PROFILE = 'bge-small-zh-v1.5-512-v1' as const
export type EmbeddingProfileId = z.infer<typeof embeddingProfileIdSchema>
export type EmbeddingProfile = {
  id: EmbeddingProfileId; provider: 'local-bge' | 'qwen'; model: string; revision: string;
  dimensions: number; preprocessing: string; indexVersion: number;
}
export const embeddingProfiles: Record<EmbeddingProfileId, EmbeddingProfile> = {
  'bge-small-zh-v1.5-512-v2': {
    id:'bge-small-zh-v1.5-512-v2',provider:'local-bge',model:'BAAI/bge-small-zh-v1.5-onnx-quantized',
    revision:'v1.5-onnx-quantized',dimensions:512,preprocessing:'product-facts-bilingual-v2',indexVersion:2,
  },
  'qwen-text-embedding-v4-1024-v2': {
    id:'qwen-text-embedding-v4-1024-v2',provider:'qwen',model:'text-embedding-v4',
    revision:'provider-alias:text-embedding-v4',dimensions:1024,preprocessing:'product-facts-bilingual-v2',indexVersion:2,
  },
  'bge-small-zh-v1.5-512-v1': {
    id: 'bge-small-zh-v1.5-512-v1', provider: 'local-bge', model: 'BAAI/bge-small-zh-v1.5-onnx-quantized',
    revision: 'v1.5-onnx-quantized', dimensions: 512, preprocessing: 'product-facts-v1', indexVersion: 1,
  },
  'qwen-text-embedding-v4-1024-v1': {
    id: 'qwen-text-embedding-v4-1024-v1', provider: 'qwen', model: 'text-embedding-v4',
    revision: 'provider-alias:text-embedding-v4', dimensions: 1024, preprocessing: 'product-facts-v1', indexVersion: 1,
  },
}
export const retrievalOptionsSchema = z.object({
  mode: z.enum(['auto', 'keyword', 'semantic', 'hybrid']).default('auto'),
  profile: embeddingProfileIdSchema.default(DEFAULT_EMBEDDING_PROFILE),
})
export type RetrievalOptions = z.infer<typeof retrievalOptionsSchema>
export type RetrievalReport = {
  requestedMode: RetrievalOptions['mode']; effectiveMode: 'keyword' | 'semantic' | 'hybrid';
  profile: EmbeddingProfile | null; degraded: boolean; reason: string | null;
  selectionReason?: 'EXPLICIT_MODE' | 'KEYWORD_OVERRIDE' | 'AUTO_SOFT_TERMS' | 'AUTO_NO_KEYWORD_MATCH' | 'AUTO_KEYWORD_MATCH' | 'AUTO_NO_CANDIDATES';
  /** How the request was routed, what was recognised, and why the result was empty or degraded. */
  routeSource?: 'rule' | 'explicit' | 'model';
  keywordKind?: 'category' | 'name' | 'brand' | 'store' | 'model' | 'phrase' | null;
  resultReason?: 'MATCH' | 'NO_ELIGIBLE' | 'NO_KEYWORD_MATCH' | 'SEMANTIC_DEGRADED';
  embeddingCalls: number; embeddingInputTokens: number | null; embeddingMs: number; retrievalMs: number;
  candidateCount: number; keywordCount: number; semanticCount: number; totalMs: number;
  eligibilityMs?:number; rankingMs?:number;
}
