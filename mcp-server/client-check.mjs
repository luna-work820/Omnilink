/**
 * client-check.mjs —— 不开任何 agent 客户端，也能验证 server 本身可跑。
 * 用官方 MCP client 通过 stdio 拉起 server.mjs，列出工具并试调一次。
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [join(ROOT, 'server.mjs')],
})

const client = new Client({ name: 'omnilink-selfcheck', version: '0.1.0' })
await client.connect(transport)

const tools = await client.listTools()
console.log('registered tools:')
for (const t of tools.tools) console.log(` - ${t.name}: ${t.title ?? ''}`)

const probe = await client.callTool({ name: 'search_products', arguments: { query: '', limit: 3 } })
const text = probe.content?.[0]?.text ?? ''
console.log('---')
console.log(probe.isError ? 'call failed (expected if no DB access):' : 'call ok:')
console.log(text.slice(0, 600))

await client.close()
