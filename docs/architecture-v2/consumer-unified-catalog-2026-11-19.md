# 消费者商品统一目录

Firecrawl 和 Apify 的单页抓取结果先规范化，再写入 Supabase 的 `consumer_catalog_products`。商品页、助手、关键词搜索和向量索引读取同一张表中已发布的商品。向量是目录的派生索引，不保存第二份商品信息。

所有商品共用 `composition`：按顺序保存成分或材料、比例/纯度、原始表述和来源；缺少资料时记录 `unknown / not_provided`，不从商品名称猜测。数据库列由商品 JSON 中的同名字段生成，并提供 JSONB 包含索引。`published` 控制 Discover 展示，`recommendable` 让完整度足够的私有样本可供服务端推荐读取。

来源网址用于去重。相同网址由不同抓取器更新时保留原商品 ID；较早的抓取不会覆盖较新的结果。新商品默认为草稿，已发布商品的后续抓取不会自动下架。商品价格、库存和配送信息只表示采集时能够确认的内容；缺少币种或价格时显示待核价。

## 本地使用

`.env.local` 需要配置 Supabase URL、匿名密钥、服务端密钥以及要使用的抓取服务密钥。密钥只在服务端或本地命令中使用。默认向量模型为 SSD 中的本地 BGE，路径可通过 `CONSUMER_BGE_MODEL_DIR` 覆盖。

抓取单个商品为草稿：

```bash
node --env-file=.env.local scripts/consumer-catalog.mjs --provider firecrawl --url 'https://example.com/product'
node --env-file=.env.local scripts/consumer-catalog.mjs --provider apify --url 'https://example.com/product'
```

确认内容后，可用 `--publish` 重新抓取并发布；命令会增量更新本地 BGE 向量索引：

```bash
node --env-file=.env.local scripts/consumer-catalog.mjs --provider firecrawl --url 'https://example.com/product' --publish
```

导入项目自带的 35 件演示商品并建立索引：

```bash
node --env-file=.env.local scripts/consumer-catalog.mjs --seed
```

首次使用或更换模型后，也可单独建立索引：

```bash
node --env-file=.env.local scripts/consumer-index.mjs --build --allow-model-calls
```

`--no-index` 可暂时跳过索引；索引忙碌或构建失败时，应稍后重新运行索引命令。目录发生变化而索引尚未更新时，搜索会降级为关键词检索，不会把过期向量当作最新结果。自动模式根据关键词结果和软性偏好选择关键词、语义或混合检索；显式指定的检索方式仍然生效。

明确的单个商品词和目录中可识别的关键词无需生成模型解析；复杂表达继续由模型解析。一次搜索复用已读取的公开目录，返回结果和续页时重新核对目录版本。

## 当前范围

- 当前是单商品 URL 导入，解析 JSON-LD、Product microdata 和常见网页元数据；不同商家可能需要单独适配或人工核验。抓取只应针对允许使用的公开页面。
- Apify 使用 `apify/website-content-crawler` 抓取一页并遵守 robots.txt。请求设置了 0.05 美元的按事件收费参数，但该 Actor 按用量计费，该参数不代表所有费用的上限。Firecrawl 和 Apify 的额度与实际收费以各自账户为准。参见 [Actor 计费方式](https://apify.com/apify/website-content-crawler) 和 [Apify 参数说明](https://docs.apify.com/api/client/js/reference/interface/ActorCallOptions)。
- 本地 BGE 不调用付费 Embedding API；部署到其他机器时需要提供模型文件和 Python 依赖，或另行配置可用的向量模型。
- 当前目录最多读取 1000 件已发布商品；超出时会明确报错，需要先增加分页及索引扩展。
- 演示商品迁移和本功能的数据库迁移已应用到 `omnilink-dev`。项目另有既存迁移记录差异，不应直接使用全量推送来处理本功能以外的迁移。
