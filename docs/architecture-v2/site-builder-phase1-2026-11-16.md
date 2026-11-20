# AI 网站设计第一阶段：接口、文件与版本协议

日期：2026-11-16
状态：本地代码已实现；尚未接入生成、沙箱或发布执行器。

## 1. 本阶段交付

- 可运行的 StorefrontData v1 公开数据接口，以及不依赖数据库实现的读取 SDK。
- 生成网站的页面属性、文件变更集、源代码摘要与父版本协议。
- 任务状态转换及发布前置条件的纯函数实现，后续执行器必须调用并同时进行真实身份和持久化校验。
- 边界测试覆盖跨店铺数据读取接缝、缺价、非法 URL、路径、命令注入字段、过期版本及越权发布角色。

本阶段没有创建网站版本表、持久化任务或租户沙箱，没有启用生成按钮，也没有把函数测试当作真实云端发布验收。下一阶段仍需落实构建器与隔离运行。

## 2. StorefrontData v1

实现：`lib/site-builder/contracts.ts`、`projection.ts`、`public-data.ts`、`sdk.ts`。

### 公开接口

| 方法与地址 | 返回内容 |
|---|---|
| GET `/api/site-data/v1/{storeSlug}` | `{ schemaVersion: "1", store }` |
| GET `/api/site-data/v1/{storeSlug}/products?offset=0&limit=24` | `{ schemaVersion: "1", storeSlug, items, nextOffset }` |
| GET `/api/site-data/v1/{storeSlug}/products/{productId}` | `{ schemaVersion: "1", storeSlug, product }` |

只接受 GET，不提供后台写入能力。店铺及商品标识限制为 1–160 位字母、数字、下划线或连字符。分页只接受 offset / limit，拒绝重复参数、负数、小数、未知参数与任意 storeId/includeDrafts；limit 为 1–50，offset 为 0–100000。

商品读取先确认店铺已公开，再沿用现有店铺归属、active 状态和渠道可见性过滤。旧演示店铺 fallback 不进入真实数据协议。分页在数据库完成，created_at / id 构成稳定排序；offset 是当前目录位置，不是冻结目录快照，目录增删期间不保证跨页无重复。

返回 `Cache-Control: no-store`。数据库故障返回 503，不以空数组或模拟商品伪装成功。公开读无账号凭据需求，不能通过传入商家 Cookie 或 storeId 开启草稿模式。

### 数据字段

| 数据 | v1 字段与约束 |
|---|---|
| 店铺 | slug、name、description、logoUrl，以及公开 email / phone / address |
| 商品 | id、name、description、category、price、imageUrl、images、attributes、options、variants、outboundLinks |
| 规格选项 | name 和 values；不暴露数据库内部完整行 |
| 变体 | id、price、selections、availability；不暴露内部 SKU 和精确库存数量 |
| 可售状态 | available / unavailable / unknown；缺少可信库存信息时不推断“有货” |
| 外链 | 复用平台当前小红书、抖音域名校验，只输出合规的已有链接 |
| 媒体 | 只输出可解析的 HTTPS URL，不接受 javascript/data URL 或带用户名密码的 URL；更细的资源来源限制由运行阶段补齐 |

价格采用判别联合，不依赖 0 表示所有状态：

```ts
type SitePrice =
  | { kind: 'amount'; amount: number; currency: string }
  | { kind: 'free' }
  | { kind: 'inquiry' }
  | { kind: 'unknown' }
```

amount 必须为有限非负数且币种为三位大写代码。真实 0 元金额与显式免费分开；未声明可信价格、非法金额或缺失币种不生成“免费”。现有商品归一化已补齐 unknown：缺失或非法原始价格不再被当作已知 0 元价格。

品牌字段目前仍以既有公开店铺服务为准，缺失介绍和 logo 保持 null，不读取私有品牌项目补造事实。品牌资料统一写入归属仍在后续改造范围。

### SDK

`createSiteDataClient({ origin, storeSlug, fetch? })` 返回 `store()`、`products({offset, limit})`、`product(id)`。店铺固定在创建客户端时，单次读取不能重传租户。SDK 对返回的 schemaVersion、店铺标识、商品标识、分页和字段执行验证；不兼容返回 CONTRACT_MISMATCH，不静默降级。

请求固定使用 credentials=omit、cache=no-store、redirect=error，并设 10 秒请求超时。生产数据源必须 HTTPS；仅 localhost / 127.0.0.1 允许本地 HTTP。base URL 不允许包含凭据、路径、查询参数或片段。

错误结构：`{ error: { code, message } }`。HTTP 400=INVALID_REQUEST，404=STORE_NOT_FOUND / PRODUCT_NOT_FOUND，503=DATA_UNAVAILABLE；SDK 以 SiteDataError 暴露状态和代码。

新接口不替换现有店铺页面，也不把消费者五店演示目录作为真实商家数据源。跨源私有预览接口尚未提供；不能把公开接口放宽为含草稿版本。

## 3. 文件与页面协议

实现：`lib/site-builder/source.ts`。

固定入口：

- `src/pages/home.tsx`
- `src/pages/products.tsx`
- `src/pages/product.tsx`

页面接收平台传入的 SitePageProps：store、products、product 和 route。商品详情 route 带 productId；未知商品和未发布店铺由可信运行入口处理，不能在组件里猜测所属店铺。

当前允许 AI 写入：

- `src/pages/**/*.ts` / `.tsx`
- `src/components/**/*.ts` / `.tsx`
- `src/styles/**/*.css`

其他路径一律拒绝，包括 package.json、锁文件、启动配置、SDK、.env、绝对路径、反斜杠、百分号编码路径、隐藏文件及 `.` / `..` 路径片段。媒体通过平台上传和数据接口使用，本协议不允许模型写入任意二进制或可执行文件。

