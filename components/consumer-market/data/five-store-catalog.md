# 五店商品样本

本目录仅用于 demo，保留原有 25 条记录并新增 10 条，共 35 条。发现页使用此目录，不再混入旧收集列表、虚构场景、示例评价和商家演示商品。

| 店铺 | 商品数 | 官方集合入口 |
| --- | ---: | --- |
| CLED | 7 | https://www.thecled.com/collections/ws-best-sellers |
| LEAP STUDIO | 7 | https://leapstudio.shop/collections/all |
| Berhel | 7 | https://berhel.com/ |
| Hooks and Luxe | 7 | https://www.hooksandluxe.com/collections/all |
| Amano Studio | 7 | https://amanostudio.com/collections/all |

## 证据与未知项

- `sourceUrl` 是商品原站地址。新增商品的名称、图片地址、价格和规格依据官方页面或其搜索索引快照；不是实时商品 API。
- `sourceDate` 保留商品资料的采集/整理日期；`catalogEvidence.reviewedAt` 是本次整理日期 2026-11-14，不代表网页在当天实时更新。
- 原有记录的 `previous_capture` 表示规格依据先前采集内容，不声称本次重新获取了完整详情。`indexed_snapshot` 表示本次查阅了官方页面的索引快照。
- 五条旧 Hooks and Luxe 记录未完成当前报价复核，展示为“待核价”。历史金额仅留在历史采集字段，不能作为实时报价。
- 图片保留原站地址，未声明全部图片已完成可用性检测。商品库存默认为未知；On The Horizon 的集合页快照显示售罄，不能据此确认实时库存。
- 配送政策有原站出处；均未提交订单或验证中国大陆地址。地区选择器、英文网站、全球配送说明均不等同于已确认可在中国大陆购买。
- 未添加销量、评分、用户评价、过敏适配结论和统一退换保证。删去了未经核验的集合销量排序字段。

## 使用边界

`mockData.ts` 仅导出本目录商品，其他消费者演示列表为空；`lib/products/demo-data.ts` 的虚构商家样本已停用。旧 JSON 和图片资源可以保留，但不再作为活动商品加载。

发现页和创作者选品库均只使用五店目录。发现页不加载数据库商品和创作者帖子。购物车、收藏和聊天商品附件按当前目录过滤；缓存商品内容从本目录重新读取。前端拒收目录外的搜索商品。

现有自然语言 Discovery 搜索仍读取数据库。本次未导入五店商品到数据库，也未生成向量，因此不能把本次数据整理视为已接通五店语义检索。数据库、模型配置、依赖和部署设置均未更改。
