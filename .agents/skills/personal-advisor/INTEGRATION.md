# Omnilink 接入

用户提供的 `personal-appearance.zip`（1.6.0）替换本目录旧 Skill，展示名为「形象助手」。保留应用中的 `personal-advisor` 标识以兼容账号启用状态和固定入口；包内技术名称仍为 `personal-appearance`。

服务端以本目录 SKILL.md 为规则来源，根据本轮主题加载固定路径的参考文件。聊天和图片分析均显式传递 Skill 标识，激活状态按会话隔离；普通助手不依赖此 Skill。

包内脚本保留为资源，当前模型没有 Python 执行、文件读取或成分核验工具。接入层明确要求文字选项回退，不得声称执行脚本或完成安全性、现行法规核验。预生成示意图复制到 public/consumer-market/skills/personal-assistant。

原始旧版 SKILL.md 在本机备份到 /private/tmp/omnilink-personal-advisor-before-replacement/SKILL.md。用户提供的源压缩包未修改。
