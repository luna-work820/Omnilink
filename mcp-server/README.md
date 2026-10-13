# Omnilink MCP server（一天版）

把 Omnilink 已有的 canonical 商品语义，变成任意 AI agent 可以直接调用的数据源。

这不是新项目，是给已有资产换一个 agent 时代的出口：
`catalog_items.details.attributes` 已经是 canonical 事实源，MCP 查询直接从 Catalog 读取并做安全拍平，
缺的只是"让 agent 能插上"的那一层。这个 server 就是那一层的最小可运行形态。

---

## 一、它做了什么

| 能力 | 说明 |
| :--- | :--- |
| `search_products` | 按关键词跨店检索，返回结构化属性 + provenance |
| `get_product` | 按 id 取完整 canonical 语义 + provenance |
| `compare_products` | 2-4 个商品的字段级对齐对比（含差异字段） |
| 调用账本 | 每次调用追加一行到 `logs/calls.jsonl` |
| provenance | 数据主体、canonical 来源、置信度、更新时间、许可与署名要求 |

### 每一条数据都带 provenance

```json
{
  "source_layer": "Omnilink canonical (Identity + Data + Semantic Graph)",
  "canonical_source": "catalog_items.details.attributes",
  "data_subject": "商家名",
  "semantic_confidence": null,
  "license": "agent-readable; attribution-required; no-training-without-consent",
  "attribution": "数据主体：商家名；经 Omnilink 结构化。调用须署名，商用与训练需另行授权。"
}
```

这是"数据属于主体"在工程上的第一次落地：**agent 拿到数据的同时，必须拿到这份数据是谁的。**

### 明确不做的（守住边界）

- 不提供下单、改价、改库存等写操作——AI 扩展人的选择，不替代人的意志
- 不做跨商家实体同一性判定——`compare_products` 只做字段级对齐，不判断两个 listing 是否同一件商品
- 不自造协议——走 MCP 标准，未来接 UCP / ACP 是配置问题，不是重写问题

---

## 二、五分钟跑起来

依赖直接复用项目根 `node_modules`（Node 会向上查找），**不需要再装一次**——
Omnilink 本身已经是 Next + Supabase 项目，`@modelcontextprotocol/sdk`、`@supabase/supabase-js`、`zod` 都在。

```bash
cd /Users/luna/Documents/Omnilink/mcp-server
npm run check      # 验证：server 能启动、工具已注册、调用链路通
npm run smoke      # 验证：连得上 Supabase、读得到 canonical、provenance 完整
```

`npm run check` 不依赖数据库，先跑它确认 server 本身没问题。
`npm run smoke` 会真实读库；若报 `fetch failed`，先排查网络与凭据，不要改代码。

凭据读取顺序：`../.env.local` → `./.env`。
优先使用 `SUPABASE_SERVICE_ROLE_KEY`（跨商家全量），退回 `NEXT_PUBLIC_SUPABASE_ANON_KEY`（受 RLS 作用域限制）。
若想让这个目录独立可移植，再执行 `npm install`。

---

## 三、接进 Claude Desktop（真实 agent 调用才算跑通）

`~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "omnilink": {
      "command": "node",
      "args": ["/Users/luna/Documents/Omnilink/mcp-server/server.mjs"]
    }
  }
}
```

重启 Claude Desktop，直接问：

> 帮我找一下包豪斯风格的台灯，并说明这些数据的来源是谁。

**这一句是今天唯一必须跑通的东西。** 你写在产品哲学里的原话——"帮我比较购物车里的两个台灯"——
如果它在真实 agent 里跑通，且 agent 能复述出数据归属，那么理念第一次变成了可运行的东西。

---

## 四、今天剩下的时间怎么排

| 时段 | 做什么 | 产出 |
| :--- | :--- | :--- |
| 0:00–0:30 | `npm run smoke` / `npm run check` 跑通 | 一个能被 agent 调用的数据源 |
| 0:30–1:30 | 接 Claude Desktop，跑通 3 个真实场景 | 检索 / 详情 / 对比各一条对话记录 |
| 1:30–3:30 | 20 条对照实验（见下） | 一张对照表 + 一个结论 |
| 3:30–5:00 | 写 `/.well-known/ucp` 静态文件 | 让 UCP 侧 agent 也能发现 |
| 5:00–6:00 | 把 20 条结果写成一页结论 | 继续 / 止损的判断依据 |

---

## 五、20 条对照实验（今天唯一真正要验证的假设）

假设：**agent 拿到带 provenance 的结构化 canonical 数据后，错误率显著低于读网页文本。**

做法：准备 20 条真实查询（例如"300 美元以内的包豪斯台灯""醋酸纤维镜框""可堆叠的户外椅"），
同一条查询跑两次：

- **A 组**：把商品页面文本贴给 agent，让它回答
- **B 组**：让 agent 通过 MCP 工具取数后回答

记录四列：事实错误数、编造字段数（幻觉）、能否说出数据来源、是否需要追问。

判定标准（建议，〔待校准〕）：

- B 组错误率不显著低于 A 组 → **"结构化数据降低 agent 幻觉"的假设不成立，止损**
- B 组显著更低但"能否说出数据来源"仍然失败 → provenance 设计有问题，先修这个
- 两项都通过 → 继续建底座

⚠️ 诚实提醒：这个实验只验证"数据能不能让 agent 更准"，**不验证**"有没有人愿意为被调用付费"。
后者是分润叙事的生死线，今天测不出来，需要真实商家对话。

---

## 六、今天跑通之后

- `logs/calls.jsonl` 的每一行，都是未来 C4 数字产权登记处与分润结算的原始凭证
- `compare_products` 的字段对齐逻辑，是跨商家实体同一性解析的种子（但还不是它）
- 明天要做宽的，是品类与商家数；不是功能数量
