import { ModelConfigurationError, type WorkspaceModel } from '@/lib/ai/workspace-generation'

const parsers = new Set<WorkspaceModel>(['qwen-plus', 'deepseek-flash', 'gemini'])
export function consumerModelPolicy(answer: WorkspaceModel) {
  const configured = process.env.CONSUMER_PARSER_MODEL?.trim()
  if (configured && !parsers.has(configured as WorkspaceModel)) {
    throw new ModelConfigurationError('搜索解析模型配置无效。', {status:503, code:'MODEL_PROVIDER_UNAVAILABLE'})
  }
  return {parser:(configured || 'qwen-plus') as WorkspaceModel, answer,
    parserReason:configured ? 'configured-task-model' : 'default-task-model'}
}
