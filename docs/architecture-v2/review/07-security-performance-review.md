# 07 技术、安全与性能审核

## 当前基线与技术取舍

| 领域 | 审核结论 |
| --- | --- |
| Next.js Runtime | 【代码】消费者助手、知识助手和图像路由指定 `nodejs`。项目依赖 Node 文件、加密、PDF 和子进程。保留 Node 作为执行基线。Next.js Edge 的 API 范围更窄，评估边缘部署前先确认依赖和首屏收益。[消费者路由](../../../app/api/consumer/assistant/route.ts#L1)　[Next.js Runtime](https://nextjs.org/docs/app/api-reference/edge) |
| Supabase Auth 与 SSR | 【代码】Middleware 刷新 Cookie，Route Handler 再鉴权，`requireUser` 对大部分私有路由有统一入口。V2 区分缺会话、无权限和 Auth 故障，复核可用 JWT 验证方式与撤销要求。Next.js 16 文档将 Middleware 约定迁往 Proxy，迁移应按锁定版本验证。[SSR 中间件](../../../middleware.ts#L84)　[服务端鉴权](../../../lib/api/auth.ts#L28)　[Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)　[Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) |
| Postgres、RLS、Data API | 【代码】用户消息、记忆与目录领域已有 RLS。需要同时核对表与列授予、视图所有者、RPC 执行权和公开 schema。Supabase 的默认暴露行为已变更。现有显式授予仍需单独审计。[RLS 迁移](../../../supabase/migrations/20261024082331_eva_conversation_memory.sql#L35)　[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)　[Data API 变更](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) |
| PostgreSQL 与 pgvector | 【代码】消费者为 512 维 BGE 和 HNSW，独立于商家组织语义索引。匹配 RPC 限制 service role，匹配后与公开投影连接。【假设】小规模用关键词加精确或 ANN 对照，测带价格和权限过滤的召回及 SQL 计划。迭代扫描依赖扩展版本。先证明 Postgres 的瓶颈再考虑独立向量库。[BGE 迁移](../../../supabase/migrations/20261108140638_consumer_bge_vector_retrieval.sql#L191)　[pgvector 过滤](https://github.com/pgvector/pgvector#filtering) |
| 模型调用与 Mastra | 【代码】文本适配器已有 per-provider 超时和针对部分状态的退避重试，总预算以单次逻辑模型调用计算。消费者最终 JSON 返回，图片路径可接连调用多个模型，图像工作台还有独立 SDK 逻辑。【假设】请求和任务预算贯穿所有调用，限制模型步数及输出，明确错误分类和降级。[重试](../../../lib/ai/workspace-generation.ts#L70)　[多模态路径](../../../app/api/consumer/assistant/route.ts#L411)　[编排审查](05-mastra-review.md) |
| 队列与异步 | 【代码】索引任务有锁和领取函数，图片和商家知识调用主要同步。【假设】用已有 Postgres 能力验证短期任务与幂等，持久 Workflow 或队列需单独决定。指标包括积压、恢复、独立资源与运维成本。[索引领取](../../../supabase/migrations/20261108140638_consumer_bge_vector_retrieval.sql#L166)　[Supabase Queues](https://supabase.com/docs/guides/queues) |
| 图片、文件和注入 | 【代码】消费者发送内联编码图片或文本/PDF。PDF 文本有限页数，商家上传另有扫描隔离。头像与创作者视频使用公开对象路径。【假设】私有附件、草稿和公开资产各自授权。进入解析器前限制字节、页数和像素，处理后按策略清理。资料与工具结果按证据隔离，模型只可提出结构化建议。工具调用另查主体、允许域和参数。[附件](../../../app/api/consumer/assistant/route.ts#L83)　[PDF 提取](../../../lib/consumer-advisor/pdf-text.ts#L5)　[Storage 访问](https://supabase.com/docs/guides/storage/security/access-control)　[OWASP 注入](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) |
| 请求一致性与客户端状态 | 【代码】历史按用户查询，聊天由客户端生成请求 ID 和会话 ID。浏览器有未按账号隔离的收藏、拒绝、归档等键。【假设】以服务端已认证主体、会话修订与事件序号为准。迟到响应需校验会话、运行和账号代际，SSR 与登录切换时清理不匹配状态。[聊天状态](../../../components/consumer-market/context/OmnilinkContext.tsx#L242)　[浏览器键](../../../components/consumer-market/services/dataService.ts#L21) |
| 可观测与自动化 | 【代码】有 Vitest，包含目录排序、记忆、规则、模型调用等测试，商家助手有执行记录。源码审查未证实生产链路有全程 trace、用量计量或跨账号验收。【假设】用最小元数据串联请求、查库、模型、工具与结果。建立拒绝、重放、恢复和成本验收。[测试入口](../../../package.json#L5)　[模型测试](../../../lib/ai/workspace-generation.test.ts)　[商家记录](../../../app/api/knowledge/assistant/route.ts#L206) |

【代码】`discovery_products` 是 `security_barrier` 的公开白名单视图。其他迁移对另一个公开店铺视图使用 `security_invoker`。两个属性含义不同。现有发现视图依赖显式公开谓词与投影列，改为 invoker 前需验证底层表的授予和 RLS。审查每个 definer 函数的调用权限、`search_path` 与主体校验，限制特权端点入口。[发现视图](../../../supabase/migrations/20261025132000_discover_product_types.sql#L3)　[另一公开视图迁移](../../../supabase/migrations/20261007093356_use_invoker_for_public_storefront_view.sql)　[PostgreSQL CREATE VIEW](https://www.postgresql.org/docs/17/sql-createview.html)　[PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html)

### 【假设】缓存与 Token 策略

| 缓存范围 | 取舍与失效 |
| --- | --- |
| 单次请求 | 复用鉴权结果、短会话提示和读取句柄。随请求结束丢弃 |
| 公开发布投影 | 经验证可缓存公共结果。键包含查询、语言、币种、类型和发布版本。下架需及时回查或失效。下一页不得混用版本 |
| 私有资料、会话、签名 URL | 首期按私有 no-store 处理。跨请求缓存若确有收益，包含已验证的用户、组织、范围与修订。更新和撤回按版本失效，禁止共享 CDN 缓存带用户 Cookie 或 Set-Cookie 的响应 |
| 模型前缀 | 公共规则、模板及 schema 稳定排列。按模型与账户验证缓存开关、前缀长度和地域。用户和任务特定数据按授权最小化。前缀缓存指标和数据库缓存分开 |

路由响应缓存与模型前缀缓存分别配置和测量。Next.js Route Handler 的响应默认不缓存，启用公共缓存前复核实际部署的路由与 CDN 规则。[Next.js 路由缓存](https://nextjs.org/docs/app/getting-started/route-handlers#caching)

Gemini 文档说明了受支持接口、模型、最小长度以及隐式和显式缓存区别。Qwen 的兼容模型与地域需对照 Model Studio。DeepSeek 文档提供前缀命中与未命中 token 计数。仓库当前模型封装没有显式配置缓存，也未记录这些 usage 字段。基线应对照不必要的调用消除、上下文裁剪、供应商缓存三者对费用和延迟的影响。短分类请求可能达不到对应的缓存条件。[模型封装](../../../lib/ai/workspace-generation.ts#L141)　[Gemini Context caching](https://ai.google.dev/gemini-api/docs/caching)　[Qwen Context Cache](https://help.aliyun.com/en/model-studio/context-cache)　[DeepSeek Context Caching](https://api-docs.deepseek.com/guides/kv_cache/)

Postgres 为数据权威。第一阶段按请求复用和公开版本缓存验证收益。Redis 只有在跨实例缓存、全局限流或锁争用成为可测瓶颈时才纳入比较。全局准入可先用平台限制或可审计的原子计数。微服务、专用消息队列和外置向量库都应以隔离、吞吐、延迟或故障恢复数据为引入依据。

## 【问题】发现

### SEC-01 P0 公开帖子行与私有草稿共表

- **问题与依据** 迁移对 `anon` 授予 `creator_posts` 表级 SELECT，对登录用户也授予表级 SELECT。公开 RLS 按 `status='published'` 允许整行读取。后续迁移把 `draft_version` 加到同一表，PATCH 编辑已发布内容时把新草稿写入此字段且保留已发布状态。当前应用页面只选公开列，但直接 Data API 仍取决于数据库授予和 RLS。按仓库迁移推导，已发布行的未发布草稿可被相应读取者读取。生产是否应用这些迁移及实际可达性未核验。[公开授予](../../../supabase/migrations/20261022015120_creator_content_posts.sql#L20)　[新增草稿列](../../../supabase/migrations/20261022052325_creator_content_blocks.sql#L1)　[编辑写入](../../../app/api/creator-posts/route.ts#L87)　[PostgreSQL GRANT](https://www.postgresql.org/docs/17/sql-grant.html)
- **实际影响** 商家尚未公开的标题、内容块与素材 URL 可能暴露给匿名和其他账号。若进入搜索索引或缓存，撤回范围进一步扩大。视频上传返回公开桶 URL，草稿素材需一并核对访问策略。[视频桶](../../../supabase/migrations/20261022074619_creator_content_videos.sql#L1)　[上传地址](../../../app/api/creator-posts/media/route.ts#L28)
- **推荐修正** 将草稿存于受组织权限保护的版本表与私有素材区，公开 API 只读已发布的显式列投影。对 `anon` 和非成员登录账号验证直读、视图、RPC、对象 URL 及撤回行为。
- **替代与取舍** 可撤销表级 SELECT，再给公开视图或明确列授权。过渡改动小，但必须覆盖两个角色、已有 API 和后续新增列。拆分草稿与发布版本更易维护，需迁移历史数据。
- **阻塞范围** 阻塞公开内容功能的生产放行、扩展公开索引和外部来源接入。确认生产已有暴露时按实际环境和权限流程处置。

### SEC-02 P1 模型准入与限流作用域不足

- **问题与依据** 消费者助手尝试 `getUser` 后对无用户继续执行。生产无用户只关闭开发演示上下文，千问或 Gemini 仍可使用平台 Key。速率表为进程内 Map，来源取代理 IP 头，是否可信取决于部署入口。当前无区分匿名、验证失败和服务异常的明确准入决策。[速率控制](../../../app/api/consumer/assistant/route.ts#L69)　[身份处理](../../../app/api/consumer/assistant/route.ts#L153)　[平台 Key](../../../lib/ai/workspace-generation.ts#L193)
- **实际影响** 多实例下额度分散，可产生意外模型和索引成本。失效会话或 Auth 暂时故障可能降格为平台付费的匿名请求。
- **推荐修正** 单独定义访客公开浏览和付费模型准入，先验证可信身份和入口，再按用户、租户、任务类型、并发和费用限额接纳。带凭据但鉴权服务异常的写入失败关闭。显式区分 401、403、429 和依赖故障。
- **替代与取舍** 模型全登录更易防滥用，但提高首次体验门槛。匿名试用需要可信访客令牌、严格额度与监控。单实例 Map 可作为附加本地防护。
- **阻塞范围** 阻塞面向匿名的生产模型调用与付费工具开放。

### SEC-03 P1 同一会话重试与并发会重复执行

- **问题与依据** 用户消息按 `user_id,id` 忽略重复插入，路由随后仍执行检索、模型和新的助手消息插入。读取倒序最近记录后原地 `reverse()`，再 `find()` 可能选择窗口内较旧助手回合。历史删除只删消息行，未见取消在途请求或会话墓碑。[请求和历史](../../../app/api/consumer/assistant/route.ts#L174)　[助手结果](../../../app/api/consumer/assistant/route.ts#L459)　[历史删除](../../../app/api/consumer/ai-assistant-history/route.ts#L17)
- **实际影响** 重发可能重复计费和落盘。并行消息、旧指代或删除后迟到结果可能拼到错误上下文。
- **推荐修正** 事务登记 `principal + conversationId + requestId`、请求摘要和状态。相同摘要重放，摘要不同则冲突。为会话分配稳定序号，读取明确的上一回合引用，写入以运行版本 CAS。删除和取消使旧运行无权提交。
- **替代与取舍** 客户端禁用发送能减少连点，无法覆盖超时重试和多设备。串行锁整次模型调用会长时间占用事务，宜用短事务与执行租约。
- **阻塞范围** 阻塞可重试对话、复合任务、记忆确认与取消。

### SEC-04 P1 账号隔离跨 SSR、浏览器与数据接口

- **问题与依据** 服务器消息和记忆查询有用户过滤和 RLS，仓库未证实跨用户服务端读取。浏览器用同源全局键载入收藏、拒绝和归档，登录状态由展示名和预览标志推导。聊天把收藏和排除列表发给服务端。多个账号共享浏览器时可继承上一账号的浏览信号。未来工具若沿用 `service_role` 扩大读取，也会绕过底层 RLS。[客户端标志](../../../components/consumer-market/App.tsx#L200)　[本地键](../../../components/consumer-market/services/dataService.ts#L21)　[聊天参数](../../../components/consumer-market/context/OmnilinkContext.tsx#L599)　[特权客户端](../../../lib/supabase/service-role.ts#L20)
- **实际影响** 浏览器换号后个人化结果可混用。将授权责任放给提示词、客户端 ID 或公共缓存会扩大跨用户数据泄露风险。
- **推荐修正** SSR 输出经认证的最小主体状态，按用户和匿名会话划分客户端缓存，登录或退出时切换命名空间与取消在途请求。服务端核验每个实体、文件和存储路径。普通任务使用用户范围客户端，后台特权账户只访问必要投影与 RPC。按两个用户和两个组织覆盖拒绝测试。
- **替代与取舍** 清除所有本地数据简单但丢失独立的访客和账号体验。分区缓存配合清理事件能兼顾切换和恢复，需要明确迁移策略。
- **阻塞范围** 阻塞私有个性化跨设备、账号切换和工具接入私有数据。

### SEC-05 P1 BYOK 加密与权限密钥复用

- **问题与依据** DeepSeek BYOK Cookie 采用 AES-GCM、用户 ID AAD、HttpOnly、生产 Secure、SameSite Strict。加密密钥从 Supabase service-role secret 派生。Cookie 由浏览器过期，密文格式未携带独立的有效期或轮换 key ID。[密钥封装](../../../lib/consumer-advisor/deepseek-key-cookie.ts#L8)　[Cookie 设置](../../../app/api/consumer/deepseek-key/route.ts#L36)
- **实际影响** 数据库密钥轮换会连带使 BYOK 失效，密钥职责与影响范围相互耦合。异步任务若保存浏览器凭据会扩大保留范围。
- **推荐修正** 使用独立可轮换加密密钥，显式凭据生命周期与撤销策略。避免把令牌、密文和个人上下文写到任务日志或缓存。worker 使用受限凭据引用和对应授权，尚无安全交接时 BYOK 只用于同步调用。
- **替代与取舍** 继续使用浏览器会话凭据可避免云端持久保管，缺少跨进程恢复能力。服务端凭据库支持异步和多设备，需确定删除、轮换和访问审计。
- **阻塞范围** 阻塞 BYOK 持久化或长任务委派。现有同步场景先完成独立轮换设计。

### SEC-06 P2 可观测性与生产验收缺少闭环

- **问题与依据** 模型调用记录有状态或日志，缺少统一的用量、缓存计量、首屏分解和可恢复任务证据。若仅看总响应时间，难定位鉴权、索引、模型与查询的各自耗时。现有 Vitest 文件证明有单测资产，不能证明已通过端到端或生产隔离验证。[模型请求封装](../../../lib/ai/workspace-generation.ts#L114)　[商家记录](../../../app/api/knowledge/assistant/route.ts#L206)　[测试入口](../../../package.json#L5)
- **实际影响** 模型切换、缓存启用或增大候选数可能提高成本却不改善首屏。权限和重试缺陷不易提前发现。
- **推荐修正** 记录请求、会话与运行 ID、步骤耗时、错误码、候选量、token、费用、降级和缓存指标，采样且脱敏。发布前以隔离角色、重试和取消、慢依赖、无供给、缓存撤销、设备切换等样例做验收。敏感业务文本不进入默认遥测。
- **替代与取舍** 基础结构化日志和 SQL 计数适合首期。专用追踪平台适合多 worker 或跨进程链路，须控制成本和保留期。
- **阻塞范围** 阻塞性能与费用的生产承诺和规模化放量。
