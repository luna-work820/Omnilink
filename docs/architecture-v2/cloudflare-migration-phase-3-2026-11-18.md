# Cloudflare 迁移阶段 3：压测与观测

## 当前结论

阶段 3 尚未通过，不能进入正式域名切换。同一个 Preview 的设计版登录页和 Images 处理已完成兼容性验证，但 Workers Free 的 CPU 余量、现网峰值基线，以及媒体、AI、站点构建的完整端到端验收仍未满足条件。

## 已执行

- 复用唯一的 `omnilink-login-design` Worker Preview，重新部署到原预览地址；修复后的部署 ID 为 `4c7c5d83-9b54-4247-82d5-e420ace436a4`。
- 在 `cloudflare.config.ts` 中仅为 Preview 启用持久日志与追踪，采样率为 100%，并移除日志中的 URL 查询参数。正式 Worker 的观测配置未改变。
- 第一次远端请求发现 `/login` 返回 500。Cloudflare 日志指向 GSAP 在模块加载期间调用 `setTimeout`。在预览构建中用可审查的源码补丁把插件注册限制在浏览器后，同一个 Preview 的 `/login` 返回 200，`/` 和 `/discover` 返回预期的 307 跳转。
- 增加 `scripts/cloudflare-preview-load.mjs`。它只允许对公开页面 `/`、`/login`、`/discover` 发起 GET，先探测再按指定速率请求，输出错误率、实际吞吐及 p50/p95/p99 延迟。单次最多 5,000 次请求。`node --check` 通过。
- 当前机器的 DNS 将预览地址解析为 `157.240.17.14`；直接连接 443 超时，指定可访问的 Cloudflare IP 后 TLS 连接被重置。本机预探测在 8 秒超时并停止。改从美国节点短时请求后，确认预览本身可达。测试环境已停止。
- 按保守目标对 `/login` 发送 2 请求/秒，共 15 秒、30 个 GET：30 个 HTTP 200，0 个 HTTP 错误；客户端延迟 p50 85 ms、p95 482 ms、p99 1081 ms。Cloudflare Preview 对应的 30 次 Worker 调用均为 `ok`，CPU p50 22 ms、p95 138 ms、p99 367 ms。样本只覆盖公开登录页，不能推断其他业务路径或真实峰值。
- Cloudflare Observability 账户接口返回 `plan: free`、每日 200,000 事件限额。Cloudflare 官方文档说明 Workers Free 每次请求 CPU 为 10 ms，且不提供 Containers；当前不能据此假设站点生成可在 Cloudflare 运行。
- 此次 30 次调用没有资源超限错误；12 次 CPU 观测高于 Free 方案的 10 ms 限额。Cloudflare 允许偶发 rollover，所以这组样本没有证明请求已经失败；若持续超过限额，Worker 会被终止。它是继续压测和优化的风险信号，不单独证明必须付费。
- 设计版登录页、资源和 GSAP 浏览器注册修复已并回当前源码；预览构建不再从旧 Git 版本临时恢复登录页或应用补丁。新增设计依赖已写入 package.json。
- 对并回源码后的版本再次从美国节点测试 `/login`、验证失败状态、`/`、`/discover`：分别返回 200、200、307、307。2 请求/秒、15 秒的 30 次 `/login` GET 全部返回 200，客户端 p50 43 ms、p95 293 ms、p99 976 ms。Cloudflare 对应 30 次调用均为 `ok`，CPU p50 9 ms、p95 125 ms、p99 126 ms，其中 12 次超过 10 ms。最终移除图片测试接口后的版本又确认 `/login` 为 200、测试接口为 404。
- 图片处理已拆为 Vercel Sharp 与 Cloudflare Images binding 两个实现，覆盖商品 WebP、头像裁切、图片元数据与品牌 RGB 取样。真实 Worker 上用固定 4×4 测试图得到 4×4 元数据、70 字节 WebP、550 字节头像 WebP 和 48 字节 RGB。临时测试接口已删除。同账户的本地远端 binding 调用返回内部错误，故以已部署 Preview 的真实 Worker 测试为准；真实用户上传仍未验收。
- vinext 构建提示 `next/image` 当前按原图提供；项目有多处图片组件。Cloudflare Images 的上传适配并不自动覆盖页面图片优化，正式切换前需结合真实图片流量决定是否启用 Images optimizer，并核对免费转换额度。
- 本地无 WebGL 浏览器截图发现：设计登录页虽然返回 200，但 OGL 初始化异常会触发全页错误边界。现已在 Ripple、轮播和文字组件初始化前检查 WebGL；无 WebGL 时使用原设计图片作为静态回退。重新截图显示设计首页和验证失败弹窗可正常显示，没有新增解释性文案或颜色。
- 修复后重新部署到原 Preview，预览 ID 仍为 `2a3806797072422eaa118538e3da65e8`，最终部署 ID 为 `c9939460-ac9c-4e9c-8a04-d86a36d11f39`。美国节点确认 `/login` 和验证失败状态为 200，`/`、`/discover` 为 307，已移除的图片测试接口为 404。Cloudflare 版浏览器端截图仍待可连通的浏览器环境验证。
- Cloudflare Images 定价已更新：使用 Supabase Storage 时，Images Free 提供每月 5,000 次独立转换；超过额度的新转换返回 9422。当前不需要购买 Images Paid 来验证图片转换。Cloudflare Sandboxes 仍仅在 Workers Paid 可用，Workers Paid 月最低 $5，Containers 另按超出包含量的资源计费。
- 开发 Supabase 的迁移记录再次确认：本地 51 个文件、远端 44 条记录，9 个本地独有、2 个远端独有。只读导出的 `public` schema 显示 `consumer_agent_tasks` 和 `discovery_products` 等对象已存在，虽然对应本地迁移未记入远端历史；不能直接推送全部本地迁移。`supabase db diff --linked` 的本地影子库初始化因 StorageBackendError `drop-bucketid-objname-index not found` 失败；未修改远端数据库。
- Next 与 Cloudflare 生成类型原本同时进入主 TypeScript 项目，导致 `Response.json()` 被错误推断。现将 Cloudflare 类型隔离到 `tsconfig.cloudflare.json`，并清理被 vinext 覆盖的 Next 生成路由类型；`next build` 完整通过，Cloudflare 适配层 `tsc` 通过，vinext 构建和 Preview 部署通过。
- Vercel Web Analytics 未启用，Observability 请求指标要求付费升级；当前没有可读取的真实峰值 RPS 与 p95 基线。单次生产域名请求不能代替峰值基线。

