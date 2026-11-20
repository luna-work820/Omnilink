import { blue, gray, green, orange, pink, purple, sand, yellow } from '@radix-ui/colors'

const families = [
  { id: 'gray', label: '灰色', colors: [gray.gray2, gray.gray3, gray.gray4] },
  { id: 'sand', label: '米色', colors: [sand.sand2, sand.sand3, sand.sand4] },
  { id: 'blue', label: '蓝色', colors: [blue.blue2, blue.blue3, blue.blue4] },
  { id: 'green', label: '绿色', colors: [green.green2, green.green3, green.green4] },
  { id: 'yellow', label: '黄色', colors: [yellow.yellow2, yellow.yellow3, yellow.yellow4] },
  { id: 'orange', label: '橙色', colors: [orange.orange2, orange.orange3, orange.orange4] },
  { id: 'pink', label: '粉色', colors: [pink.pink2, pink.pink3, pink.pink4] },
  { id: 'purple', label: '紫色', colors: [purple.purple2, purple.purple3, purple.purple4] },
]

export const articleBackgrounds = [
  { id: 'white', label: '默认', color: '#FCFDFE' },
  ...[0, 1, 2].flatMap((shade) => families.map((family) => ({
    id: `${family.id}-${shade + 2}`,
    label: `${family.label} ${shade + 1}`,
    color: family.colors[shade],
  }))),
]

export function getArticleBackground(id: string) {
  const legacy: Record<string, string> = { gray: 'gray-2', sand: 'yellow-2', blue: 'blue-2' }
  return articleBackgrounds.find((background) => background.id === (legacy[id] ?? id)) ?? articleBackgrounds[0]
}
