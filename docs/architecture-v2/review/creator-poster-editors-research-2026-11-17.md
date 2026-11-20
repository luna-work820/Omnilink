# 创作者装饰长图编辑器源码核查

日期：2026-11-17。范围：`ikuaitu/vue-fabric-editor` 与 `dromara/yft-design` 的官方仓库、官方文档和实际导入／导出路径。只下载源文件阅读，未安装依赖、启动项目、执行候选代码或修改应用代码。下文“支持”表示已找到对应实现，未代表端到端运行验收。

## 结论

两者都适合为文章增加“装饰长图模块”：在同一画布中摆放文字、图片、SVG 和底层装饰，保存源 JSON，生成图片供平台文章前端展示。它们采用固定坐标的 Fabric 对象，不提供现成的 Notion 式文档流、段落增删后的自动推挤，或跨原生文章块的背景关联。因此应保留长文编辑器，把画布作为一种可再次编辑的插入模块。这个判断来自两套对象创建、定位和导出实现，而不是把 README 中的“文章长图”解释为完整的文章编辑器。[快图对象创建][K-add]、[快图导出][K-export]、[yft 对象创建][Y-create]、[yft 导出][Y-export]。

如果只在这两套中选一套给 Omnilink 做局部画布，**优先研究快图的 TypeScript core 复用，或将其 Vue 编辑器独立部署后接入**。它的 core 有单独入口、插件接口和 library 构建，画布高度没有查到应用层上限，边界比较容易裁剪。yft 的背景与页面配置更丰富，但 Vue／Pinia／全局画布绑定更深，默认高度上限约 9449 px；适合接受独立 Vue 工具的方案。以上为源码结构推断，未以工期或运行测试作保证。[快图 core][K-core]、[core 构建][K-build]、[yft 画布][Y-canvas]、[yft 尺寸面板][Y-size]。

## 固定核查版本

