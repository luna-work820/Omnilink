// 来源链接稳定性探测器：可达性 + Cheerio 商品结构可解析性。
// 用法：node scripts/check-source-links.mjs --file <清单.txt|清单.json> [--out <报告.json>] [--concurrency 4] [--timeout 12000]
// 清单为纯文本时每行一个 URL，空行与 # 开头忽略；为 JSON 时支持字符串数组或 [{url}]。
import { readFile, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { load } from 'cheerio'

const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  return index < 0 ? undefined : args[index + 1]
}
const file = option('--file')
const singleUrl = option('--url')
const out = option('--out')
const concurrency = Math.min(16, Math.max(1, Number(option('--concurrency')) || 4))
const timeoutMs = Math.min(60_000, Math.max(1000, Number(option('--timeout')) || 12_000))
const userAgent = option('--user-agent') || 'OmnilinkSourceLinkProbe/1 (+link-stability-check)'

if (!file && !singleUrl) {
  console.error('用法：node scripts/check-source-links.mjs --file <清单路径> | --url <单个URL> [--out <报告.json>] [--concurrency 4] [--timeout 12000]')
  process.exit(2)
}

const asRecord = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const first = (value) => Array.isArray(value) ? value[0] : value

async function loadUrls() {
  if (singleUrl) return [singleUrl]
  const text = (await readFile(file, 'utf8')).trim()
  if (!text) return []
  if (text.startsWith('[')) {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error('清单 JSON 必须是数组')
    return parsed.map((entry) => typeof entry === 'string' ? entry : asRecord(entry).url).filter(Boolean)
  }
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
}

function charsetFrom(contentType = '') {
  const match = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)
  return match ? match[1].toLowerCase() : ''
}

async function decodeBody(response) {
  const buffer = Buffer.from(await response.arrayBuffer())
  const head = buffer.subarray(0, 4096).toString('latin1')
  const meta = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)
  const charset = charsetFrom(response.headers.get('content-type') || '') || meta?.[1]?.toLowerCase() || 'utf-8'
  const decoder = /^(gb2312|gbk|gb18030)$/.test(charset) ? new TextDecoder('gb18030') : new TextDecoder('utf-8')
  return { text: decoder.decode(buffer), bytes: buffer.length, charset }
}

function findProduct(value) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findProduct(entry)
      if (found) return found
    }
    return null
  }
  const object = asRecord(value)
  const types = Array.isArray(object['@type']) ? object['@type'] : [object['@type']]
  if (types.some((type) => typeof type === 'string' && /(?:^|\/)Product$/.test(type))) return object
  for (const child of Object.values(object)) {
    if (child && typeof child === 'object') {
      const found = findProduct(child)
      if (found) return found
    }
  }
  return null
}

