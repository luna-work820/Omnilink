# Cloudflare 迁移阶段 0–2

## 阶段 0：基线

- 保留当前工作区中的已有修改，不重置分支、不清理用户文件。
- Cloudflare Worker Preview 已有唯一预览名 `omnilink-login-design`。
- 本地 `.env.local` 指向独立的 `omnilink-dev` Supabase 项目。
- `omnilink-dev` 当前有 44 条迁移记录；仓库有 51 个迁移文件。9 个本地迁移未记录在远端，另有 2 条远端记录在本地不存在。暂不向该项目应用迁移。

## 阶段 1：运行时兼容性盘点

| 功能 | 当前依赖 | Cloudflare 状态 |
| --- | --- | --- |
| 商品图片上传、头像、品牌取色 | Vercel 使用 `sharp`；Cloudflare 使用 Images binding | 已完成平台适配并在 Worker Preview 上用固定测试图验证元数据、WebP、头像裁切和 RGB 取样。真实用户上传仍需端到端验收。 |
| PDF 文本提取 | `pdfjs-dist` | 文本提取路径可继续验证；Worker 日志出现可选 Canvas 原生模块缺失提示。 |
| 用户生成网站构建和预览 | `@vercel/sandbox` | 绑定 Vercel OIDC、Sandbox API 和文件系统，不能直接在 Worker 中运行。需要单独迁移到 Cloudflare Sandbox/Containers。 |
| 登录和常规 Supabase 请求 | `@supabase/ssr`、Supabase JS | 可通过 Preview 绑定开发项目 URL 和公开 anon key 验证。 |

Cloudflare Images 现允许免费方案对外部存储图片进行每月 5,000 次独立转换，binding 可处理原始字节；超过额度后，新转换会返回 9422。原先“binding 必须购买 Images Paid”的判断已过时。本项目继续使用 Supabase Storage，暂不购买 Images 存储。资料：[Images 定价](https://developers.cloudflare.com/images/pricing/)、[Workers binding](https://developers.cloudflare.com/images/optimization/binding/)。

## 阶段 2：隔离预览

- `npm run preview:vinext` 从 `.env.local` 读取 Supabase URL 和公开 anon key，并拒绝任何非 `omnilink-dev` 项目。
- 预览部署复用 `omnilink-login-design`，避免产生第二个预览。
- 设计版登录页及资源已恢复到当前源码。构建在临时副本中进行，直接使用当前源码；不再从旧 Git 版本临时恢复登录页或打补丁。
- 部署过程不读取或上传 service-role、AI、Vercel Sandbox 密钥。
- 预览只连接开发 Supabase，不修改数据库。登录与 RLS 读请求可以验证；需要 service-role 的操作、依赖缺失迁移的功能，以及 Vercel Sandbox 网站构建仍不在此预览的可用范围。

### 验证结果

- vinext Cloudflare 构建与 Preview 上传成功，复用了原有预览名和地址。
- 构建配置确认指向 `omnilink-dev`，含公开 anon key，不含 service-role、AI 或 Vercel Sandbox 密钥。
- 从美国测试节点访问同一个 Preview：设计版 `/login` 与验证失败状态均返回 200，`/` 和 `/discover` 返回预期的 307。当前本机网络仍无法连接 workers.dev 的 443 端口。
- 本地生产构建已通过。浏览器检查发现无 WebGL 时设计页会崩溃，现已加静态图片回退；本地设计首页和验证失败弹窗截图通过。最终部署仍使用原 Preview ID `2a3806797072422eaa118538e3da65e8`。
- Cloudflare Images binding 已用固定 4×4 测试图在真实 Worker 上返回尺寸、WebP 字节、头像裁切字节和 RGB 数据。测试接口随后移除，未保留公开探针。

## 后续门槛

1. 先对照迁移 SQL 与 `omnilink-dev` 实际 schema 处理迁移漂移，再用隔离的测试数据做完整功能验收。
2. 用测试账号完成商品图片、头像和品牌取色的端到端验证，并监测 Images 免费额度。
3. 在 Workers Paid 方案下实现并验证网站构建沙箱，再评估全站切换。
