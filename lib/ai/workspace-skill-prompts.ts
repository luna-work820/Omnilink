import 'server-only'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const MULTI_CHANNEL_PRODUCT_CONTENT_SKILL_ID = 'multi-channel-product-content'

const skillRoot = join(process.cwd(), 'lib/ai/skills', MULTI_CHANNEL_PRODUCT_CONTENT_SKILL_ID)

export function loadMultiChannelProductContentContext(): WorkspaceSkillContext {
  return {
    skillDoc: readFileSync(join(skillRoot, 'SKILL.md'), 'utf8'),
    playbookDoc: readFileSync(join(skillRoot, 'references', 'marketing-playbook.md'), 'utf8'),
  }
}

export interface WorkspaceSkillContext {
  /**
   * SKILL.md 的完整正文。规则只在该文件维护，此处不复制。
   * 由调用方读取 SKILL.md 后传入，避免在此处内嵌一份会漂移的副本。
   */
  skillDoc: string
  /**
   * marketing-playbook.md 正文。仅在生成抖音或小红书正文时需要。
   */
  playbookDoc?: string
}

const OUTPUT_SKELETON = [
  '必须使用以下 Markdown 结构，不增删顶层章节：',
  '## 事实缺口回显\n按渠道列出必需事实，标明已确认与待确认，并写明哪些是阻塞项。全部齐备时用一行说明本次无阻塞项，不空列表格。',
  '## 内容策略\n- 核心信息：\n- 目标受众：\n- 手段层：写明本次使用的层号及依据（指定或渠道默认）\n- 可用事实：\n- 待确认风险：',
  '## 小红书\n### 标题候选\n列出 3 个。\n### 正文\n给出一版完整正文。\n### 标签\n列出 5-8 个。\n### 封面短句\n列出 2 个。',
  '## 抖音\n### 视频标题\n给出 2 个。\n### 前三秒钩子\n给出 2 个。\n### 口播脚本\n按所选手段层的信息释放顺序写一版 30-45 秒脚本。\n### 评论区引导\n给出 1 个。',
  '## 商品详情页\n### 一句话卖点\n### 核心卖点\n列出 3-5 条，每条包含事实依据。\n### 使用场景\n### FAQ\n只回答输入中有依据的问题，没有依据的问题不列。',
  '## 图片 Brief\n按小红书封面、抖音首帧、详情页卖点图分别给出画幅、主体、场景、构图、文字留白和禁止改变的商品事实。',
  '## 审核清单\n按 SKILL.md 的审核清单逐条输出可勾选项。',
].join('\n')

const APPENDED = [
    '不要声称已经发布、保存、写入商品资料或更新知识库。当前技能生成文本、图片结果或图片 brief，不执行发布。',
  '生成前先回显事实缺口，不直接开始产出。阻塞项齐备则直接生成，不重复追问。',
  '是否商单、分成或含商业合作必须在生成前确认，不放在审核清单末尾。确认为商单时正文须含广告标识，报备状态列为发布阻塞项。',
  '商品名中的性能词只作名称原文引用，不展开成性能描述。涉及第三方商标时提示商家自行确认授权。',
  '不生成带占位符的空白模板。',
  '输出简洁、具体、可直接编辑，不要解释你的推理过程。',
].join('\n')

/**
 * 规则正文以 SKILL.md 为唯一来源，此处只补充应用层要求的输出契约。
 * 调用方负责读取并传入 SKILL.md，以及在需要时传入 playbook。
 */
export function getWorkspaceSkillInstructions(
  skillId: string | null,
  context: WorkspaceSkillContext
) {
  if (skillId !== MULTI_CHANNEL_PRODUCT_CONTENT_SKILL_ID) return null
  if (!context?.skillDoc) {
    throw new Error('multi-channel-product-content requires skillDoc from SKILL.md')
  }

  const parts = [context.skillDoc, OUTPUT_SKELETON, APPENDED]

  if (context.playbookDoc) {
    parts.push(context.playbookDoc)
  } else {
    parts.push(
      '未提供 marketing-playbook.md：仅按渠道默认层产出，不得自行上移层号；' +
        '第 4 层对照评测在缺少商家确认的对手事实时禁用。'
    )
  }

  return parts.join('\n\n')
}
