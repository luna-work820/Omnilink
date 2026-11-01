# Omnilink 全局 UI 约束

本文件是项目唯一的全局 UI 约束来源。实现顺序：用户本轮明确要求 > 用户提供的参考图 > 本文件。先复现指定效果，再使用通用组件。

## 视觉基准

- 参考 shadcn/ui Sidebar 的界面语言：清楚分组、紧凑内容、轻边界、明确但克制的状态。借鉴其层级和表面关系，不照搬导航按钮的形状来设计卡片。
- 页面或截图指定了布局、比例、密度、形状时，以其为准。不要把全站重排成同一套模板。
- 每个视图使用一种连续、接近纯白的冷白背景 `#FCFDFE`。导航区、页面区和卡片默认表面与背景统一，不使用渐变、拼色或装饰纹理。
- 用户提及玻璃效果时，默认使用白色半透明材质；按背景调整透明度以保证内容清晰。只有用户明确指定时才改用其他色调。
- 钴蓝 `#315BFF` 和橙色 `#F18A24` 是仅有的强调色，少量使用；黑、白、灰属于中性色。黑色用于主要按钮，钴蓝用于必要的当前或焦点状态，橙色只用于少量辅助强调。
- 卡片只在悬停或选中时改变底色：悬停用冷灰 `#E9EDF2`，选中用浅钴蓝。默认卡片不增加独立色块。

## 卡片

- 卡片形状由内容和用途决定。使用清晰的矩形轮廓和圆角；卡片保持独立，不使用胶囊或椭圆轮廓。
- 卡片默认融入统一背景。仅悬停或选中时改变卡片底色；未交互的卡片不使用不同底色、阴影或玻璃效果。
- 卡片优先用间距、排版和图片组织内容。减少卡片线框和分割线；确需识别边界时才用低对比细线，禁止重复叠加外框、内框和分割线。
- 列表、商品、资料、媒体卡片可采用不同的方向和比例。商品图片保持适合内容的裁切比例；文字和价格按信息层级排列，不强行套统一卡片高度。
- 图片是主要内容时，图片应占据视图的主要面积并保持大尺寸；上传预览保留原始横竖比例。文字压缩到完成任务所需，能清楚表达时用图标替代标签。

## 控件与布局

- 主要按钮使用黑底白字的药丸形；次要按钮、导航项和输入框按各自功能表达，不被全局形状兜底覆盖。药丸形不用于卡片。
- 图像或图标能准确表达内容时优先使用图像或图标。界面标签尽量使用两个汉字；存在清楚短词时不使用更长同义词。
- 不添加解释性文案、装饰性副标题或重复说明。只保留完成当前任务所需的标题、字段名、状态和操作文字。
- 同一行按视觉中心或基线对齐。仅在设计需要时统一高度；纯图标控件保持视觉居中。
- 选中和状态同时使用文字或图标表达，不只依赖颜色。键盘焦点清晰可见，控件名称对辅助技术可读。
- 窄屏下保留主要内容和操作；空间不足时重排或换行，不裁切交互元素。
- 动效只反馈真实状态变化，不改变布局、不阻断操作，并尊重 `prefers-reduced-motion`。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Skill 使用报告

- 仅当本次实际使用了非 Codex 内置 skill 时，在最终回答末尾添加：`使用的 Skill：\`skill-name\``。
- 如果使用多个 skill，用顿号分隔。
- 如果没有使用 skill，或只使用 Codex 内置能力，则不要添加 Skill 报告。
- 只报告实际加载并影响结果的 skill，不报告候选、推测或未加载的 skill。
- Skill 报告保持简短，不解释安装路径和内部执行过程。

<!-- antislop:start -->
## antislop

For UI and visual work, read the antislop core and UI skill before making changes:
- Core: `/Users/luna/.codex/plugins/cache/anti-slop/antislop/3.2.19/antislop.md`
- UI: `/Users/luna/.codex/plugins/cache/anti-slop/antislop/3.2.19/skills/antislop-ui/SKILL.md`

Before each UI task, ask whether antislop should apply during the work or after it is done.
<!-- antislop:end -->
