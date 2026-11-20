# P3 体验验收

日期：2026-11-14。基线 HEAD：`31aab821739549f51f6330019e05b7b6166da5b1`，包含当前 P1/P2 与本轮修复的未提交改动。

**结论：本地交互通过，离线检索已完成实测并保留英文未命中样例；真实端到端 Demo 暂不放行。**

本次没有调用收费模型 API、写远程数据库、应用迁移、修改环境文件、安装依赖或部署。模型实测仅使用本机 BGE 和现有 35 件真实商品。

## 验收证据与边界

| 层级 | 结果 | 本次实际验证的范围 |
|---|---|---|
| 真实前端与隔离 HTTP | 24 项通过 | 实际 Next 应用、DOM、键盘与交互，后端响应由测试替身提供 |
| 商品图片 | 35/35 加载，HTTP 200 | 真实公开主图 URL，没有调用模型服务 |
| 中英文关键词 | 3 对结果与顺序一致 | 耳环 19、项链 7、戒指 8，Embedding 0 次 |
| 真实本地 BGE | 中文 6/6，英文 5/6 目标进入前三 | 6 对人工根据商品事实标注的小样本，512 维，35 条商品向量、12 条查询向量 |
| 金标准硬条件 | 恰好 6 件，预期 ID 全部一致 | 手工提供 Search Spec，USD ≤ 100、耳饰、排除珍珠；未调用自然语言解析器 |
| 配送资格 | 已验证可配送中国大陆为 0 件 | 当前商品均无这项确认记录，不将“未核验”文字当作已满足 |
| 全量回归 | 47 文件、324 测试通过 | 包括共享资格判断、游标、上下文版本、租约、权限和降级 |
| TypeScript / ESLint | 通过，无错误 | 界面保留原有警告，新验收脚本无警告 |
| 实际开发库 | P1/P2 新结构缺失 | 通过 Supabase 连接器只读确认，不是根据超时推断 |
| 真实自然语言解析、Qwen、向量 RPC | 待验收 | 没有收费 API 调用，未执行持久索引构建 |

机器证据：

- [检索与真实 BGE 结果](p3-retrieval-evidence-2026-11-14.json)
- [浏览器场景、图片与请求记录](p3-browser-evidence-2026-11-14.json)
- [开发库只读就绪检查](p3-readiness-evidence-2026-11-14.json)

真实 BGE 文件 SHA-256：`15b717c382bcb518ba457b93ea6850ede7f4f1cd8937454aa06972366cd19bcc`。商品 JSON SHA-256：`275ec4953dc80fc967a27bac5606e36866ffccbf33f56542f8d5d38fc2fefc4d`。

完整检查向量保存在 `/tmp/omnilink-p3/local-bge-vectors.json`，没有写入数据库。可用下方命令重新生成。

## 浏览器验收

实际执行并通过：

1. 中文 composition Enter 与 keyCode 229 不发送，保留输入内容。此项使用浏览器事件模拟，尚未替代真人原生输入法复测。
2. 普通 Enter 发送，Shift+Enter 保留换行且不发送。
3. 中英文品类测试词为 `耳环`、`earrings`、`项链`、`necklace`、`戒指`、`rings`，每次切换均显示相应结果。
4. 只切回答模型不刷新商品检索。
5. 全部 35 件按 20 + 15 加载，ID 不重复。
6. 旧结果有 nextCursor 时，新检索 start 失败后重试仍然是同一 start 和新 Profile。
7. page 失败后重试仍然是同一 page。
8. 过期游标触发新 start，保留原 Search Spec。
9. 语义降级显示明确提示并保留关键词结果。
10. 零结果不补入初始商品。
11. 旧搜索迟到不会覆盖新查询。
12. 停止输出后迟到 Token 不再追加，并能继续发送下一条。
13. 请求中发起新会话，旧响应不进入新会话。
14. 1280px、390px、320px 下没有横向溢出；检索选择控件高 44px；Escape 关闭菜单并归还焦点。
15. 系统明暗主题下菜单选择文字对比度分别约 16.20:1、15.52:1，超过普通文字 AA 标准。截图在现有颜色过渡结束后保存。
16. Runtime exceptions 为 0。

结构化报告将多个品类及屏宽拆开，共记录 24 项。浏览器中消费者真实 API 被屏蔽，使用真实商品数据的模拟 HTTP 响应；图片检查阶段单独开放公开图片读取，继续屏蔽模型域名和消费者 API。

截图与原始日志：

- `/tmp/omnilink-p3/experience-light.png`
- `/tmp/omnilink-p3/experience-dark.png`
- `/tmp/omnilink-p3/experience-320.png`
- `/tmp/omnilink-p3/browser-run.log`

## 真实 BGE 小样本

