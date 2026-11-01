import { execFileSync, spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const env = { ...process.env }

if (process.platform === 'darwin' && !env.HTTPS_PROXY && !env.https_proxy) {
  try {
    const settings = execFileSync('scutil', ['--proxy'], { encoding: 'utf8' })
    const read = (key) => settings.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, 'm'))?.[1]?.trim()

    if (read('HTTPSEnable') === '1') {
      const host = read('HTTPSProxy')
      const port = read('HTTPSPort')
      if (host && port) {
        env.HTTPS_PROXY = `http://${host}:${port}`
        env.HTTP_PROXY ??= env.HTTPS_PROXY
        env.NO_PROXY ??= 'localhost,127.0.0.1,::1'
      }
    }
  } catch {
    // Continue without a system proxy when macOS has none available.
  }
}

if (env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy) {
  env.NODE_USE_ENV_PROXY = '1'
}

const require = createRequire(import.meta.url)
const next = require.resolve('next/dist/bin/next')
const child = spawn(process.execPath, [next, 'dev', '-p', '3000', '-H', '0.0.0.0', ...process.argv.slice(2)], {
  env,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
