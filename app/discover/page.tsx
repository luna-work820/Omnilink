import { workspaceCapabilities } from '@/lib/workspace/capabilities'
import { needsSignupInvitation } from '@/lib/auth/signup-entry'
import App from '@/components/consumer-market/App'
import { redirect } from 'next/navigation'
import { readPublishedConsumerCatalog } from '@/lib/products/consumer-catalog-store'
import { createClientServer } from '@/lib/supabase/server'
import { getStoreByOwnerId } from '@/lib/stores/service'
import { emptyAiAssistantProfile, readAiAssistantProfile } from '@/lib/consumer-advisor/ai-assistant-profile'
import { readDeepSeekKeyForUser } from '@/lib/consumer-advisor/deepseek-key-cookie'
import { readPublishedContent } from '@/lib/creator-publication-feed'
import { CreatorDiscoveryPreview } from '@/components/creator-content/CreatorDiscoveryPreview'

const DEFAULT_INSTALLED_SKILL_IDS: ('personal-advisor' | 'shopping-preferences')[] = ['personal-advisor', 'shopping-preferences']

export const metadata = {
  title: 'Omnilink 灵感市场',
  description: '浏览创作者发布的内容、商品与推荐。',
}

export default async function ConsumerMarketPage({ searchParams }: { searchParams: Promise<{ creatorPreview?: string; aiAssistantPreview?: string; newUser?: string; openAssistant?: string; activatePersonalAdvisor?: string; demoLogin?: string; newUserPreview?: string; feedChatPreview?: string; signupPreviewComplete?: string; shoppingPreferences?: string; shoppingPreferencesPreview?: string; post?: string }> }) {
  const params = await searchParams
  if (process.env.NODE_ENV !== 'production' && params.creatorPreview === '1') return <CreatorDiscoveryPreview postId={params.post} />
  const productsList = (await readPublishedConsumerCatalog()).products
  const fallbackAiModel = process.env.CONSUMER_DEFAULT_ANSWER_MODEL === 'gemini' ? 'gemini' : 'qwen-plus'
  const aiAssistantPreview = process.env.NODE_ENV !== 'production' && params.aiAssistantPreview === '1'
  const demoLogin = process.env.NODE_ENV !== 'production' && params.demoLogin === '1'
  const newUserPreview = process.env.NODE_ENV !== 'production' && params.newUserPreview === '1'
  const feedChatPreview = process.env.NODE_ENV !== 'production' && params.feedChatPreview === '1'
  if (feedChatPreview) {
    return <App initialProducts={productsList} hasLiveProducts profileName="预览用户" profilePreview feedChatHomePreview fallbackAiModel={fallbackAiModel} />
  }
  if (newUserPreview) {
    return <App initialProducts={productsList} hasLiveProducts profileName="预览用户" initialSignupInvitation initialAiAssistantProfile={{ ...emptyAiAssistantProfile, name: '预览用户' }} deepSeekKeyConfigured={false} onboardingPreview initialInstalledSkillIds={DEFAULT_INSTALLED_SKILL_IDS} profilePreview fallbackAiModel={fallbackAiModel} />
  }
  const signupPreviewComplete = process.env.NODE_ENV !== 'production' && params.signupPreviewComplete === '1'
  if (signupPreviewComplete) {
    return <App initialProducts={productsList} hasLiveProducts profileName="预览用户" initialAiAssistantChat initialInstalledSkillIds={['personal-advisor', 'shopping-preferences']} profilePreview fallbackAiModel={fallbackAiModel} />
  }
  const shoppingPreferencesPreview = process.env.NODE_ENV !== 'production' && params.shoppingPreferencesPreview === '1'
  if (shoppingPreferencesPreview) {
    return <App initialProducts={productsList} hasLiveProducts profileName="预览用户" profilePreview onboardingPreview initialAiAssistantProfile={{...emptyAiAssistantProfile,name:'预览用户',stage:'done'}} fallbackAiModel={fallbackAiModel} />
  }
  if (demoLogin || aiAssistantPreview) {
    return <App
      initialProducts={productsList}
      hasLiveProducts
      profileName="预览用户"
      initialAiAssistantChat={aiAssistantPreview}
      profilePreview
      fallbackAiModel={fallbackAiModel}
    />
  }
  const supabase = await createClientServer()
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }
  if (!user) redirect('/login?next=%2Fdiscover')
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
  const showSignupInvitation = needsSignupInvitation(user.user_metadata)
  const deepSeekKeyConfigured = user ? Boolean(await readDeepSeekKeyForUser(user.id)) : false
  const activatePersonalAdvisor = params.activatePersonalAdvisor === '1'
    && (!user || initialInstalledSkillIds.includes('personal-advisor'))

  const capabilities = workspaceCapabilities(user.app_metadata, Boolean(await getStoreByOwnerId(user.id)))
  const publisherReady = capabilities.merchant
  const initialProducts = productsList
  const hasLiveContent = true
  let initialPosts: Awaited<ReturnType<typeof readPublishedContent>> = []
  let initialContentError = ''
  try {
    initialPosts = await readPublishedContent(supabase, params.post)
    if (params.post && !initialPosts.some((post) => post.id === params.post)) initialContentError = '作品不存在或已取消公开。'
  } catch { initialContentError = '内容暂时无法读取，请刷新重试。' }
  return <App initialProducts={initialProducts} initialPosts={initialPosts} livePublications initialContentError={initialContentError} hasLiveProducts={hasLiveContent} userId={user?.id??null} profileName={initialAiAssistantProfile.name || user?.email || null} publisherReady={publisherReady} creatorReady={capabilities.creator} initialSignupInvitation={showSignupInvitation} initialAiAssistantChat={!showSignupInvitation && params.openAssistant === '1'} initialAiAssistantProfile={initialAiAssistantProfile}  deepSeekKeyConfigured={deepSeekKeyConfigured} fallbackAiModel={fallbackAiModel} initialInstalledSkillIds={user ? initialInstalledSkillIds : undefined} initialActiveSkillId={activatePersonalAdvisor ? 'personal-advisor' : undefined} initialPostId={params.post} />
}
