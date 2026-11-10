import App from '@/components/consumer-market/App'
import { fiveStoreDemoProducts, productsList, shelfProduct, cratesProduct, mobileTableProduct } from '@/components/consumer-market/data/mockData'
import type { AiChatMessage, ProductItem, ScenePost } from '@/components/consumer-market/types'
import { getStorefrontDiscoveryItems } from '@/lib/storefront/service'
import { createClientServer } from '@/lib/supabase/server'
import { getStoreByOwnerId } from '@/lib/stores/service'
import { emptyAiAssistantProfile, readAiAssistantProfile } from '@/lib/consumer-advisor/ai-assistant-profile'
import { readContentBlocks } from '@/lib/creator-content'
import { ShoppingPreferenceSurveyFlow } from '@/components/consumer-market/screens/ShoppingPreferenceSurveyFlow'
import { readDeepSeekKeyForUser } from '@/lib/consumer-advisor/deepseek-key-cookie'

const DEFAULT_INSTALLED_SKILL_IDS: ('personal-advisor' | 'shopping-preferences')[] = ['personal-advisor', 'shopping-preferences']

export const metadata = {
  title: 'Omnilink 灵感市场',
  description: '浏览创作者发布的内容、商品与推荐。',
}

const aiAssistantFirstUsePreviewMessages: AiChatMessage[] = [
  {
    id: 'first-use-preview-user',
    conversationId: 'first-use-preview',
    text: '推荐适合小户型客厅的收纳方案，用表格对比',
    isUser: true,
    timestamp: '刚刚',
  },
  {
    id: 'first-use-preview-assistant',
    conversationId: 'first-use-preview',
    text: '三种收纳方式对比：\n\n| 商品 | 收纳方式 | 参考价 |\n| --- | --- | ---: |\n| ![壁架](/consumer-market/img_exhibition_apartment.jpg) 极简隐形实木壁架 | 利用墙面收纳 | ¥210 |\n| ![桌面收纳箱](/consumer-market/img_crates.jpg) 三层铝合金桌面模块化收纳箱 | 桌面分类整理 | ¥125 |\n| ![移动边几](/consumer-market/img_mobile_table.jpg) 移动式建筑感亚克力边几 | 沙发旁灵活收纳 | ¥380 |',
    isUser: false,
    timestamp: 'AI assistant',
    model: 'gemini',
    matchedProducts: [shelfProduct, cratesProduct, mobileTableProduct],
  },
]

function toConsumerProduct(
  item: Awaited<ReturnType<typeof getStorefrontDiscoveryItems>>[number]
): ProductItem {
  const { product, store } = item
  const image = product.imageUrl || '/consumer-market/img_app_icon.jpg'
  const currency = product.currency || 'CNY'
  let formattedPrice = `${currency} ${product.price.toLocaleString('zh-CN')}`
  try {
    formattedPrice = new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(product.price)
  } catch {
    // Keep the explicit currency fallback for non-ISO currency values.
  }

  return {
    id: product.id,
    name: product.name,
    creator: store.name,
    itemType: product.itemType,
    price: product.price,
    formattedPrice: product.priceMode === 'inquiry' ? '询价' : product.priceMode === 'free' || product.price === 0 ? '免费' : formattedPrice,
    priceMode: product.priceMode,
    outboundLinks: product.outboundLinks,
    mainImage: image,
    aspectRatio: 0.82,
    secondaryImages: (product.images ?? []).filter((url) => url !== image),
    category: product.category || product.attributes.category || product.attributes.category_name || (product.itemType === 'service' ? '服务' : product.deliveryType === 'digital' || product.deliveryType === 'ai_capability' ? '数字' : '商品'),
    shortDescription: product.description || '',
    aiSummary: product.description || '商品信息由创作者维护。',
    reviews: [],
    specs: product.attributes,
    storeName: store.name,
    storeSlug: store.slug,
    storeImage: undefined,
    contextStory: product.description || undefined,
    currency,
    defaultVariantId: product.variants?.find((variant) => variant.status === 'active')?.id ?? product.variants?.[0]?.id ?? null,
    options: product.options,
    variants: product.variants,
    deliveryType: product.deliveryType === 'ai_capability' || product.attributes.delivery_type === 'ai_capability' ? 'ai_capability' : product.deliveryType === 'digital' || product.attributes.delivery_type === 'digital' ? 'digital' : 'physical',
    capabilityKind: product.capabilityKind === 'question_set' || product.capabilityKind === 'skill' || product.capabilityKind === 'plugin'
      ? product.capabilityKind
      : product.attributes.capability_kind === 'question_set' || product.attributes.capability_kind === 'skill' || product.attributes.capability_kind === 'plugin'
        ? product.attributes.capability_kind
      : undefined,
  }
}

