# Architecture V2.1 阶段 0、1 执行记录

日期：2026-11-11。范围依据《Omnilink Architecture V2.1 完整框架》第 12 节，执行验证基线和四项安全修复。

## 执行状态

代码、测试和迁移已完成；四项所需迁移已应用到当前工作区连接的 `omnilink-dev`（`fpypixbxsfpzrihwgmfk`）。尚未推送本轮代码或部署应用。

当前 `.env.local` 和 Supabase 链接均指向该开发库。未把另外两个处于 INACTIVE 状态的项目认定为生产环境，也未操作它们。

## 阶段 0

- 本地代码起点：`9213d78a77cd16253aa14261a21e872710bc6ced`。
- 目标仓库：`Luna-7/Omnilink-Consumer-UI` 的 `main`。执行时重新核验，其 HEAD 仍为 `6c2da70aa9aa572b1bcf20aa9cc7bf5d438037a8`，与上次审核快照一致。
- 修复前基线：17 个测试文件、90 个测试通过，TypeScript 检查通过。
- 新增 API 测试范围，覆盖认证失败、聊天、个人记忆、创作者编辑和视频权限；直接运行现有四个 Mastra Workflow 的行为回归。
- 以 PGlite 执行真实 PostgreSQL 迁移、权限、RLS 和事务测试。旧 RLS 脚本改为运行隔离测试，不再读取 `.env.local`、创建真实用户或修改云端数据。
- 新增 GitHub Actions 定义，执行依赖安装、测试、Next.js 类型生成和 TypeScript 检查。尚未触发远程 CI。

### 已冻结的最小契约

定义位于 `lib/consumer-advisor/request-contract.ts`。

| 契约 | 已执行规则 |
| --- | --- |
| 请求标识 | `requestId` 兼容旧 `messageId`；若同时提交，必须相同；最长 100 字符，限字母、数字、下划线和连字符 |
| 会话标识 | `sessionId` 兼容旧 `conversationId`；必须是 UUID；别名冲突或格式错误返回 400，不静默换成其他会话 |
| 会话归属 | 按服务端验证的用户与会话 ID 共同限定；`ownerId` 不取自客户端；已有消息查询保持用户隔离 |
| 实体引用 | 明确区分 product、service、content、creator、merchant；UUID 和可选正整数版本；引用本身不授予资源权限 |
| 成功响应 | 所有聊天成功分支回传 `requestId`、权威 `sessionId`、兼容 `conversationId` 和 `contractVersion: 1` |

本阶段没有把请求标识误当成完整的幂等实现。请求摘要、持久请求状态、断线重放和完整 ResponseEnvelope 的推进仍需后续 Gateway 及响应层实施。

### 迁移实证

修复前，开发库仍使用 `consumer_eva_*` 表；仓库已经改为读取 `consumer_AI assistant_*`。同时确认了公开草稿列权限、客户端记忆 DML 和公开视频桶三项风险。开发库当时有 0 篇创作者帖子、0 条表内记忆、0 个该桶视频对象和 2 条聊天记录。风险存在于权限结构，不能据此声称发生了数据泄漏。

仅应用下列四项迁移，并按仓库版本登记。没有执行全量 `db push`。

1. `20261108150902_rename_consumer_ai_assistant_objects.sql`：修复现有代码所需的表名及资料键迁移，保留两条聊天记录。
2. `20261111020201_secure_creator_draft_reads.sql`：限制公开列并提供编辑者读取接口。
3. `20261111020342_consumer_memory_confirmation.sql`：提案、确认和唯一正式写入边界。
4. `20261111020348_private_creator_videos.sql`：私有视频桶与稳定播放引用。

其他旧迁移差异继续保留：订单询价、任务表版本、公开发现视图版本、商品类型及向量索引。没有将历史中同名但时间戳不同的迁移自动视为等价，也未自动补跑。

## 阶段 1

### 草稿

公开表查询只能选择列白名单，`draft_version` 对 anon 和 authenticated 均不可直接读取。清除旧的整表授权，包括本次发现的匿名 TRUNCATE 权限。编辑器通过 `get_creator_posts_for_editor` 读取完整记录；内部函数按当前登录用户、组织与编辑角色重新授权。

