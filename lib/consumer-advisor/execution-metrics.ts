import { sumModelUsage, unknownUsage, type ModelUsage } from '@/lib/ai/model-usage'
import type { WorkspaceModel, TextGenerationOptions } from '@/lib/ai/workspace-generation'

export type ModelStage = {stage:'parse'|'answer'|'vision'; model:WorkspaceModel; calls:number; durationMs:number; usage:ModelUsage; status:'completed'|'failed'}
export async function measureConsumerModel<T>(stages:ModelStage[], stage:ModelStage['stage'], model:WorkspaceModel,
  invoke:(options:Pick<TextGenerationOptions,'onUsage'|'onCall'>)=>Promise<T>):Promise<T> {
  const started = performance.now()
  const record:ModelStage = {stage,model,calls:0,durationMs:0,usage:unknownUsage(),status:'failed'}
  try {
    const result = await invoke({onUsage:(usage)=>{record.usage=usage},onCall:()=>{record.calls++}})
    record.status='completed'
    return result
  } finally {record.durationMs=Math.round(performance.now()-started);stages.push(record)}
}
export function executionMetrics(stages:ModelStage[], value:unknown, started:number) {
  const existing=(value && typeof value==='object'?value:{}) as Record<string,unknown>
  const all=[...new Set([...stages,...(Array.isArray(existing.modelStages)?existing.modelStages as ModelStage[]:[])])]
  const usage=sumModelUsage(all.filter((stage)=>stage.calls>0).map((stage)=>stage.usage))
  const retrieval=existing.retrieval as {embeddingCalls?:number;embeddingInputTokens?:number|null}|undefined
  const embeddingCalls=Number(existing.embeddingCalls??retrieval?.embeddingCalls??0)
  const embeddingInputTokens=embeddingCalls?(retrieval?.embeddingInputTokens??null):0
  const generationCalls=all.reduce((total,stage)=>total+stage.calls,0)
  return {...existing,modelStages:all,usage,usageScope:'request',totalMs:Math.round(performance.now()-started),
    generationCalls,modelCalls:generationCalls+embeddingCalls,
    embeddingInputTokens,totalInputTokens:usage.inputTokens===null||embeddingInputTokens===null?null:usage.inputTokens+embeddingInputTokens,
    cost:null,costStatus:'not-priced'}
}
