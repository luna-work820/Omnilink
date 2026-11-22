# 搜索流程优化与实际框架

交付日期：2026-11-15。实现与主要验收完成于 2026-11-14，恢复后完成流式计量对象的静态检查修正与复验。代码基线为 HEAD 31aab82 加工作区已有 P1/P2/P3 和本次未提交改动。

源码已接入，本地验证通过；真实数据库与云端模型链路尚未放行。未应用远程迁移、调用收费模型 API、修改依赖、环境文件或部署。原有商品文件和 next-env.d.ts 未被本次工作改变。

## 实际搜索框架

以下为代码调用关系。向量节点已接线，仍受数据库结构与索引就绪条件限制。网址附件直接创建任务，不先进入商品目录或向量索引。

~~~mermaid
flowchart TD
    A["同一搜索框<br/>文字、图片、文件、网址"] --> N["请求校验<br/>搜索范围、会话、请求标识"]
    N --> R{"规则能确定任务？"}
    N -->|网址附件：保留用户目标| U["网页与商品比较任务<br/>Mastra 检查点、重试与归属校验"]
    R -->|是：跳过解析模型| D["直接决策"]
    R -->|否| P["单次意图解析<br/>默认 qwen-plus，可按任务配置"]
    D --> T{"任务类型"}
    P --> T
    T -->|商品或服务| S["创建或修改单一 Search Spec<br/>续搜读取同用户同会话的搜索记录"]
    T -->|商品比较或网址| U
    T -->|资料搜索| I["只检索本会话拥有的网页资料"]
    T -->|问答、图片或文件| C["按需上下文与预算<br/>回答模型、现有视觉或文件路径"]
    S --> E["共同资格判断<br/>类别、排除项、价格、币种、配送证据"]
    L["同一真实商品目录<br/>现有五店 35 件商品"] --> E
    S -.-> M["按需读取领域偏好<br/>仅影响软排序"]
    E --> W["检索切换<br/>关键词、语义、混合"]
    W -->|关键词或混合| K["目录关键词检索<br/>当前在内存执行"]
    W -->|语义或混合| V["版本匹配的向量检索<br/>BGE 512 或 Qwen 1024<br/>真实向量 RPC 待验收"]
    V -->|不可用：明确降级| K
    K --> F["选择结果或 RRF 融合<br/>资格复核、去重、相关性相近时分散商家"]
    V --> F
    M -.-> F
    F --> X["搜索快照与签名游标<br/>续页零模型调用<br/>所需数据库迁移尚未应用"]
    X --> O["统一 ResponseBlock 展示<br/>商品卡片、资料、对比、回答"]
    I --> O
    U --> O
    C -->|对话可使用 SSE| O
~~~

规则只处理明确且有界的操作。普通问答不会因选择了商品或信息范围就被强制改成搜索。自动检索模式在关键词无命中但仍有合格商品时使用语义检索；有关键词结果且存在 sessionTerms 时使用混合检索；其他情况使用关键词。改变回答模型不会自动切换解析器、Embedding 或索引。

## 本次落地

| 项目 | 状态 | 实际行为与主要文件 |
|---|---|---|
| 搜索范围 | 【已实现且接线】 | 输入框根据本轮需求自动选择商品、服务或信息检索；信息只检索本会话已导入的资料 |
| 同任务续搜 | 【已实现且接线】 | search-continuation 的无默认值补丁保留未修改的预算、币种、排除项、配送条件；assistant 读取 ownedDiscoveryRun 后再应用修改，检查会话、所有者、过期与版本 |
| 明确条件修改 | 【已实现且接线】 | 改色、改预算、取消预算等有界规则和结构化 refine 跳过解析与回答，保留请求的检索方式及 Profile；自动模式按更新后的条件选择检索方式，executionPolicy 标识 deterministic-edit |
| 自然语言长尾续搜 | 【需要运行验证】 | 单次解析器可返回 refine 与 searchPatch；服务端仍从拥有的旧 Spec 合并，不接受模型修改执行 Profile。真实模型是否稳定识别续搜未调用 API 验证 |
| 链接目标 | 【已实现且接线】 | goal 与 requestedFields 进入任务输入，在创建、检查点、完成和重新读取时保留；比较价格、材质、尺寸、颜色、来源、摘要。任意其他目标仍明确保留未知，不假装完成通用语义分析 |
| 任务模型配置 | 【已实现且接线】 | model-policy 将 parser 与 answer 分离；默认解析 qwen-plus，可读取 CONSUMER_PARSER_MODEL 指定已支持的解析 Provider。本次没有新增或修改环境变量，也不自动跨区域换 Provider |
| v2 向量文本 | 【已实现但运行受阻】 | 保留 v1 原文和 Profile；新增 product-facts-bilingual-v2，使用已知属性白名单，排除核验、政策和未知内容，补充有事实依据的双语概念。需要迁移和独立构建新 Profile |
| 商家分散 | 【已实现且接线】 | search-spec 与 discovery-retrieval 在相近相关性的小窗口内分散商家，不扩大合格域；结果在保存搜索快照前固定，分页不重排 |
| 上下文预算 | 【部分实现】 | 按领域、数量和分区字节预算裁剪完整记录，报告省略数量。UTF-8 字节额度是保守容量控制，不冒充 Provider 的精确 Token 数；未新增分词器依赖 |
| 计量 | 【部分实现】 | 网关记录实际 fetch 尝试、解析/回答/视觉耗时与返回 Usage；聚合生成 Token，另列 Embedding 输入 Token。无返回 Usage 则为 null，费用未定价则为 null。幂等重放新调用为零，保留原计量 |
| 三种检索对照 | 【已实现且接线】 | consumer-search-benchmark 可运行真实本地 BGE、共享资格和排序；数据库向量 RPC 用内存精确 cosine 替代，因此不能代表部署端到端质量或延迟 |