## 尚不能测试的关键路径

| 路径 | 缺口 |
| --- | --- |
| 媒体上传与图片处理 | 图片转换已通过真实 Worker 固定样本验证；Preview 没有 service-role 密钥，也没有完成带测试账号的商品/头像上传。 |
| AI 请求 | 当前 Preview 不含模型密钥，无法测量正常请求或模拟模型故障恢复。 |
| 站点生成 | 现有实现依赖 Vercel Sandbox，尚无 Cloudflare Sandbox/Containers 的可运行替代。 |
| 登录、会话刷新、商品及结算 | Preview 连接独立开发 Supabase，但数据库迁移记录与仓库存在漂移；美国节点可访问预览，本机网络仍无法连接，尚未使用测试账号完成端到端复测。 |
| Supabase 故障演练 | 需先建立可用的完整预览及测试账号，随后隔离或替换测试依赖，记录超时、错误提示和恢复结果。 |

## 继续验收所需条件

1. 用户选择先用保守目标测试，已完成公开登录页 2 请求/秒验证。正式域名切换前仍需取得近 7 天真实峰值请求量、峰值并发或等效负载目标，以及 Vercel 关键路由的 p95 延迟；不能以保守样本宣称覆盖实际峰值。
2. 从能够连接预览 URL 的网络，对完整关键路径运行分级负载。保留每轮请求数、错误率、p50/p95/p99 延迟及 Cloudflare Worker CPU p50/p99、`exceededResources` 计数。
3. 用户已授权 Workers Paid 月付和单实例短测。当前连接的 Cloudflare CLI 凭证没有 Billing Write；创建订阅返回 403，未创建订阅。需由管理员提供具备 Account > Billing > Edit 的 CLI 凭证后，才能启用 Workers Paid 和继续单实例短测。订阅月费为 $5，Containers 超出包含用量后另计费。
4. 让 Cloudflare 关键路径达到现网基线并保有 CPU 与请求限额余量，再标记阶段 3 通过。通过前保留 Vercel 正式域名指向，不执行阶段 4。

Cloudflare 预览观测和指标说明：<https://developers.cloudflare.com/workers/previews/test-and-debug/>。Workers 方案与限额：<https://developers.cloudflare.com/workers/platform/pricing/>。CPU 分位数与 rollover 说明：<https://developers.cloudflare.com/workers/observability/metrics-and-analytics/>。图片定价：<https://developers.cloudflare.com/images/pricing/>。Sandboxes 与 Containers 计费：<https://developers.cloudflare.com/sandbox/>、<https://developers.cloudflare.com/containers/platform/pricing/>。
