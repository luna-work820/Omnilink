# 自适应助手流程与生成式 UI 项目调研

调研日期：2026-11-07。目标：比较能按用户意图分支技能流程、并把不同类型的结果呈现在同一对话中的开源项目。未接入或运行基准测试。

| 项目 | 定位与能力 | 许可及 Omnilink 适配 |
| --- | --- | --- |
| [Mastra](https://mastra.ai/docs/workflows/control-flow) | TypeScript 工作流，可用 `.branch()` 按分类/条件选择不同步骤，也支持 agent、工具和可恢复状态。 | 核心 Apache-2.0；`ee/` 目录下部分功能使用企业许可。[仓库许可说明](https://github.com/mastra-ai/mastra)。适合在现有 Next.js/TypeScript 服务端实现意图路由和技能流程。 |
| [LangGraph.js](https://docs.langchain.com/oss/javascript/langgraph/thinking-in-langgraph) | TypeScript 状态图；节点可分类意图、检索、生成，并依据状态走条件边；支持检查点和会话线程。 | MIT。[仓库](https://github.com/langchain-ai/langgraphjs)。控制力强，适合分支多、需要恢复/人工确认的流程，抽象层级比 Mastra 低。 |
| [Dify](https://www.dify.ai/workflows) | 可视化编排，含 Question Classifier、If/Else、检索、工具和 Chatflow；适合快速试验流程。 | Dify Open Source License，基于 Apache-2.0 但有附加条件；多租户托管及界面品牌修改有额外限制。[许可](https://github.com/langgenius/dify/blob/main/LICENSE)。更适合作为流程原型参考，嵌入现有产品前需评估许可和独立运行成本。 |
| [CopilotKit](https://docs.copilotkit.ai/agent-spec/generative-ui/display) | 前端生成式 UI：agent 调用注册好的 React 组件，可在聊天消息中呈现卡片、表格等；CopilotKit 仓库为 MIT。 | [仓库许可](https://github.com/CopilotKit/CopilotKit)。它解决 UI 显示，不替代后端工作流；较新的跨页面 Components and Surfaces/A2UI 能力仍标为 experimental。[文档](https://docs.copilotkit.ai/deepagents/generative-ui/components)。 |
| [Vercel AI SDK](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage) | Next.js/React 工具调用与流式消息；前端可按 typed tool parts 渲染交互、加载状态和工具结果。 | Apache-2.0。[仓库](https://github.com/vercel/ai)。适合做消息流和 UI 层，不是带条件图的工作流引擎。 |

## 建议

Omnilink 适合采用“Mastra 工作流 + 现有消费者聊天 UI”的组合：统一入口先做意图分类，再分到个性化商品搜索、普通搜索、商品问答、图片/文件分析等步骤；每条路径返回固定结构的数据，前端在同一消息流里按结果类型渲染答案、商品列表或补问卡片。若需要逐步显示工具过程，可评估 Vercel AI SDK；若需要 agent 直接选择已注册的 React 展示组件，再评估 CopilotKit。

把 Dify 用于可视化验证意图分支是可行的，但不要未经许可核查就将其作为多租户产品底座。工作流引擎决定“走哪些步骤”，生成式 UI 决定“结果怎样呈现”；这两者通常是组合，而非单一项目同时解决。
