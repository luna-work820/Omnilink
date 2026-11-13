# 01 模块职责与架构边界

【要求】原图把单一聊天入口、意图识别与并行取上下文、执行分流、结果回到交互视图、确认后写记忆列为核心流程。以下把七层理解为职责。各模块是否参与某一轮，由任务的读取和执行权限决定。

| 原图职责 | 【代码】现状 | 【假设】模块接口与部署 |
| --- | --- | --- |
| Frontend / Unified Chat | 发现页使用 `FeedChatDock`，通过上下文发送聊天。侧栏还会在已加载的商品、技能、会话中本地匹配。购物评测有 query 参数打开的专门视图。[聊天请求](../../../components/consumer-market/context/OmnilinkContext.tsx#L592)　[侧栏搜索](../../../components/consumer-market/components/HomeNavigationDrawer.tsx#L85)　[评测入口](../../../app/discover/page.tsx#L138) | 一个固定输入框与关联操作发出同一种会话事件。瀑布流、问卷、任务和个人空间是结果视图。客户端传实体 ID 和版本提示，由服务端解析。随 Next.js 部署。 |
| AI Gateway | 消费者 Route Handler 串起校验、认证、记忆、历史、规则分流、检索、模型与写入。另有 Middleware 刷新会话。[聊天路由](../../../app/api/consumer/assistant/route.ts#L135)　[会话中间件](../../../middleware.ts#L84) | 同进程模块。入口验证、接纳预算、幂等、短会话提示、语义分类、权限决策、结果事件。Context Resolver 是按需解析和复用读取的内部步骤。 |
| Personal Context Engine | Auth 元数据、记忆表、问卷、对话及演示浏览器存储分散保存。[档案路由](../../../app/api/consumer/ai-assistant-profile/route.ts#L44)　[记忆读取](../../../lib/consumer-advisor/ai-assistant-memory.ts#L20) | 拥有个人档案、评测和提案。提供 `readSnapshot(scope)` 与明确的受控写命令。快照以用户、范围与修订版标识。对话历史由会话模块持有。 |
| Discovery Engine | SSR 预取目录，客户端收藏同类重排。聊天中有关键词、向量和近期候选，以及最多三件商品的结果。[SSR 发现页](../../../app/discover/page.tsx#L148)　[客户端重排](../../../lib/consumer-advisor/discovery-ranking.ts#L3)　[混合召回](../../../lib/consumer-advisor/consumer-entry-workflow.ts#L112) | `searchPage(query, scope, contextSnapshot, cursor)` 返回可验证分页、候选理由及澄清建议。排序、过滤和检索策略留在模块内部。直接调用和 Workflow 共享接口。 |
| Mastra Execution | 四个消费者 Workflow 运行规则、候选和校验。模型由直接 provider 适配器调用。[工作流入口](../../../lib/consumer-advisor/consumer-entry-workflow.ts#L83)　[模型调用](../../../app/api/consumer/assistant/route.ts#L411) | 有依赖、有恢复需求或多工具的任务才调用编排。已知流程用 Workflow，开放规划才选有限工具集的 Agent。短任务同进程，长任务 worker 待验证。 |
| Unified Information Model | 商品、变体、渠道、内容已有各自结构。发现投影仍以目录条目为中心。[目录结构](../../../supabase/migrations/20261003053000_catalog_asset_semantic_channels_orders.sql#L7)　[内容结构](../../../supabase/migrations/20261022015120_creator_content_posts.sql#L1) | 类型专属写模型、共享实体引用与版本化读投影。模型与约束由各域模块执行，作为共享契约使用。 |
| Data Infrastructure | Supabase Auth、Postgres、带公开条件的视图、pgvector 索引、媒体和知识隔离存储已有代码或迁移。[公开视图](../../../supabase/migrations/20261025132000_discover_product_types.sql#L3)　[向量迁移](../../../supabase/migrations/20261108140638_consumer_bge_vector_retrieval.sql#L4)　[知识上传](../../../app/api/knowledge/uploads/route.ts#L64) | 继续使用同一 Postgres 与对象存储。Auth、DB、模型属于实际外部依赖。按服务等级、资源隔离和恢复需求决定是否追加 worker 或缓存。 |

## 依赖与单点

【假设】调用方向为 UI 事件 → Gateway → 相应模块。Gateway 根据请求向会话读取指代线索，按授权向 Personal Context 读取快照。Discovery 接受快照并读发布投影。Mastra 通过已授权的工具调用 Discovery 或其他领域模块，工具不会回调 Gateway 或启动任意 Agent。Memory Manager 在明确确认动作之后写入。原图的“渲染”由前端使用结构化结果完成，工具可返回呈现所需的类型化数据。

【代码】审查到的主路径是消费者路由导入 Workflow，Workflow 直接调用 `lib/storefront/service.ts` 和向量模块。客户端排序模块依赖界面类型。上述路径未见 Discovery 回调 Mastra 的运行时循环。原图的双向箭头如落实成代码，将让澄清、检索和 Agent 调用出现双重所有权。[Workflow 导入](../../../lib/consumer-advisor/consumer-entry-workflow.ts#L3)　[客户端排序类型](../../../lib/consumer-advisor/discovery-ranking.ts#L1)

【假设】公开浏览的主要单点是目录数据库和 Next.js 入口。分类模型故障可走有限规则降级，私有数据不可读时可提供公共结果。Auth 故障时带身份的读写应失败关闭。索引处理、图片生成和文档解码需要资源上限，避免争用在线实例。跨进程拆分只有在测得并发占用、持续性或权限需要时才获得独立部署价值。

## 【问题】发现

### ARCH-01 P1 串行分层与双向执行依赖

- **问题与依据** 原图的纵向连线容易将 Personal Context 实现为必经步骤，Discovery 与 Mastra 的双向连线给二者都留下任务编排入口。现有路由已在分流前加载记忆，并在多个 Workflow 之间组装业务上下文。[当前顺序](../../../app/api/consumer/assistant/route.ts#L153)
- **实际影响** 普通问答和商品发现承担不必要的数据库等待。双向编排难以限制执行次数，也会将商品领域模型渗入内容、服务等新域。
- **推荐修正** 冻结 Gateway 的任务决策权。Discovery 暴露分页和结构化取证接口，Personal Context 仅通过快照和写命令开放。把需要多步执行的流程放到 Mastra 内，维持依赖单向。
- **替代与取舍** 可以先把调用集中在一个 route，修改量小但继续扩大 route 接口。也可拆成远程服务，能够隔离资源但会提前增加网络、部署和分布式一致性成本。
- **阻塞范围** 阻塞 V2 契约冻结。当前页面和领域表可作为迁移来源。

### ARCH-02 P1 产品入口与技能入口职责重叠

- **问题与依据** 默认聊天已经加载用户档案。选择 `personal-advisor` 又拼接提示词并传 `hasActiveSkill`。侧栏能独立匹配商品，评测走页面和资料 PATCH。客户端传出的引用是文本和商品 ID 组合，尚无统一的类型和版本契约。[技能选中和提交](../../../components/consumer-market/components/FeedChatDock.tsx#L150)　[默认上下文](../../../app/api/consumer/assistant/route.ts#L380)　[侧栏匹配](../../../components/consumer-market/components/HomeNavigationDrawer.tsx#L85)
- **实际影响** 同一句问题因技能标签变为推荐。继续增加搜索入口、评测入口或个人资料工具时，历史、撤回和权限各自分叉。
- **推荐修正** AI assistant 作为唯一聊天角色。评测是系统能力，个人资料修改是明确的会话操作。商品发现或比较等快捷按钮发出结构化事件。侧栏仅保留会话与导航检索语义，商品智能搜索复用主入口的契约。
- **替代与取舍** 可以保留多个技术端点作为同一模块接口的传输适配器，适合签名上传和任务查询。平行的用户搜索入口会形成另一套会话和路由，违反本轮约束。
- **阻塞范围** 阻塞新消费者入口和能力菜单。已发布商家工作台可继续作为商家域接口，产品约束针对消费者智能交互。
