import { execFileSync } from 'node:child_process'
import * as http from 'node:http'

export function configureSystemProxy() {
  if (process.platform === 'darwin' && !process.env.HTTPS_PROXY && !process.env.https_proxy) {
    try {
      const settings = execFileSync('scutil', ['--proxy'], {encoding:'utf8'})
      const read = (key) => settings.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, 'm'))?.[1]?.trim()
      if (read('HTTPSEnable') === '1' && read('HTTPSProxy') && read('HTTPSPort')) {
        process.env.HTTPS_PROXY = `http://${read('HTTPSProxy')}:${read('HTTPSPort')}`
        process.env.HTTP_PROXY ??= process.env.HTTPS_PROXY
        process.env.NO_PROXY ??= 'localhost,127.0.0.1,::1'
      }
    } catch { /* A system proxy is optional. */ }
  }
  http.setGlobalProxyFromEnv?.()
}