约束补丁不使用完整 Spec 的默认值，避免未指定字段自动变回 CNY 或空排除项。非空 excludedTerms 添加排除项，空数组显式清空；addTermGroups 添加要求，termGroups 用于显式替换完整组。价格冲突会拒绝，不自动删除原有下限。

## 模型和索引分工

| 用途 | 当前选择 | 调用条件 |
|---|---|---|
| 意图解析与自然语言 Search Spec | 默认 qwen-plus，任务配置可选 deepseek-flash 或 gemini | 仅规则未命中时，一次解析；配置缺失不偷偷借用其他模型 |
| 普通问答与文本回答 | 搜索框已有的回答模型选项 | 与解析器独立；需要资料时按当前任务读取 |
| 图片和 PDF | 原有视觉/文件路径 | 本次未新增图片 Embedding、即梦或通用图片商品检索；文本模型选图仍可能依赖现有视觉 Provider |
| 本地文本 Embedding | BAAI/bge-small-zh-v1.5-onnx-quantized，512 维 | 选择语义或混合且对应索引就绪；本机 Python/ONNX/模型文件已用于离线测试 |
| 云端文本 Embedding | text-embedding-v4，1024 维 | 所选 Qwen Profile、API 配置与索引一致；本次未调用收费服务 |
| 关键词、事实比较、续页 | 不需要生成模型 | 商品检索当前直接读同一文件目录；资料检索复用拥有者限定的数据库 RPC |

四个 Profile 为 BGE v1/v2 与 Qwen v1/v2。默认继续使用 bge-small-zh-v1.5-512-v1。v2 是可选实验，不自动提升为默认；不得混用不同模型或预处理版本的查询与商品向量。

~~~mermaid
flowchart LR
    C["统一真实目录"] --> D["选择 v1 或 v2 商品预处理"]
    D --> B["显式运行索引 CLI<br/>对应 BGE 或 Qwen 文档 Embedding"]
    B --> V["派生向量和 Profile 元数据<br/>模型、维度、版本、内容哈希、租约"]
    Q["语义查询"] --> R["先检查 Profile、状态与商品覆盖"]
    V --> R
    R -->|匹配| E["同一 Profile 生成查询向量"]
    E --> P["向量 RPC + 合格商品集合"]
    R -->|缺失、过期或不匹配| K["关键词降级"]
~~~

索引构建只由显式 CLI 触发，未增加自动调度器。商品向量离线预计算不取消新语义查询所需的 Embedding。本次没有模型训练或微调。

## 验收与边界

全量回归在最后一次功能修改后为 49 文件、351 项通过。恢复后只调整流式计量对象的 const 初始化，相关对话、流式与入口 29 项复验通过。TypeScript 通过；本次 32 个检查文件的 ESLint 为 0 错误、19 条既有警告。

真实应用 DOM 加隔离 HTTP 的浏览器场景为 29 项通过，Runtime exception 为 0；1280、390、320 像素无水平溢出；检索控件高度 44 像素；Escape 关闭并归还焦点；明暗主题文字对比度约 16.20:1、15.52:1。原有图片 35/35 加载。后端与模型请求使用测试替身，不能据此宣布真实服务验收通过。

浏览器记录新增覆盖：同会话旧搜索引用进入请求、信息与服务范围跟随新消息、网址输入保留“比较材质和尺寸”、v2 Profile 可选择。后端测试另行验证归属校验、补丁合并、零模型的明确修改和真实 Mastra 检查点恢复。

