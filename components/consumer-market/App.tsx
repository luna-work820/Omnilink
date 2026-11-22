/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { OmnilinkProvider, useOmnilink } from './context/OmnilinkContext';
import { Header } from './components/Header';
import { FloatingCard } from './components/FloatingCard';
import { AiCartComparisonDialog } from './components/AiCartComparisonDialog';
import { DisplayPriceProvider } from './components/DisplayPrice';
import { applyMarketGlassPreferences } from './glass-preferences';
import { observeGlassworkSurfaces } from '@/components/ui/glasswork/integrate';

// Screens
import { HomeScreen } from './screens/HomeScreen';
import { ProductDetailScreen } from './screens/ProductDetailScreen';
import { SceneViewerScreen } from './screens/SceneViewerScreen';
import { ExhibitionDetailScreen } from './screens/ExhibitionDetailScreen';
import { ReviewsScreen } from './screens/ReviewsScreen';
import { StoreScreen } from './screens/StoreScreen';
import { PersonalPanel } from './components/PersonalPanel';
import type { AiChatMessage, ProductItem, ScenePost } from './types';
import { CreatorPostReader } from './screens/CreatorPostReader';
import type { AiAssistantProfile } from '@/lib/consumer-advisor/ai-assistant-profile';
import type { AiAssistantSkillId } from './components/CapabilityLibrary';

