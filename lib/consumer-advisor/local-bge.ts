import 'server-only'

import { spawn } from 'node:child_process'
import path from 'node:path'

export const LOCAL_BGE_MODEL = 'BAAI/bge-small-zh-v1.5-onnx-quantized'
export const LOCAL_BGE_DIMENSIONS = 512

const defaultModelDirectory = '/Volumes/luna ssd/商品素材库/outputs/检索实验/models/bge-small-zh-v1.5-onnx'

export async function embedLocalBge(texts: string[], mode: 'query' | 'document') {
  if (!texts.length) return [] as number[][]
  if (texts.length > 64) throw new Error('单次本地向量请求最多处理 64 条文本。')

  const modelDirectory = process.env.CONSUMER_BGE_MODEL_DIR?.trim() || defaultModelDirectory
  const python = process.env.CONSUMER_BGE_PYTHON?.trim() || 'python3'
  const script = path.join(process.cwd(), 'scripts', 'bge_embed.py')
  const child = spawn(python, [script, modelDirectory, mode], { stdio: ['pipe', 'pipe', 'pipe'] })
  const stdout: Buffer[] = []
  const stderr: Buffer[] = []

  const result = new Promise<number[][]>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('本地 BGE 向量生成超时。'))
    }, 45_000)
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        const detail = Buffer.concat(stderr).toString('utf8').trim().slice(-500)
        reject(new Error(detail || `本地 BGE 进程退出（${code}）。`))
        return
      }
      try {
        const parsed = JSON.parse(Buffer.concat(stdout).toString('utf8')) as { vectors?: unknown }
        const vectors = parsed.vectors
        if (!Array.isArray(vectors) || vectors.length !== texts.length || vectors.some((vector) =>
          !Array.isArray(vector) || vector.length !== LOCAL_BGE_DIMENSIONS || vector.some((value) => typeof value !== 'number' || !Number.isFinite(value)))) {
          throw new Error('本地 BGE 返回的向量格式无效。')
        }
        resolve(vectors as number[][])
      } catch (error) {
        reject(error)
      }
    })
  })

  child.stdin.end(JSON.stringify({ texts }))
  return result
}

export function localBgePgVector(vector: number[]) {
  if (vector.length !== LOCAL_BGE_DIMENSIONS || vector.some((value) => !Number.isFinite(value))) {
    throw new Error('本地 BGE 向量维度无效。')
  }
  return `[${vector.join(',')}]`
}