离线对照使用 12 对中英文查询、两个 BGE Profile、三种模式，共 144 行结果；全部使用现有 35 件商品，无新增虚构商品。development 是前次 6 对查询，holdout 是本次新增 6 对查询的脚本分组，不代表严格统计独立留出集。

| 模式 | 原 6 对中文目标进前三 | 原 6 对英文目标进前三 | 新增 6 对中文目标进前三 | 新增 6 对英文目标进前三 |
|---|---:|---:|---:|---:|
| 关键词，同一目录与当前排序 | 5/6 | 5/6 | 3/6 | 3/6 |
| BGE v1 语义 | 6/6 | 5/6 | 6/6 | 3/6 |
| BGE v2 语义 | 6/6 | 6/6 | 6/6 | 4/6 |
| BGE v1 混合 | 5/6 | 5/6 | 4/6 | 3/6 |
| BGE v2 混合 | 5/6 | 5/6 | 5/6 | 3/6 |

144 行共同硬条件违规为 0。v2 改善部分英文查询，同时 recycled silver liquid texture hoop earrings 的目标由第 4 退到第 7，small hoop earrings with synthetic pearl 由第 6 退到第 7；未调整样例或隐藏退步。因此保留 v1 默认与 v2 选择，不能声称新版本全面更优或混合检索一定更好。

脚本保留目标排名、Recall@3、NDCG@3、耗时、调用次数、降级和违规项。标签只标出了指定目标，未穷举全部相关商品。每组六条的经验 P95 实际上是该组最大值，未区分操作系统冷暖缓存；本次语义约 104–131 ms、混合约 99–132 ms，仅包含本地 Embedding 与内存检索排序，不包含解析、鉴权、数据库、网络、持久化或浏览器，不能视为线上响应承诺。

2026-11-15 对开发项目 fpypixbxsfpzrihwgmfk 的只读检查：

| 项目 | 存在 |
|---|---|
| consumer_discovery_runs | 是 |
| execution 列 | 否 |
| consumer_embedding_profiles | 否 |
| consumer_catalog_vectors | 否 |
| read_consumer_discovery_execution RPC | 否 |
| match_consumer_catalog_vectors RPC | 否 |

仍需先审查并应用两份 P1/P2 迁移和新增 v2 Profile 迁移，然后验证真实关键词 start/page/resume/refine、索引构建、向量 RPC 和目标部署环境。收费云模型验收未执行，费用与真实端到端 P95 未验证。PGlite 中的向量类型与运算使用夹具替代，迁移权限和租约已测，但 HNSW 与实际 pgvector 性能未测。

待应用迁移：

1. supabase/migrations/20261114073613_consumer_unified_execution.sql
2. supabase/migrations/20261114073614_consumer_versioned_embeddings.sql
3. supabase/migrations/20261114140108_consumer_search_profiles_v2.sql

## 证据与复验

本目录中的 search-optimization-benchmark-2026-11-15.json 保留三种检索的 144 行结果；search-optimization-browser-2026-11-15.json 保留 29 项浏览器验收；search-optimization-evidence-2026-11-15.json 保留检查汇总与只读就绪结果。原始本地向量保留在 /tmp/omnilink-search-optimization/vectors.json，未写入数据库。

可在不调用云模型的情况下复验：

~~~sh
node scripts/consumer-search-benchmark.mjs --local-bge
node scripts/test-consumer-experience.mjs --check-images
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit --incremental false
~~~

v2 尚未自动启用；回退可在现有菜单选择 v1 或关键词，保留 v2 向量供检查。不整体重置工作区，以免覆盖此前 P1/P2/P3 和其他未提交改动。新增迁移不删除 v1 索引或数据。

## antislop 交付检查

沿用用户确认的边实施边应用方式，保持既有布局，ENERGY / RHYTHM / MOTION = 1 / 1 / 1。颜色、排版、间距与现有控件保持一致，新增 v2 选项只用于实际对照验证；未新增装饰、虚构商品或视觉资产。

- Hard Gate PASS：29 项真实 DOM 操作与键盘、主题、窄屏检查通过；所有新增选择均传递实际参数；图片来自原有真实目录。
- Purpose Gate PASS：范围选择进入当前请求；回答模型、解析器和索引各自负责本任务所需功能，没有第二聊天入口或第二商品主表。
- Liveliness PASS：保留原有商品图片、白色背景和既定强调状态，不作全站视觉重排。
- Craftsmanship PASS：空结果、等待、失败、重试、续页、停止、会话隔离、链接任务和检索选择均有对应记录；真实数据库和云模型边界单列，未把测试替身结果当作上线证据。
