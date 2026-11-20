export type ModelUsage = {inputTokens:number|null; outputTokens:number|null; cachedInputTokens:number|null}
export const unknownUsage = ():ModelUsage => ({inputTokens:null, outputTokens:null, cachedInputTokens:null})
const count = (value:unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
export function readModelUsage(value:unknown):ModelUsage {
  const data = (value && typeof value === 'object' ? value : {}) as Record<string,unknown>
  const details = data.prompt_tokens_details as Record<string,unknown>|undefined
  return {inputTokens:count(data.prompt_tokens ?? data.promptTokenCount),
    outputTokens:count(data.completion_tokens ?? data.candidatesTokenCount),
    cachedInputTokens:count(details?.cached_tokens ?? data.prompt_cache_hit_tokens ?? data.cachedContentTokenCount)}
}
export function sumModelUsage(values:ModelUsage[]):ModelUsage {
  const sum = (field:keyof ModelUsage) => values.some((value) => value[field] === null) ? null
    : values.reduce((total,value) => total + value[field]!,0)
  return {inputTokens:sum('inputTokens'), outputTokens:sum('outputTokens'), cachedInputTokens:sum('cachedInputTokens')}
}
