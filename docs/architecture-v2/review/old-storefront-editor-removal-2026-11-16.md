# 旧网站编辑器删除记录

日期：2026-11-16

按用户明确要求直接删除旧编辑器，不保留隐藏入口。AI 网站设计尚未实现，当前入口只显示重建状态和商品管理链接，不提供假生成或假发布操作。

## 已删除

- `components/storefront/StorefrontEditor.tsx`
- `components/storefront/StorefrontHub.tsx`
- `lib/storefront/puck-adapter.ts`
- `lib/storefront/puck-adapter.test.ts`
- `lib/storefront/editor-products.ts`
- `app/actions/store.ts`
- `app/actions/template.ts`
- `app/api/stores/[id]/template/route.ts`

共 8 个源码/测试文件、1,071 行。卸载直接依赖 `@puckeditor/core` 并同步 npm 锁文件，npm 共移除 66 个安装包。网站设计路由已替换为简洁状态页。

## 保留

- 公开店铺及商品详情渲染、StorefrontSchema 和数据归一化：仍被公开页面和预览使用。
- 商品、品牌、图片、组织权限与 RLS：不属于旧编辑器，不删除数据。
- 数据库历史迁移与已发布记录：本次没有执行 SQL 或删库。
- 公开店铺 smoke 脚本：验证公开渲染，仍有效。

旧编辑器专用的应用层保存/发布动作已删除；数据库权限规则和历史版本仍保留，供后续新发布体系参考。没有宣称新 AI 编辑器已经接入。

## 验证

- 无在用源码继续引用 Puck、旧编辑器、适配层或已删除动作。
- Vitest：58 个测试文件、407 项测试通过。原 Puck 适配层的 4 项测试随对应模块删除。
- 重新运行 Next.js 路由 typegen，清除生成类型对已删除接口的旧引用；TypeScript 检查通过。
- 修改文件 ESLint 和 git diff --check 通过。
- 390px / 1108px：网站设计入口正常，无旧编辑控件；管理商品链接正常，无浏览器运行错误。
- 公开演示店铺 `/store/omnilink-flagship` 返回 200；旧模板接口 `/api/stores/demo-store/template` 返回 404。
- 未进行真实账户发布、云端迁移或生产部署。

删除前文件临时备份：`/private/tmp/omnilink-old-editor-removed-20261116`。
