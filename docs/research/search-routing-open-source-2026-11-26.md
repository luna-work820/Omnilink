# 搜索与无生成式模型路由选型

调研日期：2026-11-26。以下为候选方案，不代表已在 Omnilink 数据上验证。

| 方案 | 定位与中文 | 许可证与部署 |
| --- | --- | --- |
| Typesense | 中文字段可配置 locale，支持关键词与向量混合排序；复杂中文分词可评估预分词。见[语言支持](https://typesense.org/docs/guide/locale.html)、[混合搜索](https://typesense.org/docs/26.0/api/vector-search.html)。 | [GPL-3.0](https://github.com/typesense/typesense)；独立部署搜索服务，需同步索引并评估内存与运维。 |
| Meilisearch | 支持混合搜索；1.15 改进中文分词，升级已有中文数据须重建索引。见[项目](https://github.com/meilisearch/meilisearch)、[中文分词说明](https://www.meilisearch.com/blog/meilisearch-1-15)。 | 社区版 MIT，自托管；企业版许可不同，部署时核对具体版本和功能。见[许可说明](https://www.meilisearch.com/blog/enterprise-license)。 |
| Aurelio semantic-router | 用示例语句的向量相似度选择预设路由，低于阈值可回退；不需生成式 LLM 调用，但需要 embedding 模型。中文效果取决于模型和示例，须实测。见[官方介绍](https://www.aurelio.ai/semantic-router)。 | MIT，Python 库；可用本地编码器和索引，也可依赖外部服务，需考虑模型资源及跨语言集成。 |
| Supabase Postgres + pgvector | 官方示例以全文检索和向量检索分别召回，再用 RRF 融合；中文需另行解决分词，不能直接照搬英文示例。见[混合搜索](https://supabase.com/docs/guides/ai/hybrid-search)、[扩展列表](https://supabase.com/docs/guides/database/extensions)。 | [pgvector 使用 PostgreSQL 许可证](https://github.com/pgvector/pgvector/blob/master/LICENSE)；需要模型生成向量、维护索引和融合 SQL。Supabase 列出 PGroonga，但应先确认目标部署版本可用并验证中文效果。 |

建议先用明确规则和关键词处理可确定的路由，保留未知回退；只有规则覆盖不足时再评估语义路由。若已有 Postgres，优先做 pgvector 与中文检索的最小验证；若需要独立的搜索体验，比较 Meilisearch 社区版和 Typesense。用真实中文查询评估路由准确率、低置信回退、关键词与混合检索召回和延迟，再决定是否引入新服务。向量编码不是生成式 LLM，但仍有模型部署、延迟及许可证成本。