| 候选 | 官方仓库 | 本轮 `main` 快照 |
| --- | --- | --- |
| 快图 | [ikuaitu/vue-fabric-editor](https://github.com/ikuaitu/vue-fabric-editor) | [`b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889`](https://github.com/ikuaitu/vue-fabric-editor/commit/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889)，提交时间 2026-07-21 UTC |
| yft | [dromara/yft-design](https://github.com/dromara/yft-design) | [`f1328edcd07373267bc372bab19be466c7482fc3`](https://github.com/dromara/yft-design/commit/f1328edcd07373267bc372bab19be466c7482fc3)，提交时间 2026-09-04 UTC |

用户给出的两个仓库名均正确。以下源码链接固定到上述提交，避免后续 `main` 变动影响结论。

## 能力对照

| 核查项 | vue-fabric-editor | yft-design |
| --- | --- | --- |
| 技术栈 | Vue `^3.2.25`、Fabric `5.3.0`、View UI Plus `1.3.7`、TypeScript `5.1.6`、Vite `^4.2.1`。另有 `@kuaitu/core` workspace 包。[依赖][K-pkg] | Vue `^3.4.30`、Fabric `^6.4.1`、Element Plus `^2.7.6`、Pinia `^2.1.7`、TypeScript `^4.9.5`、Vite `^5.4.3`。[依赖][Y-pkg] |
| 贴纸、图片与自由摆放 | 图片、SVG 可作为对象加入当前画布，拖入时换算为画布坐标，有缩放、选中、图层前后调整。[创建][K-add]、[图层][K-layer] | 图片、Path、文本等创建为可操作对象，保存坐标、尺寸与角度，图层可前移、后移、置顶、置底。[创建][Y-create]、[图层操作][Y-layer] |
| SVG | 支持文件、URL 和字符串导入；解析后组合成画布对象，可与其他元素叠放。[SVG 导入][K-import] | 文件导入用 `loadSVGFromString`，生成一个新页面模板；该入口仅取前 1000 个对象。它不是“向当前页面直接插入整组 SVG 贴纸”的同等实现，需要补当前画布插入适配。[文件导入][Y-import] |
| 多层／跨段背景 | 默认工作区是一个底层矩形；背景面板改其 fill。多个图片／SVG／形状可作为普通对象置底，在**同一画布**覆盖多个文本框。未见绑定文档段落的多背景模型。[工作区][K-workspace]、[背景面板][K-bg]、[图层][K-layer] | 页面背景支持纯色、图片、渐变、网格和形状模式；页面背景本身按 fillType 切换，未见任意多个页面背景栈。叠放多个普通图片／Path 对象可构成多层装饰。[背景实现][Y-bg]、[图层操作][Y-layer] |
| 自定义高度／长图 | 尺寸弹窗宽高仅 `min=1`，未设 max；`setSize(width,height)` 直接更新 workspace。能表达固定宽度的高画布，但没有源码证据可保证任意高度在浏览器稳定导出。[弹窗][K-size-ui]、[工作区][K-workspace] | 宽高面板均按 30–800 mm 限制，px 模式同样经过限制。换算函数固定用 `300 / 25.4`，即约 354–9449 px。750×6000 一类长图在配置范围内；750×20000 要改变限制或分模块。[尺寸面板][Y-size]、[常量][Y-size-config]、[换算][Y-unit] |
| PNG | 现成实现，按 workspace 的完整 width／height 调用 `toDataURL`。[导出][K-export] | 现成实现，可选 PNG，按当前页面裁切区域调用 `toDataURL`。[格式选择][Y-export-ui]、[导出][Y-export] |
| JPG／JPEG | 已核查的保存菜单与 `_getSaveOption` 固定为 PNG，没有现成 JPEG 选项；需自己增加 format／背景处理。[菜单][K-save-ui]、[导出][K-export] | 现成 JPEG 选项，格式传给 `toDataURL`，下载扩展名为 `.jpeg`。[格式选择][Y-export-ui]、[导出][Y-export] |
| SVG 导出 | 现成 `canvas.toSVG`，带 workspace viewBox 与字体路径映射。[导出][K-export] | 现成 `canvas.toSVG`，按当前页面 viewBox 导出。[导出][Y-export] |
| 源 JSON 保存／恢复 | `getJson` 用 `canvas.toJSON`，保存扩展字段；`saveJson` 下载 `.json`，`loadJSON` 使用 `loadFromJSON` 恢复并触发导入钩子。[源数据][K-export] | `getJSONData` 序列化当前画布，另存 workSpace、zoom、width、height；下载的是当前画布 `.json`，不是完整 templates 数组。导入入口 `JSON.parse` 后添加模板。[源数据][Y-export]、[导入][Y-import] |
| 纵向切片 | 已核查 PNG 路径一次导出整张，无按高度循环切片。[导出][K-export] | 已核查图片路径一次导出当前画布，无切片或纵向拼接。图片面板虽有“全部页”，处理函数未将 rangeType 传给 exportImage；不能据界面判定批量导出已完成。[面板][Y-export-ui]、[导出][Y-export] |
| 直接当 React 组件 | 完整 UI 为 `.vue`；不能当现成 React JSX 组件导入。core 接收 Fabric Canvas，复用 core 后仍要写 React 控件与生命周期管理。[Vue 页面][K-home]、[core][K-core] | 完整应用由 `createApp` 挂载 Vue、Pinia 和路由；导出 hook 依赖这些状态，未见现成 React 组件边界。[启动][Y-main]、[画布][Y-canvas]、[导出][Y-export] |

### 连续长图的具体边界

1. **连续视觉可行。** 在一张高画布内，底纹、花边、贴纸可以跨多个文本框，导出后成为连续图片。这里的“段落”是同一个画布里的文本对象；文章编辑器外面的段落没有进入画布布局模型。[快图对象坐标][K-add]、[yft 对象坐标][Y-create]。
2. **没有现成的自动长高。** 快图根据用户尺寸设置 workspace；yft 根据模板 width／height 设置页面。已核查路径没有“文字增加后自动扩高画布并移动下方装饰”的文档流处理。[快图 setSize][K-workspace]、[yft 页面状态][Y-store]。
3. **多页不等于一张连续长图。** yft 有模板数组、切换页面和缩略图画布，但图片导出器仍取当前 `useCanvas()`。`setSize` 还会遍历全部 templates 改宽高；不能默认多个页面可以各用不同尺寸。[页面状态][Y-store]、[导出][Y-export]。
4. **没有得到任意长度的保证。** 两套都把整块区域送进 `toDataURL`。若要稳定支持超长文章，需要自行规定模块高度，或增加分块渲染／切片，再测试目标浏览器、字体及复杂素材。本轮没有运行内存、画布极限或导出性能测试。[快图导出][K-export]、[yft 导出][Y-export]。

## 许可证原文及素材边界

以下只陈述仓库文本与已核查范围，不作为法律保证。

| 项目 | 原文与声明 | 适用边界／不一致 |
| --- | --- | --- |
| 快图 | 根 [LICENSE 原文][K-license] 为 MIT，版权行为 `Copyright (c) 2022 秦少卫`；[README][K-readme] 声明使用 MIT。 | MIT 文本允许使用、复制、修改、发布、分发、再许可和销售软件副本；要求在软件的副本或实质部分保留版权与许可声明，并含不担保和责任限制。**core 的 package.json 另写 `license: ISC`，本轮树中未找到 core 单独许可证文本；需要在选用包或分发产物时核清这个元数据不一致。**[core 包元数据][K-core-pkg] |
| yft | 根 [LICENSE 原文][Y-license] 为 MIT，版权行为 `Copyright (c) 2023 Nevermore`；[README][Y-readme] 同样声明 MIT。 | 根 LICENSE 具有相同的授权条件、保留声明要求和不担保文本。已核查的 LICENSE、README、docs/api.md 未出现必须购买 Pro、禁止商用或禁止同类业务的额外代码许可条件。[API 文档][Y-api-doc] |

快图 README 明确区分开源前端和另售的完整前后端／管理后台；yft README 列出 Demo 与 Pro。上述产品版本说明不能当作公开仓库以外的后端、Pro 功能或在线服务授权。[快图版本说明][K-readme]、[yft 版本说明][Y-readme]。

**素材、模板、字体的可用范围仍需单独确定。**

- 快图通过 `/api/materials`、`/api/templs`、`/api/fonts` 等接口取得素材，仓库还带有汉体、华康金刚黑字体引用。本轮没有找到这些在线资源逐项的商业使用授权，不能从代码 MIT 推定素材或字体全部可商用。[资源 API][K-material-api]、[字体引用][K-font]。
- yft 的图片、插画、模板、字体也由独立接口加载，仓库有若干 TTF 字体文件。本轮没有核到这些远程内容逐项的许可范围，也没有对字体或模板权属作认定。[图片与插画 API][Y-image-api]、[模板 API][Y-template-api]、[字体 API][Y-font-api]、[字体目录][Y-font-dir]。
- 检索两套本轮 Git tree 中的 LICENSE／LICENCE／NOTICE 文件名，均只有根 LICENSE；这不等于已经审计全部第三方依赖或二进制资产。Omnilink 可先接入用户上传、自己制作或已明确获授权的素材，避免依赖演示站图库的可访问性与未核清的授权。

## React 19／Next.js 16 接入工作量

以下为基于模块依赖关系的工程判断，未做运行验证，也不提供天数估算。

| 接入形式 | 快图 | yft | 对 Omnilink 的影响 |
| --- | --- | --- | --- |
| 独立 Vue 编辑器，通过 iframe／独立编辑路由打开 | 相对较小。保留原 Vue UI，替换素材、保存及回传入口。 | 相对较小到中等。保留 Pinia 与自定义对象注册，裁掉不需要的页面、后端功能。 | 两者都要自行增加 JSON 载入、保存／取消、导出图片返回的通信接口。现成导出主要是触发浏览器下载，不能直接当“发布到 Omnilink”的 API。依据：[快图导出][K-export]、[yft 导出][Y-export]。 |
| 将完整 Vue 编辑器挂在 React 管理的 DOM 容器 | 中等到较大。需维护 Vue 运行时、组件编译、样式与挂载／卸载。 | 较大。还要保留路由、Pinia、全局扩展注册和相关插件。 | 它们各自的 Vite 构建和 `.vue` UI 不能直接由 React 组件复用；隔离为独立前端通常边界更清楚。依据：[快图页面][K-home]、[yft 启动][Y-main]、[yft Vite][Y-vite]。 |
| 复用底层对象能力，写原生 React 编辑面板 | 中等到较大。core 的 `init(canvas)`、`use(plugin)` 与独立 library 构建提供了实际拆分点。 | 较大。useCanvas 是模块级单例，hook 反复依赖 Vue refs、Pinia store 和应用路径，需要先抽离状态与画布能力。 | 这条路能让编辑控件融入 Omnilink，但并非拿现成编辑器即可完成。依据：[快图 core][K-core]、[core 构建][K-build]、[yft 画布][Y-canvas]、[yft 导出 hook][Y-export]。 |

两者都直接使用 DOM、Canvas、文件和浏览器下载，编辑端应放在浏览器运行边界内。若复用快图 core，还要处理 `WorkspacePlugin` 固定查询 `#workspace` 的假设，并补足卸载时 Canvas、观察器、快捷键和事件的清理；`Editor.destory()` 当前只是清空字段，不能据方法名认定已完整清理。这个注意点来自具体源码，尚未验证在 React 重挂载下的表现。[工作区初始化][K-workspace]、[Editor 生命周期][K-core]。

云保存和素材库也不是随画布自然得到：快图开源 README 仅承诺前端，`useMaterial` 的保存通过上传图片再创建／更新模板接口完成；yft 的 PDF／PSD 导出和部分文件解析需要 API 服务。当前需求只做 PNG／JPEG／SVG 与 JSON，可以先绕开这些扩展服务，但仍需接 Omnilink 自己的文件与草稿保存。[快图云保存][K-cloud]、[yft 文件 API][Y-file-api]、[yft 本地导出][Y-export]。

## 作为文章“装饰长图模块”的最小接法

这是本轮需求下的接入建议，不是候选已有的 Omnilink 集成功能。

1. 在文章添加组件菜单里放一个长图入口。进入单张画布编辑，模块宽度与文章展示宽度保持约定；画布内允许文字、SVG、图片和背景自由叠放。
2. 保存时同时取得**源 JSON**和**渲染图片**。快图已有 `getJson()`／`preview()`，甚至已有同时保存 JSON 与预览图的云保存示例；yft 有 `getJSONData()`，但图片导出需要从“下载文件”改为“返回图片 Blob／上传结果”。[快图预览与 JSON][K-export]、[快图保存示例][K-cloud]、[yft 源数据与导出][Y-export]。
3. 文章草稿记录编辑器种类／版本、源 JSON 所在位置、图片地址、原始宽高和必要的文字替代内容。再次编辑使用源 JSON；前端阅读使用图片，按原比例缩放。这样读者侧无需加载 Vue 或 Fabric。JSON 包含编辑器自定义对象与外部图片／字体依赖，不能认为任意版本之间天然兼容。[快图扩展序列化][K-export]、[yft 序列化字段][Y-export]、[Fabric 官方序列化说明](https://www.fabricjs.com/docs/old-docs/fabric-intro-part-3/#serialization)。
4. 需要“跨段背景”时，先区分范围：若仅跨长图内的文本框，画布即可；若要跨多个原生文章段落，并在增删文字后自动延展，应由文章编辑器的分组／容器模块处理。单独插入一张画布图片不会自动装饰画布外的正文。[快图坐标布局][K-add]、[yft 文本对象布局][Y-create]。
5. 首版可以按内容拆成若干长图模块；若要求一张很长的完整文章图片，再实现可控高度的切片导出。两个候选的已核查导出器都未提供这条流程。[快图完整区域导出][K-export]、[yft 当前区域导出][Y-export]。

导出为 PNG／JPEG 后，画布里的文字和装饰都成为像素，图片内的文字不再是平台的可选择正文，文字链接也不会随图片导出变成交互链接。这是两套位图导出方式的直接结果。因此普通正文继续保留文本，只有确实需要固定构图的部分进入长图模块；需要检索的文字另存为模块文字内容。[快图位图导出][K-export]、[yft 位图导出][Y-export]。

## 尚未验证

- 未验证真实编辑器启动、复杂 SVG 的保真度、中文字体等待、历史记录恢复、跨域图片导出和大画布内存表现。
- yft SVG 导入入口保留 1000 个对象，图片“全部页”范围未传入执行层，这两点是源码可见边界，不是运行故障复现。[导入][Y-import]、[导出面板][Y-export-ui]。
- 未审计所有依赖、字体、模板和线上素材的许可证，也未获得 Pro／后端代码或服务的额外授权。
- 暂不研究或接入 AI 排版，仓库中的相关入口不构成本轮采用理由。

[K-license]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/LICENSE
[K-readme]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/README.md
[K-pkg]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/package.json
[K-core-pkg]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/packages/core/package.json
[K-core]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/packages/core/Editor.ts
[K-build]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/packages/core/vite.config.ts
[K-home]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/src/views/home/index.vue
[K-add]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/packages/core/plugin/AddBaseTypePlugin.ts
[K-import]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/src/components/importFile.vue
[K-layer]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/packages/core/plugin/LayerPlugin.ts
[K-bg]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/src/components/bgBar.vue
[K-workspace]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/packages/core/plugin/WorkspacePlugin.ts
[K-size-ui]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/src/components/common/modalSzie.vue
[K-export]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/packages/core/ServersPlugin.ts
[K-save-ui]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/src/components/save.vue
[K-material-api]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/src/api/material.ts
[K-font]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/src/assets/fonts/font.css
[K-cloud]: https://github.com/ikuaitu/vue-fabric-editor/blob/b3bdcfb0bd6d8f98e7483cf561ac03ba56c0d889/src/hooks/useMaterial.js
[Y-license]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/LICENSE
[Y-readme]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/README.md
[Y-pkg]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/package.json
[Y-main]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/main.ts
[Y-vite]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/vite.config.mts
[Y-create]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/hooks/useHandleCreate.ts
[Y-layer]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/hooks/useHandleTool.ts
[Y-bg]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/views/Editor/CanvasRight/Backgrounds/index.vue
[Y-size]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/views/Editor/CanvasRight/CanvasStylePanel/index.vue
[Y-size-config]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/configs/background.ts
[Y-unit]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/utils/image.ts
[Y-export]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/hooks/useCanvasExport.ts
[Y-export-ui]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/components/FileExport/ExportImage.vue
[Y-import]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/components/FileUpload/index.vue
[Y-store]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/store/modules/template.ts
[Y-canvas]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/views/Canvas/useCanvas.ts
[Y-api-doc]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/docs/api.md
[Y-image-api]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/api/static/image.ts
[Y-template-api]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/api/template/index.ts
[Y-font-api]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/api/static/font.ts
[Y-font-dir]: https://github.com/dromara/yft-design/tree/f1328edcd07373267bc372bab19be466c7482fc3/src/assets/fonts
[Y-file-api]: https://github.com/dromara/yft-design/blob/f1328edcd07373267bc372bab19be466c7482fc3/src/api/file/index.ts
