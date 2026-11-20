# 公众号式长文与装饰长图开源选型

核查日期：2026-11-17。目标：手动添加部件、连续背景、多装饰、可继续编辑的长文，以及平台前端保留排版。暂不采用 AI 排版。

本轮做了官方文档、许可证和关键源码核查，没有安装候选依赖、运行候选应用或验证嵌入效果。应用代码与依赖未改动。以下“可复用”指找到具体实现或扩展入口；工程适配结论为基于源码的判断。

## 建议

**以 Puck 作为文章部件编辑底座，配置背景分区、富文本、图片、图文组合、装饰和长图模块；复杂固定构图使用快图编辑器制作，保存源 JSON 与导出图片。**

理由是本需求同时需要部件式排版和复杂装饰。Puck 已有 React 组件配置、嵌套 slot、富文本及独立阅读渲染；快图已有画布对象、图层与真实 PNG/SVG 导出。组合的可行性来自这些已有接口，但该组合尚未运行验证。[Puck 介绍](https://puckeditor.com/docs)、[嵌套布局](https://puckeditor.com/docs/integrating-puck/multi-column-layouts)、[富文本](https://puckeditor.com/docs/integrating-puck/rich-text-editing)、[快图导出源码](https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/packages/core/ServersPlugin.ts)。

若优先级变为完全复现 Notion 的键盘和斜杠菜单写作体验，BlockNote 是更直接的文档编辑候选；其容器布局目前被官方标注为 Preview，不能将它视为已验证的稳定背景分区方案。[BlockNote 仓库](https://github.com/TypeCellOS/BlockNote)、[Layout Blocks](https://www.blocknotejs.org/docs/features/custom-schemas/layout-blocks)。

## 候选对照

| 项目 | 核实能力 | 接入判断与缺口 | 许可证据 |
| --- | --- | --- | --- |
| [Puck](https://github.com/puckeditor/puck) | React 部件编辑，支持嵌套布局、富文本、内联编辑、不同视口，有独立 Render。[文档](https://puckeditor.com/docs) | 可复用编辑器和渲染底座；公众号装饰组件、素材库、业务保存与长图导出需配置或开发。 | [MIT](https://github.com/puckeditor/puck/blob/f0a3f91c8d2c1cbc7eb8d02b0c0f1c4c80d7314d/LICENSE) |
| [快图 vue-fabric-editor](https://github.com/ikuaitu/vue-fabric-editor) | 文字、图片、SVG 与图层；自定义画布尺寸；PNG、SVG 与 JSON 导出恢复。 | 适合自由构图的装饰长图模块。完整 UI 是 Vue；复用 core 需要 React 面板，或隔离接入 Vue 编辑器。已核查导出未见纵向切片。 | 根 [MIT](https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/LICENSE)；core 包标 ISC，需核清分发时的元数据差异。 |
| [BlockNote](https://github.com/TypeCellOS/BlockNote) | Notion 式块、拖排、斜杠菜单、React 自定义块；frame/layout 扩展能包裹子块。[自定义块](https://www.blocknotejs.org/docs/features/custom-schemas/custom-blocks) | 写作交互最贴近前述要求；背景、装饰属性和阅读输出仍需做，容器 API 为 Preview。[布局文档](https://www.blocknotejs.org/docs/features/custom-schemas/layout-blocks) | [主库 MPL-2.0，XL 为 GPL-3.0 或另行商业许可](https://github.com/TypeCellOS/BlockNote/blob/main/LICENSE.txt) |
| [ContentCraft](https://github.com/luobuchao0321/wechat-article-editor) | 公众号 HTML/SVG 模块识别、换图、背景与间距调整、本地模块库。Next.js 16 / React 19。[依赖](https://github.com/luobuchao0321/wechat-article-editor/blob/ec15d267ee7c4f7a9f664ae9da07b493e5a622fa/package.json) | 可参考公众号模块处理，但不是现成的 Notion 编辑器；长图导出按钮目前为占位。[占位实现](https://github.com/luobuchao0321/wechat-article-editor/blob/ec15d267ee7c4f7a9f664ae9da07b493e5a622fa/app/page.tsx#L3346) | [MIT](https://github.com/luobuchao0321/wechat-article-editor/blob/ec15d267ee7c4f7a9f664ae9da07b493e5a622fa/LICENSE) |
| [yft-design](https://github.com/dromara/yft-design) | Vue/Fabric 海报设计，丰富背景与图片编辑，有 PNG/JPEG/SVG 和当前画布 JSON。 | 默认高度上限 800 mm，按其换算约 9449 px；超出需调整或分段。当前导出未见纵向切片。 | [MIT](https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/LICENSE) |

快图与 yft 的具体源码、尺寸、导出及素材许可证据见[画布编辑器核查](./creator-poster-editors-research-2026-11-17.md)。代码许可不能直接说明演示站的每张贴纸、模板和每种字体都已获商业使用授权，素材供应需要单独确定。

## Puck 源码检查

核查快照：f0a3f91c8d2c1cbc7eb8d02b0c0f1c4c80d7314d。

- core 包声明 React 18/19 peer，标注 MIT；本轮主分支 package 版本为 0.24.0。版本信息是源码状态，不等于已经在 Omnilink 试装。[package.json](https://github.com/puckeditor/puck/blob/f0a3f91c8d2c1cbc7eb8d02b0c0f1c4c80d7314d/packages/core/package.json)。
- Grid 示例将嵌套内容声明为 slot，并用 React/CSS 组织列数和间距，可参考其分区布局。[Grid](https://github.com/puckeditor/puck/blob/f0a3f91c8d2c1cbc7eb8d02b0c0f1c4c80d7314d/apps/demo/config/blocks/Grid/index.tsx)。
- Render 将配置与数据带入阅读模式，编辑状态为 false，支持阅读端沿用组件和数据。[Render](https://github.com/puckeditor/puck/blob/f0a3f91c8d2c1cbc7eb8d02b0c0f1c4c80d7314d/packages/core/components/Render/index.tsx)。
- 官方富文本字段基于 Tiptap，支持内联编辑和扩展配置。[富文本文档](https://puckeditor.com/docs/integrating-puck/rich-text-editing)。

推断：Puck 可以减少编辑器基础设施工作，但需要配置文章专用部件，演示组件不能直接等同于公众号模板库。

## ContentCraft 源码检查

核查快照：ec15d267ee7c4f7a9f664ae9da07b493e5a622fa。

- 模块类型保存 HTML，区分排版、SVG、动图和图片等；图库使用 IndexedDB。[wechatModules.ts](https://github.com/luobuchao0321/wechat-article-editor/blob/ec15d267ee7c4f7a9f664ae9da07b493e5a622fa/lib/wechatModules.ts)。
- 编辑工具直接操作 DOM，包含模块移动、复制、删除、背景色、边距、边框和圆角，也能识别背景图及替换图片。[wechatEditor.ts](https://github.com/luobuchao0321/wechat-article-editor/blob/ec15d267ee7c4f7a9f664ae9da07b493e5a622fa/lib/wechatEditor.ts)。
- 主页面使用 contentEditable 保存 HTML。部分装饰模块有截图转换逻辑，但“生成长图”按钮只显示后续接入提示，没有完整的整篇长图导出。[编辑入口](https://github.com/luobuchao0321/wechat-article-editor/blob/ec15d267ee7c4f7a9f664ae9da07b493e5a622fa/app/page.tsx#L3295)、[长图入口](https://github.com/luobuchao0321/wechat-article-editor/blob/ec15d267ee7c4f7a9f664ae9da07b493e5a622fa/app/page.tsx#L3346)。

推断：适合借鉴公众号模块处理与换图方法；主页面 3861 行，复用前需要拆出编辑和模块逻辑。根 MIT 不包含第三方付费模板的授权。

## BlockNote 源码与 API 检查

- 本轮 main 的 core/react package 版本为 0.57.0，react 包包含 React 19 peer。[core package](https://github.com/TypeCellOS/BlockNote/blob/main/packages/core/package.json)、[react package](https://github.com/TypeCellOS/BlockNote/blob/main/packages/react/package.json)。
- ReactBlockSpec 实现 renderFrame、slotRef、layoutOnly 和 toExternalHTML 等路径，为容器包住多个块及导出提供扩展点。[实现](https://github.com/TypeCellOS/BlockNote/blob/main/packages/react/src/schema/ReactBlockSpec.tsx)。
- 官方 Layout Blocks 页面明示 Preview 和未来可能变化。[官方说明](https://www.blocknotejs.org/docs/features/custom-schemas/layout-blocks)。

推断：若强调文档式斜杠和键盘体验，可优先验证 BlockNote 容器；若强调复杂装饰部件拼装，Puck 配置更接近目标。

## 本轮未列为直接复用的其他项目

- [OpenSVG](https://github.com/cailven/opensvg) 有公众号 SVG、点击切换和零高容器，但核查根目录、完整树与 package.json 未见明确 LICENSE 或许可字段，本轮不将公开源码当作已确认授权。[package.json](https://github.com/cailven/opensvg/blob/77fd93c03ef8aa12cfc7895b2f53c1096266d9fd/package.json)。
- [wx-art-formatter](https://github.com/bingo906/wx-art-formatter) 主要走 Markdown/主题排版路线。根目录和 package.json 未见明确许可证，不作为整合首选。[package.json](https://github.com/bingo906/wx-art-formatter/blob/main/package.json)。

## 公众号式长图多装饰的实现方式

以下是基于候选扩展点的 Omnilink 建议，不是各项目现成具备的完整流程。

1. **文章底层**：统一底色或平铺纹理，管理整篇版心。普通文字继续走自然文档流，输入后自动增高。
2. **背景分区**：分区组件拥有背景图、上下装饰、边距和内容 slot，可包住多个标题、段落及图片。
3. **装饰层**：贴纸、花边、角标绑定当前分区的顶部、底部或角落。素材使用透明 PNG 或经过处理的 SVG。
4. **固定构图模块**：自由叠压、复杂边框和不规则构图放进快图画布；保存编辑器版本、JSON、图片地址、原始尺寸和文字替代信息。读者侧展示图片，再次编辑载入 JSON。
5. **长图输出**：保留可编辑文章，分享图片由独立导出层生成。超高画布需验证分段捕获和切片；两套画布候选均未核到自动纵向切片。

整篇自由画布也可由快图承担，此时布局按固定坐标编辑，阅读时图片按比例缩放，位图文字不会随手机宽度重新换行。若要增删文章段落时背景自动延展，应保留文章分区，由画布承担固定构图片段。

## 接入前的最小验证

独立验证四个场景：多个块共用背景、增加正文后背景延展、手机端图文重排、再次打开画布 JSON 并重新导出。另测中文字体、跨域图片以及导出保真。

账号、文件上传、草稿保存、发布和读者页仍需接 Omnilink 的业务接口。当前 package.json 没有上述候选依赖；历史 Puck 网站编辑器已移除，没有现成可调用的文章配置。