function clean(value, max = 240) {
  return typeof value === 'string' ? load(value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')).text().replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

// 静态关键词 + JS 跳转登录墙特征。淘宝/天猫风控页返回 200 + 一段强制跳登录的 JS，
// 正文无验证码字样，仅靠关键词会漏判，必须识别 _____tmd_____ / rgv587_flag / x5secdata。
const BLOCK_MARKERS = [
  '验证码', '滑动验证', '安全验证', 'captcha', 'just a moment', 'access denied', 'robot check', '请输入验证',
  '_____tmd_____', 'rgv587_flag', 'x5secdata', 'login_jump',
]

async function probe(rawUrl) {
  const started = performance.now()
  const base = { url: rawUrl }
  let target
  try {
    target = new URL(rawUrl)
    if (!/^https?:$/.test(target.protocol)) throw new Error('UNSUPPORTED_PROTOCOL')
  } catch (error) {
    return { ...base, verdict: 'invalid', error: error?.message || 'INVALID_URL', ms: Math.round(performance.now() - started) }
  }

  let response
  try {
    response = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': userAgent, 'accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8', 'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8' },
    })
  } catch (error) {
    return { ...base, verdict: 'error', error: error?.cause?.code ?? error?.name ?? 'network_error', ms: Math.round(performance.now() - started) }
  }

  const ms = Math.round(performance.now() - started)
  const status = response.status
  const finalUrl = response.url || target.href
  let body = { text: '', bytes: 0, charset: 'utf-8' }
  try {
    body = await decodeBody(response)
  } catch (error) {
    return { ...base, status, finalUrl, ms, verdict: 'error', error: `decode_failed:${error?.message || 'unknown'}` }
  }

  const lower = body.text.toLowerCase()
  const keywordMarker = BLOCK_MARKERS.find((marker) => lower.includes(marker))
  // JS 登录墙：window._config_ 里 action:"login" 或强制跳 login.taobao.com 的脚本。
  const jsLoginWall = /action\s*:\s*["']login["']/i.test(body.text)
    || /login\.(m\.)?taobao\.com/i.test(body.text)
    || /location\.href\s*=\s*host\s*\+\s*jump/i.test(body.text)
  const blockMarker = keywordMarker || (jsLoginWall ? 'js_login_wall' : null)
  const reachable = status < 400
  const blocked = Boolean(blockMarker) || /\/login(?:\?|$)/i.test(finalUrl) && !/\/product/i.test(finalUrl)

  const $ = load(body.text)
  const jsonldBlocks = $('script[type="application/ld+json"]').length
  let product = null
  $('script[type="application/ld+json"]').each((_, element) => {
    if (product) return
    try { product = findProduct(JSON.parse($(element).html() || 'null')) } catch { /* 其他脚本块可能仍有效 */ }
  })
  const offer = asRecord(first(product?.offers))
  const micro = $('[itemscope][itemtype$="/Product"]').first()
  const microProp = (name) => {
    const element = micro.find(`[itemprop="${name}"]`).first()
    return element.attr('content') || element.attr('src') || element.attr('href') || element.text() || ''
  }
  const name = clean(product?.name || microProp('name') || $('meta[property="og:title"]').attr('content') || $('title').text())
  const price = clean(offer.price ?? microProp('price') ?? $('meta[property="product:price:amount"]').attr('content'), 40)
  const currency = clean(offer.priceCurrency || microProp('priceCurrency') || $('meta[property="product:price:currency"]').attr('content'), 8).toUpperCase()
  const image = clean(first(product?.image) || microProp('image') || $('meta[property="og:image"]').attr('content'), 500)
  const availability = clean(offer.availability || microProp('availability'), 120)
  const brandValue = first(product?.brand)
  const brand = clean(typeof brandValue === 'string' ? brandValue : asRecord(brandValue).name, 120) || clean(microProp('brand'), 120)
  const description = clean(product?.description || microProp('description') || $('meta[property="og:description"]').attr('content'), 300)

  const fields = { name, price, currency, image, availability, brand, description }
  const present = Object.entries(fields).filter(([, value]) => Boolean(value)).map(([key]) => key)
  const hasStructuredProduct = Boolean(product) || micro.length > 0
  const parseable = reachable && !blocked && hasStructuredProduct && Boolean(name)
  const score = parseable ? Math.round((present.length / Object.keys(fields).length) * 100) : 0
  const verdict = !reachable ? 'unreachable' : blocked ? 'blocked' : parseable && score >= 60 ? 'ok' : 'partial'

  return {
    ...base,
    status,
    finalUrl,
    redirected: finalUrl.replace(/\/$/, '') !== target.href.replace(/\/$/, ''),
    ms,
    bytes: body.bytes,
    charset: body.charset,
    reachable,
    blocked,
    blockMarker: blockMarker || null,
    parse: {
      jsonldBlocks,
      hasJsonldProduct: Boolean(product),
      hasOffer: Boolean(offer.price || offer.priceCurrency),
      hasMicrodataProduct: micro.length > 0,
      title: clean($('title').text(), 120) || null,
      name: name || null,
      price: price || null,
      currency: currency || null,
      image: image ? image.slice(0, 160) : null,
      availability: availability || null,
      brand: brand || null,
      description: description ? `${description.slice(0, 80)}…` : null,
      fieldsPresent: present,
      score,
      parseable,
    },
    verdict,
  }
}

const urls = await loadUrls()
if (!urls.length) {
  console.error('清单为空，无可探测链接')
  process.exit(2)
}

const results = new Array(urls.length)
let cursor = 0
await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
  while (cursor < urls.length) {
    const index = cursor++
    results[index] = await probe(urls[index])
  }
}))

const latencies = results.map((result) => result.ms).sort((a, b) => a - b)
const percentile = (p) => latencies.length ? latencies[Math.ceil(latencies.length * p) - 1] : null
const count = (predicate) => results.filter(predicate).length
const byDomain = {}
for (const result of results) {
  let host = 'invalid'
  try { host = new URL(result.url).hostname } catch { /* 保留 invalid */ }
  const entry = byDomain[host] ??= { total: 0, ok: 0, partial: 0, blocked: 0, unreachable: 0, error: 0 }
  entry.total++
  const bucket = ['error', 'invalid'].includes(result.verdict) ? 'error' : result.verdict
  if (entry[bucket] !== undefined) entry[bucket]++
}

const report = {
  meta: { generatedAt: new Date().toISOString(), total: urls.length, concurrency, timeoutMs, userAgent },
  summary: {
    total: results.length,
    ok: count((result) => result.verdict === 'ok'),
    partial: count((result) => result.verdict === 'partial'),
    blocked: count((result) => result.verdict === 'blocked'),
    unreachable: count((result) => result.verdict === 'unreachable'),
    error: count((result) => ['error', 'invalid'].includes(result.verdict)),
    parseable: count((result) => result.parse?.parseable),
    latencyMs: { p50: percentile(0.5), p95: percentile(0.95) },
    byDomain,
  },
  results,
}

const json = JSON.stringify(report, null, 2)
if (out) {
  await writeFile(out, json + '\n', 'utf8')
  console.error(`报告已写入 ${out}`)
}
console.log(json)
