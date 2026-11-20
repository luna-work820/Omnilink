# Omnilink 商品数据渠道建议

核对日期：2026-11-19。范围是先跑通跨商家商品发现数据流，Impact.com 尚在合作方审核阶段。

## 结论

先用少量明确域名的官方商品页抓取跑通流程，同时联系品牌索取 CSV、XML 或 Google Merchant feed。Impact.com 通过后，再把联盟目录接进同一套规范商品模型，并单独接入跟踪链接和归因。抓取可以提供商品候选数据，但不会自动产生联盟佣金。

## 项目现状

- 当前消费者商品目录是本地 `five-store-demo-products.json`，包含五个商家、35 条样本商品；项目文档明确说明这不是实时商品 API，也还没有导入数据库或接入语义索引。
- `lib/consumer-advisor/external-source.ts` 已有用户提交 URL 后的 HTTPS 抓取能力，包含公开 IP 检查、重定向限制、10 秒超时和 512 KB 上限；目前只抽取标题及最多 6,000 字正文，不会解析 Product、Offer、价格、库存或变体。
- 数据库的 `catalog_sources` 和 `catalog_item_sources` 已能记录来源和字段证据，但来源记录必须归属于商家组织或店铺。`consumer_external_sources` 则归属于用户和会话，并会过期。两者都不是跨商家的公共商品采集目录。

因此可以复用现有 URL 安全检查和字段证据思路，但商品抓取应独立形成“来源登记、采集任务、规范化、待复核、发布到消费者目录”数据流。不要把跨商家抓取记录伪装成某一个商家的 PIM 数据。

## 渠道比较

