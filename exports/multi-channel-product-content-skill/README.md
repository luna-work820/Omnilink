# 多渠道商品内容 Skill

这是 Omnilink 第一版 `multi-channel-product-content` skill 的可修改包。

当前版本：`0.1.0`

当前能力：

- 小红书文案
- 抖音文案和口播脚本
- 商品详情页文案
- 图片制作 Brief
- 事实与品牌审核清单

当前不包含：

- 图片生成
- 社媒账号授权
- 排期和自动发布
- 渠道数据分析

## 接入位置

- `SKILL.md`：面向产品和模型的行为规则
- `manifest.json`：skill 输入、输出和能力声明
- `workspace-skill-prompts.ts`：当前应用中的 Prompt 实现
- `migration.sql`：数据库注册和版本定义示例

修改 `SKILL.md` 或 Prompt 后，需要同步更新 Omnilink 中对应的应用文件，并递增 skill version。

