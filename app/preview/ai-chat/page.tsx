import App from '@/components/consumer-market/App'
import type { ProductItem } from '@/components/consumer-market/types'
import sampleProducts from '@/components/consumer-market/data/collected-demo-products.json'

const products = sampleProducts.filter((product) => ['P0055', 'P0057', 'P0058'].includes(product.id)) as unknown as ProductItem[]

export default function AiChatPreviewPage() {
  return <App
    initialProducts={products}
    hasLiveProducts
    profileName="预览用户"
    profilePreview
    initialAiAssistantChat
    initialAiMessages={[
      { id: 'ai-preview-user', conversationId: '6fa12980-4be3-42fb-8fb2-5082bfe7a451', isUser: true, text: '我喜欢被绿植围住的工作区，但桌面有点乱。想找适合我的单品。', image: '/consumer-market/ssd-import/plant-filled-workspace.webp' },
      { id: 'ai-preview-question', conversationId: '6fa12980-4be3-42fb-8fb2-5082bfe7a451', isUser: false, text: '看到这张图时，最先打动你的是什么？' },
    ]}
  />
}
