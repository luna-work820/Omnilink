# OPTIQUE ATELIER 初始模板

来源为本项目 GitHub 历史版本，不是新增第三方建站引擎。固定提交与文件 blob SHA 见 `source.json`。

- `template.json`：从原 `createDefaultSchema()` 的字面量提取的十个展示区块，不包含 schema 迁移、归一化、数据库或编辑器代码。按项目文案规则替换中点分隔符，图片改用本地路径。
- `OptiqueTemplate.tsx`：保留眼镜模板的标题、分栏、图文、评价、FAQ 和页脚的展示组件。适配当前主题变量、细边界和预览容器宽度。商品仅由 props 传入，不伪造商品记录。
- `public/site-templates/optique/`：原模板引用的三张 Unsplash 图片的本地副本。

模板文案、评价及服务承诺为原始示例内容，当前仅在已标为“初始模板”的私有预览中展示，不代表当前商家的真实经营承诺，不自动发布。没有接回旧 Puck 编辑器、购物车、结账、订单、账号、模板保存和旧发布逻辑。
