# 00 Omnilink Architecture V2 审核摘要

**V2 可以作为长期架构方向，当前版本需修正后再实施。** 可复用现有 Next.js、Supabase/Postgres、公开目录、确定性问卷和 Mastra 工作流。先收敛请求、权限、记忆确认和公开数据投影的契约，再扩大检索、编排和跨类型供给。

## 审查基线

- 产品依据为本轮审核文字和随后附上的《Omnilink Architecture V2（当前确认版）》。图中的绿色标记确认产品方向或逻辑职责。右栏的实体模型范围、Redis、Mastra 深度、更多 Agent，以及缓存、队列、观测的选择仍待决。
- GitHub `Luna-7/Omnilink-Consumer-UI` 的 `main` 在核对时指向 `6c2da70aa9aa572b1bcf20aa9cc7bf5d438037a8`。本地审查基线为 `9213d78a77cd16253aa14261a21e872710bc6ced`。抽样对照聊天路由、发现页、Mastra 工作流、档案路由、BGE 和记忆重命名迁移共六个文件的 Git blob SHA，均相同。[GitHub 基线](https://github.com/Luna-7/Omnilink-Consumer-UI/commit/6c2da70aa9aa572b1bcf20aa9cc7bf5d438037a8)
- 锁文件解析为 Next.js 16.4.5、Mastra Core 1.82.0、Supabase SSR 0.12.4、Supabase JS 2.112.2。现有架构文档保留为历史设计证据。例如首次建档文档写的是任务表，当前档案路由实际保存 Auth 元数据，两者应分别引用。[锁文件](../../../package-lock.json#L1831)　[模块所有权](../../architecture/module-ownership.md)　[旧建档设计](../../architecture/personal-advisor-first-use-flow.md#L24)　[现有档案保存](../../../app/api/consumer/ai-assistant-profile/route.ts#L76)
- 旧数据库部署记录曾标明订单迁移暂缓。该记录与生成类型均不代表当前远端状态。制定 V2 迁移清单时，需要保留这项显式核对。[数据库部署记录](../../architecture/database-deployment.md#L3)　[早期新增模块核对](../../architecture/new-modules-database-review.md#L3)
- 审核以静态源码、迁移和官方技术文档为依据。运行时密钥、生产角色与授予、迁移实装、负载、缓存命中率和真实延迟仍待在隔离环境验收。本文的实现优先级属于设计，需确认后再实施。

## 结论状态

| 标签 | 含义 |
| --- | --- |
| 【要求】 | 本轮明确的产品约束或图中确认的方向 |
| 【代码】 | 可在审查基线的源码、配置或迁移中复核 |
| 【假设】 | 推荐设计或待测参数，需通过评估、负载或验收确认 |
| 【问题】 | 代码缺口或会导致返工的设计。详细条目记录依据、影响、修正、取舍与阻塞范围 |
| 【? 决策】 | 必须由相应负责人决定的产品、成本、数据或部署选择 |

P0 阻塞对应能力上线，涉及权限或不可静默覆盖的数据。P1 阻塞相应阶段的接口、正确性或可靠性。P2 在试点和放量时验证。P3 留给局部维护改进，本次未列为独立问题。P0 的生产可达性与影响范围需按真实部署单独核实。

## 按严重程度排列的整改索引

| 级别 | 问题 | 何时阻塞 |
| --- | --- | --- |
| P0 | [SEC-01 已发布行暴露未发布草稿](07-security-performance-review.md#sec-01-p0-公开帖子行与私有草稿共表) | 公开内容、源数据接入及索引扩展 |
| P0 | [MEM-01 长期偏好与推断缺少提案确认门槛](03-context-memory-review.md#mem-01-p0-长期偏好的确认门槛缺失) | 评测和记忆写入启用 |
| P1 | [ARCH-01 至 ARCH-02 模块所有权和统一入口](01-architecture-boundaries.md)　[GW-01 至 GW-02 语义合同与串行路径](02-ai-gateway-review.md) | 开发接口冻结 |
| P1 | [MEM-02 原子写入与迁移](03-context-memory-review.md)　[MODEL-01 至 MODEL-02 类型及来源版本](06-information-model-review.md) | 数据结构冻结和迁移 |
| P1 | [DISC-01 至 DISC-03 商品页、索引和硬约束](04-discovery-review.md) | 发现功能试点 |
| P1 | [SEC-02 至 SEC-05 准入、幂等、权限与密钥](07-security-performance-review.md) | 模型开放、会话切换和私有资料接入 |
| P1 | [RUN-01 至 RUN-03 工具授权、耐久执行和外部资料](05-mastra-review.md) | 对应 Agent、长任务及外链能力启用 |
| P2 | [DISC-04 自适应互动](04-discovery-review.md)　[SEC-06 观测与测试](07-security-performance-review.md) | 自适应和规模化试点 |

【问题】原图中 Gateway 下接 Personal Context、Discovery 与 Mastra 双向连接，容易被实现成每轮串行取档和两个执行入口互相调用。将 Gateway 设为唯一任务决策点，Personal Context 提供有权限且带版本的快照，Discovery 可直接运行，Mastra 只调用已经授权的领域操作。[职责和依赖](01-architecture-boundaries.md)

【要求】保留固定聊天框和关联操作、首批 20 件的产品默认值、可跳过的渐进澄清、确认后写入记忆。保留 PostgreSQL 与 pgvector 作为当前索引选项，保留现有公开目录和问卷评分作为迁移基础。【假设】第一阶段采用模块化 Next.js 进程和明确的数据库所有权。需要从请求生命周期分离的任务再验证 worker。Redis、外置向量库及新增队列需有可测的引入条件。[修订图](09-recommended-architecture.md)　[实施门槛](10-implementation-priorities.md)

## 审阅路径

| 文档 | 内容 |
| --- | --- |
| [01 模块边界](01-architecture-boundaries.md) | 七层对照、依赖方向与部署边界 |
| [02 AI Gateway](02-ai-gateway-review.md) | 请求分流、并发时序、上下文与成本 |
| [03 个人上下文](03-context-memory-review.md) | 提案状态机、写入、撤销与迁移 |
| [04 发现引擎](04-discovery-review.md) | 检索、分页、状态机与动态问题 |
| [05 Mastra](05-mastra-review.md) | Workflow、Agent、Tools 与任务恢复 |
| [06 信息模型](06-information-model-review.md) | 三方案比较、数据契约和 ER 图 |
| [07 安全与性能](07-security-performance-review.md) | 权限、成本、缓存、运行时及验收 |
| [08 待决事项](08-open-decisions.md) | 仍需确认的选择、证据与负责人 |
| [09 推荐架构](09-recommended-architecture.md) | 含状态标记的 Mermaid 图和请求契约 |
| [10 实施优先级](10-implementation-priorities.md) | 里程碑、迁移、回滚和放行条件 |