变更集格式：

```json
{
  "protocolVersion": "1",
  "baseRevisionId": "64位SHA-256摘要，首次生成时为null",
  "changes": [
    { "operation": "write", "path": "src/pages/home.tsx", "content": "页面源码" },
    { "operation": "delete", "path": "src/components/unused.tsx" }
  ]
}
```

示例只展示结构，首次生成必须同时具备三个入口；删除不存在文件、重复修改同一路径、移除必需入口均被拒绝。每次最多 64 项变更、48 个最终文件、单文件 100000 字节、总量 500000 字节，按 UTF-8 字节计算。

`commands`、`packages` 以及任意额外协议字段会被拒绝，不再沿用上游“解析后直接执行命令”的做法。完整新文件集合校验成功后，按稳定顺序计算 SHA-256 摘要；摘要覆盖父版本、数据协议、运行协议和文件内容，返回冻结版本对象，不就地修改旧版本。

此模块只负责文件变更协议，不执行代码，也不证明 TypeScript 可编译或页面事实绑定正确。模块导入、依赖许可、编译检查、CSP 和运行隔离由下一阶段构建器落实；未实现的检查不能称为已通过。

## 4. 任务与发布协议

实现：`lib/site-builder/lifecycle.ts`。

```text
queued → generating → building → ready
   │          │           │
   └cancelled ├failed     ├failed
              └cancelled └cancelled
```

ready / failed / cancelled 为终态，不通过回写旧任务原地重启。重试创建新任务并关联原任务和源代码基准，不能把已取消任务的迟到结果写成成功。

每次状态变化要求 expectedRevision 匹配，成功后 revision 加一。这个纯函数不提供数据库锁、任务租约或跨进程恢复；后续持久化实现必须以条件更新或事务落实相同检查。

发布前置条件：

1. 角色为当前组织 owner / admin；editor 不可发布。
2. 构建记录与目标 siteId / storeId 一致。
3. 构建为 ready，具有合法的产物 SHA-256 摘要。
4. sourceRevisionId 等于待发布的源版本。
5. dataVersion / runtimeVersion 与平台支持版本一致。

上述检查使用服务端可信身份和记录，不接受客户端声称的 role / build 对象作为授权来源。本轮没有新增可调用的发布接口或用纯函数冒充发布成功。

## 5. 后续存储记录约定

以下是后续表及存储协议需要承载的字段，不表示本次已建表：

| 记录 | 核心字段 |
|---|---|
| 网站项目 | siteId、storeId、organizationId、draftRevisionId、activeReleaseId |
| 源代码版本 | id、siteId、parentId、files / blobRef、dataVersion、runtimeVersion、createdBy |
| 生成任务 | jobId、siteId、storeId、baseRevisionId、status、revision、lease、幂等键、错误码、用量 |
| 构建记录 | buildId、siteId、storeId、sourceRevisionId、依赖锁摘要、构建器版本、产物摘要与日志 |
| 发布记录 | releaseId、siteId、buildId、发布者、发布时间、前一发布版本、撤销信息 |

修改商品不产生新的网站代码版本。发布或回滚只切换代码产物，不修改商品、价格或库存。跨实例并发、租约、任务恢复和事务切换需要在持久化阶段通过数据库测试验收。

## 6. 执行状态和外部条件

第一阶段的数据契约、SDK、文件协议、版本摘要、任务与发布前置条件已有代码和测试。没有复制 Open Lovable 的全局沙箱状态，也没有恢复旧编辑器。

本地检查未发现 VERCEL_OIDC_TOKEN，也未发现完整的 VERCEL_TOKEN / VERCEL_TEAM_ID / VERCEL_PROJECT_ID 组合；E2B_API_KEY 和独立预览/运行地址亦未配置。此记录只检查变量是否存在，不读取或展示密钥值。

下一步先选定并配置 Vercel Sandbox 认证，再实现和验证受控 TypeScript 构建与 SSR 运行。正式域名、证书、产物托管和私有预览授权仍是后续工作，不能因本阶段测试通过而宣称已经上线。


## 7. 本次验收与沙箱连接补充

- 第一阶段新增 68 项测试；全量 64 个文件、475 项测试通过。TypeScript、相关文件 ESLint 和 diff 检查通过。
- 本地 HTTP 请求携带 includeDrafts=true 返回 400 / INVALID_REQUEST，没有请求草稿数据或回退到演示目录。
- 后续检查发现本机 Vercel CLI 已登录，连接工具中已有 Omnilink 项目。以显式项目和团队确认目标后，将 development 环境拉取至权限受限的临时文件，未覆盖项目 `.env.local`，未输出密钥值。
- 使用获取的开发 OIDC 创建真实 Vercel Sandbox：persistent=false、timeout=60000、networkPolicy=deny-all。Node 版本命令成功，结果 v24.22.3，随后停止沙箱。没有部署网站、启用付费套餐或修改线上环境变量。
- 固定使用 `@vercel/sandbox@4.0.0`，新增 `scripts/verify-site-sandbox.mjs`。复查时可通过 `node --env-file=<私有开发环境文件> scripts/verify-site-sandbox.mjs` 执行；脚本只做连通验证并停止资源，不构建或运行生成网站。
- 因而第 6 节的“本地未配置变量”是最初检查状态；目前已确认现有项目和账号可以获取开发认证，不需要在聊天中提供密钥。临时认证不等于后台已自动配置完成，生产部署仍需由部署环境提供 OIDC。
- 第 2 阶段仍待实现并验收受控工程脚手架、依赖锁、编译、SSR、私有预览及其生命周期；Node 命令成功不算这些能力已完成。
