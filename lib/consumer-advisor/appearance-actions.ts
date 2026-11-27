export const APPEARANCE_ACTIONS = [
  { label: '肤质分析', prompt: '我想进行肤质分析。', next: '请上传一张自然光下的正面照片，也可以告诉我你的出油、干燥或敏感情况。' },
  { label: '动物系长相', prompt: '我想了解自己的动物系长相。', next: '请上传一张自然光下的正面照片，我会根据可见的五官和轮廓描述风格倾向。' },
  { label: '四季色彩', prompt: '我想了解自己的四季色彩。', next: '请上传一张自然光下的正面照片，我会结合照片和你的自述了解色彩倾向。' },
  { label: '身材分型', prompt: '我想进行身材分型。', next: '请提供你的胸围、腰围和臀围，可以填写厘米数或区间。' },
  { label: '穿搭建议', prompt: '我想获得穿搭建议。', next: '请告诉我你想搭配的场合和偏好的风格，也可以上传照片。' },
  { label: '气质描述', prompt: '我想了解自己的气质表现。', next: '请上传一张自然光下的正面照片，我会描述照片中可见的线条、色调和造型。' },
] as const

export function selectedAppearanceAction(prompt: string) {
  return APPEARANCE_ACTIONS.find((action) => prompt === action.prompt || prompt.startsWith(`${action.prompt}\n`))
}
