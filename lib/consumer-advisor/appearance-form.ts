import type { InteractiveForm } from './response-contract'

export function appearanceMissingForm(text: string, id: string): InteractiveForm | null {
  if (!/(缺少|需要|提供|补充|请填写|告诉我)/.test(text)) return null
  if (/三围|胸围|腰围|臀围/.test(text)) return {
    id, title: '补充三围', status: 'pending', questions: [
      { id: 'bust', label: '胸围（厘米）', type: 'text', required: true },
      { id: 'waist', label: '腰围（厘米）', type: 'text', required: true },
      { id: 'hips', label: '臀围（厘米）', type: 'text', required: true },
    ],
  }
  if (/场合/.test(text)) return { id, title: '补充搭配信息', status: 'pending', questions: [
    { id: 'occasion', label: '穿着场合', type: 'single', options: ['日常', '工作', '聚会', '其他'].map((value) => ({ value, label: value })), required: true },
    { id: 'detail', label: '其他需求', type: 'text', required: false },
  ] }
  return null
}
