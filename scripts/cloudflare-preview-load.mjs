import { performance } from 'node:perf_hooks'

const origin = 'https://omnilink-login-design-omnilink.tudouqun.workers.dev'
const allowedPaths = new Set(['/', '/login', '/discover'])
const options = { path: '/login', rps: 2, seconds: 10 }

for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]?.replace(/^--/, '')
  const value = process.argv[i + 1]
  if (!(key in options) || value === undefined) {
    throw new Error('Usage: node scripts/cloudflare-preview-load.mjs [--path /login] [--rps 2] [--seconds 10]')
  }
  options[key] = key === 'path' ? value : Number(value)
}

if (!allowedPaths.has(options.path)) throw new Error('Only read-only public routes are allowed.')
if (!Number.isInteger(options.rps) || options.rps < 1 || options.rps > 100) throw new Error('rps must be 1–100.')
if (!Number.isInteger(options.seconds) || options.seconds < 1 || options.seconds > 120) throw new Error('seconds must be 1–120.')
if (options.rps * options.seconds > 5000) throw new Error('This run is limited to 5,000 requests.')

const url = new URL(options.path, origin)
const timeoutMs = 8000

async function request() {
  const started = performance.now()
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'omnilink-phase3-readonly-load/1' },
    })
    await response.arrayBuffer()
    return { status: response.status, ms: performance.now() - started }
  } catch (error) {
    return { error: error?.cause?.code ?? error?.name ?? 'network_error', ms: performance.now() - started }
  }
}

const probe = await request()
if (probe.error || probe.status >= 400) {
  console.error(JSON.stringify({ outcome: 'probe_failed', url: url.href, probe }))
  process.exitCode = 1
} else {
  const count = options.rps * options.seconds
  const results = []
  const start = performance.now()
  let next = 0

  async function worker() {
    while (next < count) {
      const slot = next++
      const delay = start + slot * 1000 / options.rps - performance.now()
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
      results.push(await request())
    }
  }

  await Promise.all(Array.from({ length: Math.min(options.rps, 20) }, worker))
  const latencies = results.filter((result) => !result.error).map((result) => result.ms).sort((a, b) => a - b)
  const percentile = (p) => latencies.length ? Math.round(latencies[Math.ceil(latencies.length * p) - 1]) : null
  const errors = results.filter((result) => result.error || result.status >= 400)
  console.log(JSON.stringify({
    outcome: errors.length ? 'failed' : 'passed',
    url: url.href,
    requestedRps: options.rps,
    durationSeconds: options.seconds,
    requests: results.length,
    actualRps: Number((results.length / ((performance.now() - start) / 1000)).toFixed(2)),
    errorCount: errors.length,
    errorRate: Number((errors.length / results.length).toFixed(4)),
    errorSamples: errors.slice(0, 5),
    latencyMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) },
  }, null, 2))
  if (errors.length) process.exitCode = 1
}
