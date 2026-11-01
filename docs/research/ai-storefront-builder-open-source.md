# AI 网页生成开源项目调研

调研日期：2026-10-16。目标是为 Omnilink 的「网页设计」寻找可参考的生成、迭代编辑和基础模板方案。以下判断基于项目仓库公开说明和当前 Omnilink 代码；尚未把第三方项目接入或做运行基准测试。

| 项目 | 已有能力 | 许可与接入判断 |
| --- | --- | --- |
| [OpenPage](https://github.com/buildingopen/openpage) | 提示词生成结构化页面 JSON；19 种区块、42 种版式、10 套主题；可视化编辑与 HTML 导出。 | MIT。与 Omnilink 现有 JSON 店铺 Schema 最接近，适合作为「区块类型 + 版式变体 + 主题」的设计参考。其区块以营销页为主，商品、集合、购物流程仍要由 Omnilink 自己设计和绑定。 |
| [Puck](https://github.com/puckeditor/puck) | React 可嵌入的拖拽页面编辑器；开发者注册组件，保存页面数据并用同一配置渲染。 | MIT。适合评估是否替换/增强当前编辑画布；本身并非完整 AI 生成器，仍需 Omnilink 的 AI 生成与局部修改逻辑。 |
| [Onlook](https://github.com/onlook-dev/onlook) | 从文字/图片或预制模板建站；在浏览器中可视化编辑 Next.js + Tailwind 代码，并用 AI 修改。 | Apache-2.0。适合参考「选中元素 → 对话修改 → 预览/检查点」交互；其代码容器和代码级编辑架构比商家店铺页面所需更重。 |
| [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) | 对话生成、运行、编辑与部署完整 Web 应用，支持多模型。 | 代码 MIT，但所用 WebContainers API 有独立商业许可条件。适合参考对话和预览工作流；不建议作为店铺编辑器底座直接嵌入。 |
| [Open Lovable](https://github.com/firecrawl/open-lovable) | AI 创建 React 应用，重点是抓取并重建已有网站。 | MIT；需 Firecrawl 与沙箱服务。适合研究参考网页导入，不适合作为原创店铺基础模板来源。 |

## 对 Omnilink 的结论

1. 保留 `lib/storefront/schema.ts` 的结构化页面和现有草稿/发布链路。优先参考 OpenPage 的版式变体机制，为每种店铺区块提供多种经过人工设计的布局；AI 选择版式、组合区块、填入真实品牌和商品数据。
2. 先设计少量完整的商业基础模板，例如「品牌叙事」「商品目录」「活动转化」。模板应覆盖首页、商品集合、商品详情的视觉规则，并明确商品数据绑定、图片比例、移动端版式、空数据状态；不能只换配色或文案。
3. AI 修改应返回针对现有页面 Schema 的局部变更，保留商家已有商品、链接和手动修改；每次修改先预览，再保存为草稿，最后由商家发布。
4. 当前 `app/actions/ai-template.ts` 强制固定 10 个区块的顺序，所以生成结果难以呈现不同的整页设计。开展生成式网页设计前，应改为按基础模板和目标选择区块及版式，并禁止编造评价、联系方式和社交地址。
5. Puck 可作为后续编辑器选型试点，但先验证它与当前 `StorefrontSchema`、预览渲染和发布流程的适配成本。无需为首版引入代码沙箱。

补充商业页面参考：[Vercel Next.js Commerce](https://github.com/vercel/commerce) 提供完整店铺前端结构，但当前官方重点维护 Shopify 版本。可参考其商品页、集合页和购物流程，不能直接替换 Omnilink 的商品数据层。