| 渠道 | 现在可用性 | 适用内容 | 注意事项 |
| --- | --- | --- | --- |
| 官方商品页抓取 | 可先做小范围试跑 | 商品标题、图片、价格、币种、尺码颜色、页面 URL、更新时间 | 先查对应站点条款和 `robots.txt`，尊重限速；字段都标注抓取时间和来源。`robots.txt` 是爬虫规则，不等同访问授权。[IETF RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html) |
| 商品页 JSON-LD | 最适合做第一种解析格式 | `Product`、`Offer`、SKU、品牌、价格、库存、变体 | 页面可能缺字段或过期；用页面内容作为快照证据，不把 Google 富结果资格当成数据授权。[Google Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product/) |
| 商家授权 Feed 或 API | 需要商家配合，但数据稳定 | 完整目录、变体、价格库存更新 | 优先问品牌要 CSV、XML、Google Shopping 格式或 API。Shopify Storefront API 可查询商品和集合；tokenless 访问是技术能力，不代表可对所有商家批量采集，应拿到商家许可。私有 Admin API 应走商家授权。[Shopify Storefront API](https://shopify.dev/docs/api/storefront/unstable#authentication) |
| Google Merchant Center | 适合商家授权导入，不是公共商品搜索 API | Merchant Center 账户中的处理后商品、价格、库存和商品状态 | API 请求必须授权到账户；第三方应用要走 OAuth，且应用需完成验证。[Merchant API 商品列表](https://developers.google.com/merchant/api/reference/rest/products_v1/accounts.products/list)、[第三方账户授权](https://developers.google.com/merchant/api/guides/authorization/access-client-accounts) |
| Impact.com 商品目录 | 审核及品牌合作通过后接入 | 商品 Feed、商品链接、广告素材及后续转化归因 | 需要先加入上传了目录的品牌；可在平台下载、FTP 或 API 获取。目录可选 XML、CSV、TAB。品牌需维护目录，Impact 建议每日更新价格和库存。[Impact 合作方目录说明](https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/marketing-content/product-marketplace-and-catalogs/download-product-catalogs-as-a-partner)、[Impact 申请加入品牌计划](https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/working-with-brands/applying-to-brands/find-and-apply-to-brands) |
| 其他联盟网络目录 | 作为后备渠道评估 | 产品 Feed 和网络深链 | Awin 支持按广告主、类目和品牌配置 Feed；具体可见范围仍受发布者账号、广告主 Feed 和合作关系影响。[Awin Feed 接入](https://success.awin.com/s/article/How-can-I-access-a-Product-Feed?language=en_US)、[Awin Feed 字段和访问说明](https://success.awin.com/articles/en_US/Knowledge/Product-Data-Feed-FAQ) |

## 建议按阶段跑通

### 阶段一：抓取样本闭环

用 `components/consumer-market/data/five-store-catalog.md` 中已经选定的五家店作为种子，只抓商品详情页和明确的官方集合页。按顺序尝试 JSON-LD `Product` / `Offer`，再退回页面元数据和受控 HTML 解析。只抽取页面能证实的字段；价格、库存和配送均保留“采集时快照”语义。

最小规范记录建议包含：

- `source_url`、`canonical_url`、`merchant_domain`、`external_product_id`、`fetched_at`、`content_hash`
- `title`、`description`、`image_urls`、`brand`、`sku`、`gtin`
- `price_amount`、`currency`、`availability`、`variants`，允许为空并保留字段级来源与更新时间
- `source_type`、`authorization_status`、`review_status`、`last_seen_at`、`stale_at`

商品去重先按商家域名加规范 URL 或源商品 ID；不要跨品牌仅凭标题合并。抓取结果进入 staging，复核后再进消费者公开目录和向量索引。某字段缺失或过期时显示未知或待核，不从其他商品补造。

### 阶段二：接商家授权数据

给品牌一个轻量接入选项：上传 CSV/XML、提供固定 Feed URL，或授权 Shopify / Merchant Center。所有来源适配器都写入同一套规范记录，并记录来源 ID、更新时间和字段覆盖。对愿意提供数据的品牌，这通常比为每个店铺长期维护 DOM 选择器更稳。

### 阶段三：Impact 归因

Impact 审核和品牌合作批准后，使用其目录 Feed/API 作为商品更新来源，并按 Impact 规则生成跟踪链接。数据模型里分开保存 `source_url`、`tracking_url`、`network=impact`、`network_product_id`、`tracking_sub_id`。未通过前 `tracking_url` 为空，只能作为未归因的外跳，不能标成联盟链接或预期佣金。

如果某个品牌已批准直接合作但尚未进入 Impact，也可先用品牌提供的 Feed；跟踪参数和转化回传只能用品牌明确提供的方案。Awin 等网络可作为替代集成，但它们也需要账号和广告主关系，不会消除合作审核。

## 抓取边界

- 请求前读取对应域名的条款及 `robots.txt`，遵守可解析规则、速率和访问限制。RFC 9309 明确说明 robots 规则不是访问授权；不绕过登录、验证码、付费墙或反机器人措施。
- 对价格和库存保存观测时间及来源，不宣称实时。Google 的产品结构化数据文档也建议商品数据同时与 Merchant Center feed 核对，说明结构化标记本身不是完整的新鲜度保证。
- 当前通用外链抓取函数只适合“用户给 URL，读取页面摘要”的会话场景。导入公共目录前还需要商品解析、来源版本、更新去重、缺失下架标记、审核发布和消费者索引刷新。

## 官方资料

- [IETF RFC 9309: Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)
- [Google Search Central: Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product/)
- [Shopify Storefront API authentication](https://shopify.dev/docs/api/storefront/unstable#authentication)
- [Google Merchant API overview](https://developers.google.com/merchant/api/overview)
- [Impact.com: Download Product Catalogs as a Partner](https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/marketing-content/product-marketplace-and-catalogs/download-product-catalogs-as-a-partner)
- [Impact.com: Find & Apply to Brands](https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/working-with-brands/applying-to-brands/find-and-apply-to-brands)
- [Awin: How to access a product data feed](https://success.awin.com/s/article/How-can-I-access-a-Product-Feed?language=en_US)
