import 'server-only'

import type { WorkspaceModel } from '@/lib/ai/workspace-generation'
import { buildProfileTaskResult, isProfileGoal, PROFILE_GOAL, PROFILE_QUESTIONS, type AdvisorProfile } from './profile-intake'
import { initialAdvisorQuestion, nextAdvisorQuestion, type AdvisorTask } from './task-contract'
import { recommendAdvisor } from './task-server'

const globalStore = globalThis as typeof globalThis & { __omnilinkAdvisorPreview?: Map<string, AdvisorTask[]> }
const sessions = globalStore.__omnilinkAdvisorPreview ?? new Map<string, AdvisorTask[]>()
globalStore.__omnilinkAdvisorPreview = sessions

export function previewLatest(sessionId: string): AdvisorTask | null {
  return sessions.get(sessionId)?.[0] ?? null
}

export function previewById(sessionId: string, taskId: string): AdvisorTask | null {
  return sessions.get(sessionId)?.find((task) => task.id === taskId) ?? null
}

export function previewLatestProfile(sessionId: string): AdvisorProfile | null {
  return sessions.get(sessionId)?.find((task) => task.goal === PROFILE_GOAL && task.status === 'completed' && task.result?.profile)?.result?.profile ?? null
}

export function previewCreate(sessionId: string, goal: string): AdvisorTask {
  const now = new Date().toISOString()
  const task: AdvisorTask = {
    id: crypto.randomUUID(), goal, answers: [], status: 'waiting_for_user', question: initialAdvisorQuestion(goal),
    result: null, errorMessage: null, revision: 0, updatedAt: now, preview: true,
    steps: (isProfileGoal(goal) ? ['开始建档', '了解你的自述', '整理分领域档案', '准备后续咨询'] : ['理解目标与约束', '确认个人偏好', '查询并核对商品', '生成穿搭方案']).map((label, index) => ({
      stepNo: index + 1, label, status: index === 0 ? 'completed' : index === 1 ? 'waiting_for_user' : 'pending',
      outputSummary: index === 0 ? '已记录你的目标。' : null,
    })),
  }
  sessions.set(sessionId, [task, ...(sessions.get(sessionId) ?? [])].slice(0, 5))
  return task
}

export async function previewAdvance(sessionId: string, taskId: string, action: string, answer: string, model: WorkspaceModel): Promise<AdvisorTask | null> {
  const task = previewById(sessionId, taskId)
  if (!task) return null
  if (action === 'cancel' && task.status !== 'running' && !(isProfileGoal(task.goal) && task.status === 'completed')) { task.status = 'cancelled'; task.question = null; return task }
  if (!((action === 'answer' && task.status === 'waiting_for_user') || (action === 'revise' && task.status === 'completed') || (action === 'retry' && task.status === 'failed'))) return null
  const nextQuestion = action === 'answer' ? nextAdvisorQuestion(task.goal, task.question) : null
  if (nextQuestion) {
    task.answers.push(answer)
    task.question = nextQuestion
    task.revision += 1
    task.updatedAt = new Date().toISOString()
    task.steps[1].outputSummary = isProfileGoal(task.goal) ? `已完成 ${task.answers.length} / ${PROFILE_QUESTIONS.length} 题。` : `已记录 ${task.answers.length} 项偏好，继续选择。`
    return task
  }
  if (isProfileGoal(task.goal)) {
    if (task.status !== 'waiting_for_user') return null
    task.answers.push(answer)
    task.result = buildProfileTaskResult(task.answers)
    task.status = 'completed'
    task.question = null
    task.revision += 1
    task.updatedAt = new Date().toISOString()
    for (let index = 1; index < 4; index += 1) task.steps[index].status = 'completed'
    task.steps[1].outputSummary = '已记录或跳过全部问题。'
    task.steps[2].outputSummary = '穿衣、护肤和头发信息已分开整理。'
    task.steps[3].outputSummary = '档案可用于后续咨询。'
    return task
  }
  task.status = 'running'
  if (action !== 'retry') task.answers.push(answer)
  task.question = null
  task.result = null
  task.errorMessage = null
  task.revision += 1
  task.updatedAt = new Date().toISOString()
  task.steps[1].status = 'completed'
  task.steps[1].outputSummary = answer === '跳过' ? '用户跳过补充问题。' : '已记录补充信息。'
  task.steps[2].status = 'running'
  task.steps[2].outputSummary = null
  task.steps[3].status = 'pending'
  task.steps[3].outputSummary = null
  try {
    task.result = await recommendAdvisor(task.goal, task.answers, model, previewLatestProfile(sessionId))
    task.steps[2].status = 'completed'
    task.steps[2].outputSummary = `已核对 ${task.result.products.length} 件商品。`
    task.steps[3].status = 'completed'
    task.steps[3].outputSummary = task.result.mode === 'catalog_fallback' ? '模型未完成，已整理目录候选。' : task.result.looks.length ? `形成 ${task.result.looks.length} 套方案。` : '已说明当前目录不足。'
    task.status = 'completed'
  } catch (error) {
    task.status = 'failed'
    task.errorMessage = error instanceof Error ? error.message : '生成方案失败。'
    task.steps[2].status = 'failed'
    task.steps[2].outputSummary = task.errorMessage
  }
  task.updatedAt = new Date().toISOString()
  return task
}