已发布记录保存待发布修改的行为保持可用，未把保存草稿改为撤下已发布作品。

### 长期记忆

- 模型候选和评测结果只能创建 `proposed`。尚未确认的旧记忆保留为提案；用户可编辑的旧资料不会在 GET 或聊天读取时自动写成 active。
- 手动明确保存视为确认；确认与修正请求必须携带已查看的 `revision`。
- 正式写入集中于服务端 Memory Manager 调用的 service-only RPC。authenticated 撤销直接 DML 和该 RPC 的执行权；读取仍受用户 RLS 限制。
- active 必须具有匹配用户的确认者及确认时间，数据库 CHECK 约束强制执行。
- 确认保留原始 `origin`、证据和原文；修正不把推断伪装成用户原始自述。
- 确认替换、旧记录失效、递归依赖推断失效和版本更新在同一事务内执行；提案阶段不会撤销旧记忆。
- 对 live 文本做标准化唯一约束及用户级事务锁。拒绝记录不计入 50 条 live 记录上限。
- 推荐上下文仅使用已确认记录。问卷原始答案、自动派生档案和旧资料里的偏好不再绕过确认进入模型上下文。

本阶段提供确认、修正、拒绝和遗忘 API；完整评测、提案管理界面及个人上下文扩展属于阶段 3。

### 视频

`creator-content-videos` 已设为私有。新上传返回对象路径、限域上传票据和稳定站内播放地址，不再返回永久 public URL。

播放入口先验证该视频是否出现在同组织已发布正文中，或请求者是否为该组织的有效编辑者，随后签发 60 秒播放 URL，禁止共享缓存。待发布 `draft_version` 中的引用不构成公开播放授权。历史正文及待发布正文内的该桶 URL 迁移为稳定站内引用；迁移可重跑，保持私有。

已签发的播放 URL 在其短有效期内仍然有效。撤回后的新请求会重新检查授权。

### 认证

普通未登录、失效凭证、认证服务故障和配置故障分别处理。Auth 网络错误、5xx、429 或未知错误不会降格为游客并继续调用付费模型。聊天及受保护 API 使用共同的认证处理。

## 验证结果与边界

- 最终 27 个测试文件、150 个测试通过。
- TypeScript 检查和生产构建通过。
- 新增安全模块 ESLint 检查通过；现有聊天文件仍有一处原有 any 警告。
- 开发库实际查询确认：草稿列匿名及普通登录角色直接读取权限为 false，公开标题读取权限为 true，匿名 TRUNCATE 为 false，编辑 RPC 授权为 true，客户端记忆插入及更新为 false，客户端记忆 RPC 执行权为 false，service_role 执行权为 true，视频桶 public 为 false，未确认 active 记录数为 0，原聊天记录仍为 2 条。
- 从本机访问公网 Data API 时，SDK 未得到 HTTP 响应，curl 返回 TLS 连接错误 35。该项联调未通过，不能将其报告为公开 HTTP 接口验证成功。数据库内权限实证和隔离 PostgreSQL 的真实角色测试已通过；公网接口联调仍待网络可达时完成。
- Supabase 安全 Advisor 未新增本轮对象告警。仍有原有 discovery_products definer 视图、组织创建 RPC 与密码泄漏保护配置提示，需按各自职责评估。[视图提示](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)、[RPC 提示](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)、[密码配置说明](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。
- 构建仍提示旧 middleware 命名弃用，以及本地 BGE 动态文件访问扩大追踪范围。向量检索和部署体积处理未混入本阶段。

## 发布顺序

当前开发库的迁移已完成。后续应用部署使用本次已通过构建的代码；如果另有生产数据库，先核对目标和迁移实证，再按以上依赖顺序执行，不能直接把开发库状态当成生产库状态。

任何回退都应保留草稿限制、视频私有状态和记忆确认边界，不重新开放旧的公开桶或直接 DML。完整回退需要 API 与数据库联动，禁止仅恢复旧版应用后重新打开权限。
