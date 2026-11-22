# 服装与饰品分类和属性研究

核对日期：2026-11-20。目标是为商品搜索、分类及浏览后的细化选项寻找公开词表，不把词表当作实时商品数据。

## 推荐来源

### Shopify Product Taxonomy

[项目仓库](https://github.com/Shopify/product-taxonomy)提供商品类别、属性及属性值；[分类列表](https://raw.githubusercontent.com/Shopify/product-taxonomy/main/dist/en/categories.txt)可查到服装以及珠宝分支，包括连衣裙、上衣、耳环、项链、戒指等。[属性列表](https://github.com/Shopify/product-taxonomy/blob/main/dist/en/attributes.txt)包含饰品材质等属性。主分支分类文件标注为 unstable；实际采用应锁定稳定发行版本，保存来源、版本和类别 ID。

项目 [README](https://github.com/Shopify/product-taxonomy/blob/main/README.md)声明 MIT 许可，[许可文件](https://github.com/Shopify/product-taxonomy/blob/main/LICENSE)要求在副本或实质部分中保留版权及许可声明。仓库支持多语言本地化；[翻译配置](https://github.com/Shopify/product-taxonomy/blob/main/translation.yml)列有简体和繁体中文，但这份配置明确对应退货理由，**不能据此断言所选发行版的服装及饰品类别、属性均有完整中文翻译**。接入前应逐字段核对翻译覆盖及实际文件路径，缺失时用人工审核的中英别名补充。

此分类词表并不包含可直接售卖的实时商品、价格或库存；它与 Shopify Global Catalog 商品 API 是不同资源，后者有独立的[缓存和使用规则](https://shopify.dev/docs/agents/catalog)。

### FashionStylist

[FashionStylist](https://github.com/recsys-benchmark/FashionStylist)包含中英文穿搭与单品标注，字段包括类别、风格、廓形、材质、颜色、图案和细节，单品分类中有宽泛的 accessory。它可供研究服装细化维度，但不是完整珠宝细分词典，也不是实时商品目录。其[数据许可](https://github.com/recsys-benchmark/FashionStylist/blob/main/LICENSE)为 CC BY-NC 4.0，商业使用前应取得许可，不应将数据直接用于商业产品。

### MMFashion / DeepFashion

[MMFashion](https://github.com/open-mmlab/mmfashion)是 Apache-2.0 的视觉时尚分析工具；其[数据说明](https://github.com/open-mmlab/mmfashion/blob/master/docs/dataset/ATTR_DATASET.md)展示纹理、面料、形状、部位和风格等标注维度。适合参考视觉属性模型，不是现阶段直接可用的跨商家商品分类库；工具代码许可不代表相关数据、模型权重或图片自动获得商业使用授权。

## Omnilink 建议

1. 以 Shopify 稳定版服装和饰品分类作为可选分类基础，保留版本、ID、来源及 MIT 许可；只引入所需分支，并审核中文别名。
2. 服装优先整理品类、颜色、材质、图案和轮廓；饰品优先整理品类、颜色、金属或其他材质、宝石、工艺与形状。具体问题只展示当前结果中有可靠证据的属性。
3. 复古、哥特、法式等风格属于语义和审美概念，另建可审校的中英文软标签；不得把缺少证据的商品硬标为某风格，也不应因为缺少标签自动排除商品。
4. 商品事实仍来源于已发布统一目录，保留原文、采集时间与证据；词表只负责规范化和帮助检索。颜色与材质等明确约束应有可靠商品证据，风格默认用于召回和排序。
5. 实际浏览 30 件再提示；若当前结果不足 30 件则不触发。可展示的选项需先按实际商品覆盖率生成，避免让用户选到空结果。

项目现状：`lib/products/consumer-catalog-ingest.ts` 当前主要按名称识别项链、耳饰、手链和戒指，未完整分类服装；`lib/consumer-advisor/search-spec.ts` 有部分服装及饰品同义词；现有细化问题集中在家具。上述内容是研究建议，并非已接入的新功能。