const OmnilinkAppInner: React.FC<{ profileName: string | null; publisherReady: boolean; creatorReady?: boolean; initialPostId?: string; profilePreview?: boolean; freshSignupPreview?: boolean; initialSignupInvitation?: boolean; invitationUserId?: string; initialAiAssistantChat?: boolean; initialAiAssistantProfile?: AiAssistantProfile; initialOnboarding?: boolean; deepSeekKeyConfigured?: boolean; onboardingPreview?: boolean; initialInstalledSkillIds?: AiAssistantSkillId[]; feedChatHomePreview?: boolean }> = ({ profileName, publisherReady, creatorReady = false, initialPostId, profilePreview, freshSignupPreview, initialSignupInvitation, invitationUserId, initialAiAssistantChat, initialAiAssistantProfile, initialOnboarding, deepSeekKeyConfigured, onboardingPreview, initialInstalledSkillIds, feedChatHomePreview }) => {
  const [previewStoreName, setPreviewStoreName] = useState<string | null>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const {
    selectedFloatingProduct,
    openFloatingProduct,
    closeFloatingProduct,
    openProductDetail,
    currentProductDetail,
    closeProductDetail,
    currentScenePost,
    currentSceneIndex,
    scenePosts,
    openScenePost,
    closeScenePost,
    currentExhibition,
    closeExhibition,
    isReviewsOpen,
    closeReviews,
    cartComparisonPair,
    closeCartComparison,
    openReviews,
    toastMessage,
    setHomeChatOpen,
  } = useOmnilink();

  const closeProfile = useCallback(() => {
    setProfileOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('button[aria-label="个人资料"]')?.focus());
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeProfile(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [profileOpen, closeProfile]);

  useEffect(() => {
    if (currentProductDetail) setProfileOpen(false);
  }, [currentProductDetail]);

  const openedPost = useRef(false);
  useEffect(() => {
    if (initialAiAssistantChat || initialOnboarding || freshSignupPreview) setHomeChatOpen(true);
  }, [initialAiAssistantChat, initialOnboarding, freshSignupPreview, setHomeChatOpen]);
  useEffect(() => {
    if (!initialPostId || openedPost.current) return;
    const post = scenePosts.find((item) => item.id === initialPostId);
    if (post) { openScenePost(post); openedPost.current = true; }
  }, [initialPostId, openScenePost, scenePosts]);

  const reviewTarget = currentProductDetail || null;
  const changeNavigation = useCallback((open: boolean) => setNavigationOpen(open), []);

  const openProductStore = (product: ProductItem) => {
    setPreviewStoreName(product.storeName);
  };

  return (
    <div className="min-h-dvh w-full bg-[var(--market-canvas)] text-[var(--market-ink)] antialiased flex flex-col selection:bg-[var(--market-accent)]/15">
      <div data-navigation-open={navigationOpen} inert={profileOpen} className="consumer-market-world-layout flex min-h-dvh w-full flex-1 flex-col bg-[var(--market-canvas)]">
        <Header onMenuOpenChange={changeNavigation} onProfileOpen={() => setProfileOpen(true)} profileName={profileName} publisherReady={publisherReady} creatorReady={creatorReady} deepSeekKeyConfigured={Boolean(deepSeekKeyConfigured)} />
        <main className="h-dvh min-h-0 w-full flex-none overflow-hidden">
          <HomeScreen initialSignupInvitation={initialSignupInvitation} invitationUserId={invitationUserId} navigationOpen={navigationOpen} chatDockPreview={feedChatHomePreview} initialOnboarding={initialOnboarding} initialAiAssistantProfile={initialAiAssistantProfile} profileName={profileName} deepSeekKeyConfigured={deepSeekKeyConfigured} onboardingPreview={onboardingPreview} initialInstalledSkillIds={initialInstalledSkillIds} personalPreview={profilePreview} />
        </main>
      </div>

      {profileOpen && <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/20 p-3 sm:justify-start sm:pl-14" onMouseDown={(event) => { if (event.target === event.currentTarget) closeProfile(); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="personal-menu-title" onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'));
          if (controls.length < 2) return;
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }} className="w-full max-w-[256px] rounded-3xl border-[0.5px] border-[var(--market-border)] bg-[var(--market-surface-muted)] p-2 shadow-lg sm:mb-1">
          <div className="flex justify-end pb-1">
            <button type="button" autoFocus onClick={closeProfile} aria-label="关闭个人菜单" className="grid h-7 w-7 place-items-center rounded-full text-[var(--market-ink)] hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><X size={14} aria-hidden="true" /></button>
          </div>
          <PersonalPanel profileName={profileName} publisherReady={publisherReady} creatorReady={creatorReady} onNavigate={closeProfile} />
        </div>
      </div>}

      {/* Overlay: Floating Product Card (Bottom Sheet over Feed) */}
      {selectedFloatingProduct && (
        <FloatingCard
          key={selectedFloatingProduct.id}
          product={selectedFloatingProduct}
          onDismiss={closeFloatingProduct}
          onExpandDetail={openProductDetail}
        />
      )}

      {/* Overlay: Full Product Detail Space */}
      {currentProductDetail && (
        <ProductDetailScreen
          key={currentProductDetail.id}
          product={currentProductDetail}
          onClose={closeProductDetail}
          onOpenStore={openProductStore}
          onOpenReviews={openReviews}
        />
      )}

      {previewStoreName && (
        <StoreScreen
          storeName={previewStoreName}
          onClose={() => setPreviewStoreName(null)}
          onProductClick={(product) => {
            setPreviewStoreName(null);
            openProductDetail(product);
          }}
        />
      )}

      {/* Overlay: Full Screen Short Video / Scene Viewer */}
      {currentScenePost?.kind ? (
        <CreatorPostReader key={currentScenePost.id} post={currentScenePost} onClose={closeScenePost} onOpenProduct={(product) => { closeScenePost(); openProductDetail(product); }} />
      ) : currentScenePost && (
        <SceneViewerScreen
          scenePosts={scenePosts}
          initialIndex={currentSceneIndex}
          onClose={closeScenePost}
          onOpenProductCard={openFloatingProduct}
        />
      )}

      {/* Overlay: Digital Magazine Exhibition Detail */}
      {currentExhibition && (
        <ExhibitionDetailScreen
          exhibition={currentExhibition}
          onClose={closeExhibition}
          onProductClick={openProductDetail}
        />
      )}

      {/* Overlay: Aggregated Theme Reviews Screen */}
      {isReviewsOpen && reviewTarget && (
        <ReviewsScreen
          reviews={reviewTarget.reviews}
          onClose={closeReviews}
        />
      )}

      {/* Overlay: AI Cart Comparison Dialog */}
      {cartComparisonPair && (
        <AiCartComparisonDialog
          pair={cartComparisonPair}
          onClose={closeCartComparison}
        />
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <div role="status" className="fixed bottom-20 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-[var(--market-ink)] px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default function App({ initialProducts = [], initialPosts = [], livePublications = false, initialContentError, hasLiveProducts = false, userId = null, profileName = null, publisherReady = false, creatorReady = false, initialWelcome = false, initialSignupInvitation = false, initialAiAssistantChat = false, initialAiAssistantProfile, initialOnboarding = false, deepSeekKeyConfigured = false, fallbackAiModel = 'qwen-plus', onboardingPreview = false, initialPostId, aiAssistantPreview = false, profilePreview = false, freshSignupPreview = false, initialAiMessages, initialInstalledSkillIds, feedChatHomePreview = false }: { initialProducts?: ProductItem[]; initialPosts?: ScenePost[]; livePublications?: boolean; initialContentError?: string; hasLiveProducts?: boolean; userId?:string|null; profileName?: string | null; publisherReady?: boolean; creatorReady?: boolean; initialWelcome?: boolean; initialSignupInvitation?: boolean; initialAiAssistantChat?: boolean; initialAiAssistantProfile?: AiAssistantProfile; initialOnboarding?: boolean; deepSeekKeyConfigured?: boolean; fallbackAiModel?: 'gemini' | 'qwen-plus'; onboardingPreview?: boolean; initialPostId?: string; aiAssistantPreview?: boolean; profilePreview?: boolean; freshSignupPreview?: boolean; initialAiMessages?: AiChatMessage[]; initialInstalledSkillIds?: AiAssistantSkillId[]; initialActiveSkillId?: AiAssistantSkillId; feedChatHomePreview?: boolean }) {
  const router = useRouter();
  const authenticated = Boolean(userId && !profilePreview && !aiAssistantPreview);
  useEffect(() => {
    if (!livePublications) return;
    const refresh = () => router.refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [livePublications, router]);
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('.consumer-market-shell');
    if (!shell) return;
    applyMarketGlassPreferences(shell);
    const stopObservingSurfaces = observeGlassworkSurfaces(document.body);
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const updateColorScheme = () => {
      shell.dataset.colorScheme = colorScheme.matches ? 'dark' : 'light';
      window.dispatchEvent(new Event('market-glass-preferences'));
    };
    updateColorScheme();
    colorScheme.addEventListener('change', updateColorScheme);
    return () => {
      colorScheme.removeEventListener('change', updateColorScheme);
      stopObservingSurfaces();
    };
  }, []);
  return (
    <div className="consumer-market-shell">
      {initialContentError && <div role="alert" className="fixed left-1/2 top-4 z-[100] flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-4 rounded-2xl bg-[var(--surface)] p-4 text-sm text-[var(--text-primary)]"><span>{initialContentError}</span><a href="/discover" className="shrink-0 underline">返回发现页</a></div>}
      <DisplayPriceProvider>
      <OmnilinkProvider key={userId??'guest'} initialProducts={initialProducts} initialPosts={initialPosts} hasLiveProducts={hasLiveProducts} initialWelcome={initialWelcome || initialOnboarding || freshSignupPreview} initialAiMessages={initialAiMessages} authenticated={authenticated} initialAiModel={profilePreview || aiAssistantPreview ? 'qwen-plus' : authenticated && deepSeekKeyConfigured ? 'deepseek-v4-pro' : fallbackAiModel}>
        <OmnilinkAppInner initialSignupInvitation={initialSignupInvitation} invitationUserId={userId ?? 'signup-preview'} profileName={profileName} publisherReady={publisherReady} creatorReady={creatorReady} initialPostId={initialPostId} profilePreview={profilePreview} freshSignupPreview={freshSignupPreview} initialAiAssistantChat={initialAiAssistantChat} initialAiAssistantProfile={initialAiAssistantProfile} initialOnboarding={initialOnboarding} deepSeekKeyConfigured={deepSeekKeyConfigured} onboardingPreview={onboardingPreview || !authenticated} initialInstalledSkillIds={initialInstalledSkillIds} feedChatHomePreview={feedChatHomePreview} />
      </OmnilinkProvider>
      </DisplayPriceProvider>
    </div>
  );
}