export default async function ConsumerMarketPage({ searchParams }: { searchParams: Promise<{ aiAssistantPreview?: string; openAssistant?: string; activatePersonalAdvisor?: string; demoLogin?: string; newUserPreview?: string; feedChatPreview?: string; signupPreviewComplete?: string; shoppingPreferences?: string; shoppingPreferencesPreview?: string; post?: string }> }) {
  const params = await searchParams
  const aiAssistantPreview = process.env.NODE_ENV !== 'production' && params.aiAssistantPreview === '1'
  const demoLogin = process.env.NODE_ENV !== 'production' && params.demoLogin === '1'
  const newUserPreview = process.env.NODE_ENV !== 'production' && params.newUserPreview === '1'
  const feedChatPreview = process.env.NODE_ENV !== 'production' && params.feedChatPreview === '1'
  if (feedChatPreview) {
    return <App initialProducts={productsList} profileName="预览用户" profilePreview feedChatHomePreview />
  }
  if (newUserPreview) {
    return <App initialProducts={productsList} profileName="预览用户" initialAiAssistantChat initialAiAssistantProfile={{ ...emptyAiAssistantProfile, name: '预览用户' }} initialOnboarding deepSeekKeyConfigured={false} onboardingPreview initialInstalledSkillIds={DEFAULT_INSTALLED_SKILL_IDS} profilePreview />
  }
  const signupPreviewComplete = process.env.NODE_ENV !== 'production' && params.signupPreviewComplete === '1'
  if (signupPreviewComplete) {
    return <App initialProducts={productsList} profileName="预览用户" initialAiAssistantChat initialInstalledSkillIds={['personal-advisor', 'shopping-preferences']} profilePreview />
  }
  const shoppingPreferencesPreview = process.env.NODE_ENV !== 'production' && params.shoppingPreferencesPreview === '1'
  if (shoppingPreferencesPreview) {
    return <ShoppingPreferenceSurveyFlow preview initialProfile={{ ...emptyAiAssistantProfile, name: '预览用户', stage: 'done' }} />
  }
  if ((demoLogin || aiAssistantPreview) && params.shoppingPreferences === '1') {
    return <ShoppingPreferenceSurveyFlow initialProfile={{ ...emptyAiAssistantProfile, name: '预览用户' }} preview />
  }
  if (demoLogin || aiAssistantPreview) {
    return <App
      initialProducts={productsList}
      profileName="预览用户"
      initialAiAssistantChat={aiAssistantPreview}
      initialAiMessages={aiAssistantPreview ? aiAssistantFirstUsePreviewMessages : undefined}
      profilePreview
    />
  }
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()
  const aiAssistantProfile = readAiAssistantProfile(user?.user_metadata?.ai_assistant_profile)
  const signupName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim().slice(0, 40) : ''
  const initialAiAssistantProfile = {
    ...(aiAssistantProfile.name ? aiAssistantProfile : { ...aiAssistantProfile, name: signupName }),
    avatarUrl: typeof user?.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : aiAssistantProfile.avatarUrl,
  }
  const rawEnabledSkills = user?.user_metadata?.enabled_skills
  const initialInstalledSkillIds: ('personal-advisor' | 'shopping-preferences' | 'know-yourself')[] = Array.isArray(rawEnabledSkills)
    ? rawEnabledSkills.filter((id): id is 'personal-advisor' | 'shopping-preferences' | 'know-yourself' => id === 'personal-advisor' || id === 'shopping-preferences' || id === 'know-yourself')
    : user ? [...DEFAULT_INSTALLED_SKILL_IDS] : []
  if (user && !Array.isArray(rawEnabledSkills)) {
    await supabase.auth.updateUser({ data: { enabled_skills: initialInstalledSkillIds } })
  }
  const needsWelcome = user?.user_metadata?.ai_assistant_onboarding_started === true && user.user_metadata?.ai_assistant_onboarding_complete !== true && aiAssistantProfile.stage !== 'done'
  const deepSeekKeyConfigured = user ? Boolean(await readDeepSeekKeyForUser(user.id)) : false
  if (params.shoppingPreferences === '1' && (user || process.env.NODE_ENV !== 'production')) {
    return <ShoppingPreferenceSurveyFlow
      initialProfile={user ? initialAiAssistantProfile : { ...emptyAiAssistantProfile, name: '预览用户' }}
      preview={!user}
    />
  }
  const activatePersonalAdvisor = params.activatePersonalAdvisor === '1'
    && (!user || initialInstalledSkillIds.includes('personal-advisor'))

  const publisherReady = user ? Boolean(await getStoreByOwnerId(user.id)) : false
  let initialProducts: ProductItem[] = process.env.NODE_ENV === 'production' ? [] : fiveStoreDemoProducts
  let initialPosts: ScenePost[] = []

  try {
    const liveItems = await getStorefrontDiscoveryItems(100)
    const publishedProducts = liveItems.map(toConsumerProduct)
    initialProducts = process.env.NODE_ENV === 'production' ? publishedProducts : [...fiveStoreDemoProducts, ...publishedProducts]
    const { data: posts, error: postsError } = await supabase.from('creator_posts')
      .select('id, store_id, title, cover_url, body, product_ids, blocks')
      .eq('status', 'published').order('published_at', { ascending: false }).limit(30)
    if (postsError) throw postsError
    const storeIds = [...new Set((posts ?? []).map((post) => post.store_id))]
    const { data: stores } = storeIds.length
      ? await supabase.from('stores').select('id, name').in('id', storeIds)
      : { data: [] }
    const storeNames = new Map((stores ?? []).map((store) => [store.id, store.name]))
    const productById = new Map(publishedProducts.map((product) => [product.id, product]))
    initialPosts = (posts ?? []).flatMap((post) => {
      const productIds = Array.isArray(post.product_ids) ? post.product_ids as string[] : []
      const linkedProducts = productIds.map((id) => productById.get(id)).filter((item): item is ProductItem => Boolean(item))
      if (!linkedProducts.length || linkedProducts.length !== productIds.length) return []
      return [{
        id: post.id, kind: 'note' as const,
        title: post.title, editorName: storeNames.get(post.store_id) || '创作者', editorAvatar: '/consumer-market/img_app_icon.jpg',
        coverImage: post.cover_url, isVideo: false, mediaList: [post.cover_url], linkedProducts,
        aspectRatio: 0.8, description: post.body,
        blocks: readContentBlocks(post.blocks, post.body, productIds),
      }]
    })
  } catch (error) {
    console.warn('[ConsumerMarket] Published content unavailable.', error)
  }

  const hasLiveContent = process.env.NODE_ENV === 'production' || initialProducts.length > 0 || initialPosts.length > 0
  return <App initialProducts={initialProducts} initialPosts={initialPosts} hasLiveProducts={hasLiveContent} profileName={initialAiAssistantProfile.name || user?.email || null} publisherReady={publisherReady} initialAiAssistantChat={params.openAssistant === '1' || needsWelcome} initialAiAssistantProfile={initialAiAssistantProfile} initialOnboarding={Boolean(user && needsWelcome)} deepSeekKeyConfigured={deepSeekKeyConfigured} initialInstalledSkillIds={user ? initialInstalledSkillIds : undefined} initialActiveSkillId={activatePersonalAdvisor ? 'personal-advisor' : undefined} initialPostId={params.post} />
}
