# 消费者记忆开源方案调研

调研日期：2026-11-26。范围为对话中的个人偏好和用户确认，不评估项目宣传的性能排行。

## 项目对比

| 项目 | 许可及能力 | 对 Omnilink 的取舍 |
| --- | --- | --- |
| [Mem0](https://github.com/mem0ai/mem0) | Apache-2.0；提供面向用户的记忆提取、检索和管理。其[托管平台的图记忆](https://docs.mem0.ai/platform/features/graph-memory)与开源部署需区分，不能假定托管功能都在本地版本中。 | 功能贴近偏好提取；直接接管持久化会引入第二份记忆源，需要自行衔接现有待确认、证据、撤销和账户隔离机制。具体开源版本的 Postgres 配置与许可范围应在试点前逐项验证。 |
| [Graphiti](https://github.com/getzep/graphiti) | Apache-2.0；面向时间知识图谱。其[快速入门](https://github.com/getzep/graphiti/blob/main/examples/quickstart/README.md)使用 Neo4j，[实体关系实现](https://github.com/getzep/graphiti/blob/main/graphiti_core/edges.py)保留来源 episode 与有效时间。 | 有利于复杂关系与时序变化；图数据库和运行组件会增加运维，当前个人偏好规模不需要先迁移。自动冲突失效不应直接替代用户确认。 |
| [LangMem](https://github.com/langchain-ai/langmem) | MIT；[官方文档](https://langchain-ai.github.io/langmem/)说明提供存储无关的提取原语、后台整理和 LangGraph 存储集成，示例为 Python；进程内存储重启后丢失。 | 提取原语适合借鉴，但现有 Next.js 服务需要额外 Python 运行环境或独立服务。应保留 Supabase 作为权威存储，候选不能直接激活。 |

## 建议

优先保留现有 Supabase 记忆表、来源、版本、用户确认和删除机制。借鉴 LangMem 的结构化提取、Mem0 的候选去重和 Graphiti 的时间与来源概念，在现有服务中先验证候选质量与完整闭环；不要为当前问题引入图数据库或将用户数据发送至外部记忆平台。

后续试点需分别评估：跨轮自述与照片推断的区分、证据可追溯、拒绝及遗忘后的重建、冲突确认、跨账号隔离、延迟和模型费用。本次未安装、运行或基准测试上述项目，适配性是依据公开文档和当前项目架构的判断。
