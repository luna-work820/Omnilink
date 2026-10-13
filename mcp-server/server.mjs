/**
 * server.mjs —— Omnilink MCP server（stdio）。
 *
 * 把 canonical 商品语义暴露给任意支持 MCP 的 agent（Claude Desktop / ChatGPT / Cursor 等）。
 * 设计取向：只做"被调用"，不做"替人决定"——
 * 不提供下单、改价、改库存等写操作。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { searchProducts, getProduct, compareProducts, logCall } from './data.mjs'

const server = new McpServer({
  name: 'omnilink-canonical-catalog',
  version: '0.1.0',
})

function ok(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }
}

function fail(tool, args, err) {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify({ tool, args, error: err?.message ?? String(err) }, null, 2),
      },
    ],
  }
}

server.registerTool(
  'search_products',
  {
    title: '检索商品',
    description:
      '按关键词检索 Omnilink 上的商品。返回结构化属性与 provenance（数据主体、canonical 来源、许可与署名要求）。适合"我想找…"类查询。',
    inputSchema: {
      query: z.string().describe('自然语言或关键词，例如"包豪斯台灯""醋酸纤维"'),
      storeSlug: z.string().optional().describe('限定某个店铺 slug，不填则跨店检索'),
      limit: z.number().int().min(1).max(20).optional().describe('返回条数，默认 8'),
    },
  },
  async (args) => {
    const startedAt = Date.now()
    try {
      const result = await searchProducts(args)
      logCall({ tool: 'search_products', args, result_count: result.count, ms: Date.now() - startedAt })
      return ok(result)
    } catch (err) {
      logCall({ tool: 'search_products', args, error: String(err?.message ?? err) })
      return fail('search_products', args, err)
    }
  }
)

server.registerTool(
  'get_product',
  {
    title: '取单个商品的完整语义',
    description:
      '按 product_id 取回该商品的 canonical 语义属性与 provenance。用于判断与引用，不用于下单。',
    inputSchema: {
      productId: z.string().describe('商品 UUID'),
    },
  },
  async (args) => {
    const startedAt = Date.now()
    try {
      const result = await getProduct(args)
      logCall({ tool: 'get_product', args, found: Boolean(result), ms: Date.now() - startedAt })
      if (!result) return ok({ error: 'not_found', productId: args.productId })
      return ok(result)
    } catch (err) {
      return fail('get_product', args, err)
    }
  }
)

server.registerTool(
  'compare_products',
  {
    title: '对比多个商品',
    description:
      '对 2-4 个商品做字段级对齐对比，输出共同字段、取值与差异字段。只对齐与呈现，不替人做选择。',
    inputSchema: {
      productIds: z.array(z.string()).min(2).max(4).describe('待对比的商品 UUID 列表'),
    },
  },
  async (args) => {
    const startedAt = Date.now()
    try {
      const result = await compareProducts(args)
      logCall({ tool: 'compare_products', args, ms: Date.now() - startedAt })
      return ok(result)
    } catch (err) {
      return fail('compare_products', args, err)
    }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('[omnilink-mcp] ready (stdio)')