| 查询目标 | 中文目标排名 | 英文目标排名 |
|---|---:|---:|
| 蜜蜂耳钉 | 1 | 1 |
| 回收玻璃花瓣耳钉 | 1 | 2 |
| 黑玛瑙银耳饰 | 1、2 | 1、2 |
| 再生银宝石戒指 | 1 | 5 |
| 淡水珍珠戒指 | 1 | 1 |
| 螺旋吊坠项链 | 1 | 1 |

英文 `recycled silver gemstone ring` 的目标 `Liquid Band Gemstone Ring` 排第 5；前三为 Liquid Band Ring、Ebb And Flow Ring、Silver Lining Ring。保留这一未命中结果，没有为了通过而调整样例或排序。

这是带有明确品类范围的离线精确 cosine 检查，使用实际生产模块的商品预处理、BGE 适配器与共同资格判断。它没有验证真实解析器、数据库向量 RPC、HNSW 或云端部署。样本不能代表整体中英文准确率，也没有据此判定 BGE 优于或劣于 Qwen。

本机 3 次本地 Embedding 批处理：24 件商品约 591 ms、11 件约 287 ms、12 条查询约 135 ms。批处理时间不等于用户单次查询延迟，不含数据库、网络、解析和展示。

## 本轮修复

| 问题 | 修复与验证 |
|---|---|
| 中文输入法确认候选会被当作 Enter 发送 | 检查 nativeEvent.isComposing 与 keyCode 229；浏览器事件验收通过 |
| 切换失败后“重试”可能给旧 run 续页 | hook 保存失败 payload、append 与 Spec；按失败操作重试；过期才以同一 Spec 新建搜索 |
| 个人偏好保存警告出现无效搜索重试按钮 | 单独标记 MEMORY_WARNING，不显示搜索重试按钮 |
| 数据库搜索错误被描述为模型无法回答 | 已有 retrySpec 时显示商品搜索未完成 |
| “配送未核验”可能因文本命中被当作配送资格 | 政策与核验字段不参与商品硬属性词匹配；新增 deliveryCountry / requireVerifiedDelivery，只依据明确 verifiedDeliveryCountries 证据；现有 35 件均未添加该证据 |

配送证据与 Search Spec 是追加字段，继续复用商品目录与搜索快照，没有增加第二套商品主表或记忆系统。

## 真实 Demo 放行条件

只读确认本地配置所指的开发项目 `omnilink-dev` 位于 `ap-southeast-1`，实例状态 ACTIVE_HEALTHY：

- `consumer_discovery_runs` 已存在。
- `execution` 列不存在。
- `consumer_embedding_profiles`、`consumer_catalog_vectors` 不存在。
- `read_consumer_discovery_execution` RPC 不存在。

本执行环境直连 REST 元数据查询超时，另一次只读连接探测遇到 ECONNRESET。连接器可以读取库结构，不能据此判定本地应用到 REST 的连接已恢复。

放行前还需：

1. 审查并应用 P1/P2 两份已有迁移，然后验证真实关键词 start / page / resume / refine。
2. 在目标部署环境验证实际配置与网络；若选 BGE，验证 Python、ONNX 与模型文件可用，再显式构建所选 Profile。
3. 在允许调用模型 API 后，验证真实自然语言解析、回答与所选云端 Embedding；检查次数、Token、失败降级和真实向量检索。
4. 真人复测中国与海外网络、实际手机和原生中文输入法。

本次没有完成这些部署动作，因此没有给真实端到端或对外测试标记通过。当前商品价格、库存、配送与购买资格仍按已有来源证据表达，不因验收而升级为实时确认。

## 重复执行

关键词与硬条件，零模型调用：

```sh
node scripts/consumer-p3-acceptance.mjs
```

真实本地 BGE，无云端模型 API、无数据库写入：

```sh
node scripts/consumer-p3-acceptance.mjs --local-bge
```

本地浏览器体验与真实图片，消费者 API 使用隔离替身：

```sh
node scripts/test-consumer-experience.mjs --check-images
```

浏览器命令只接受 loopback 地址。默认使用当前 Mac 已安装的 Chrome；其他环境可通过 CHROME_PATH 指向已有浏览器。所有测试使用独立临时浏览器配置，结束后关闭，不修改用户现有浏览器数据。

## antislop 交付检查

沿用既有界面，ENERGY / RHYTHM / MOTION = 1 / 1 / 1。没有新增装饰、素材或全局视觉重排。

- Hard Gate PASS：24 项操作实测、320px 无溢出、44px 控件、Escape 焦点与明暗主题文字对比度通过；35 张图片为真实来源。
- Purpose Gate PASS：保留现有模型菜单位置和语义色，重试对应失败操作，警告不提供无效按钮。
- Liveliness PASS：现有商品图片承担主要内容，白色背景、间距与分组保持原方向。
- Craftsmanship PASS：输入、换行、失败、空结果、重试、续页、降级、停止、会话隔离均有浏览器记录；真实服务边界另列，不以替身结果替代。
