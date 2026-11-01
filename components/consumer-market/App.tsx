/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { OmnilinkProvider, useOmnilink } from './context/OmnilinkContext';
import { Header } from './components/Header';
import { BottomBar } from './components/BottomBar';
import { FloatingCard } from './components/FloatingCard';
import { AiCartComparisonDialog } from './components/AiCartComparisonDialog';

// Screens
import { HomeScreen } from './screens/HomeScreen';
import { CartScreen } from './screens/CartScreen';
import { ProductDetailScreen } from './screens/ProductDetailScreen';
import { SceneViewerScreen } from './screens/SceneViewerScreen';
import { ExhibitionDetailScreen } from './screens/ExhibitionDetailScreen';
import { ReviewsScreen } from './screens/ReviewsScreen';
import { StoreScreen } from './screens/StoreScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { FavoritesScreen } from './screens/FavoritesScreen';
import type { AiChatMessage, DiscoveryType, ProductItem, ScenePost } from './types';
import { CreatorPostReader } from './screens/CreatorPostReader';
import type { EvaProfile } from '@/lib/consumer-advisor/eva-onboarding';
import type { EvaSkillId } from './components/CapabilityLibrary';

const OmnilinkAppInner: React.FC<{ profileName: string | null; publisherReady: boolean; initialPostId?: string; profilePreview?: boolean; freshSignupPreview?: boolean; initialEvaChat?: boolean; initialEvaProfile?: EvaProfile; initialOnboarding?: boolean; deepSeekKeyConfigured?: boolean; onboardingPreview?: boolean; initialInstalledSkillIds?: EvaSkillId[]; persistSkillChanges?: boolean; feedChatHomePreview?: boolean }> = ({ profileName, publisherReady, initialPostId, profilePreview, freshSignupPreview, initialEvaChat, initialEvaProfile, initialOnboarding, deepSeekKeyConfigured, onboardingPreview, initialInstalledSkillIds, persistSkillChanges, feedChatHomePreview }) => {
  const [previewStoreName, setPreviewStoreName] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<DiscoveryType>('商品');
  const [navigationOpen, setNavigationOpen] = useState(false);
  const {
    mainTab,
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

  const openedPost = useRef(false);
  useEffect(() => {
    if (initialEvaChat || initialOnboarding || freshSignupPreview) setHomeChatOpen(true);
  }, [initialEvaChat, initialOnboarding, freshSignupPreview, setHomeChatOpen]);
  useEffect(() => {
    if (!initialPostId || openedPost.current) return;
    const post = scenePosts.find((item) => item.id === initialPostId);
    if (post) { openScenePost(post); openedPost.current = true; }
  }, [initialPostId, openScenePost, scenePosts]);

  const reviewTarget = currentProductDetail || null;
  const openProductStore = (product: ProductItem) => {
    setPreviewStoreName(product.storeName);
  };

  return (
    <div className="min-h-dvh w-full bg-[var(--market-canvas)] text-[var(--market-ink)] antialiased flex flex-col selection:bg-[var(--market-accent)]/15">
      <div className="flex min-h-dvh w-full flex-1 flex-col bg-[var(--market-canvas)]">
        {mainTab === 'WORLD' && <Header selectedType={selectedType} onTypeSelect={(type) => { setSelectedType(type); setHomeChatOpen(false); }} onMenuOpenChange={setNavigationOpen} profileName={profileName} deepSeekKeyConfigured={Boolean(deepSeekKeyConfigured)} />}

        {/* Primary Tab View */}
        <main key={mainTab} className={`market-screen-enter w-full ${mainTab === 'WORLD' ? 'h-dvh min-h-0 flex-none overflow-hidden' : 'flex-1'}`}>
          {mainTab === 'WORLD' && <HomeScreen selectedType={selectedType} navigationOpen={navigationOpen} chatDockPreview={feedChatHomePreview} initialOnboarding={initialOnboarding} initialEvaProfile={initialEvaProfile} profileName={profileName} deepSeekKeyConfigured={deepSeekKeyConfigured} onboardingPreview={onboardingPreview} initialInstalledSkillIds={initialInstalledSkillIds} persistSkillChanges={persistSkillChanges} />}
          {mainTab === 'CART' && <CartScreen />}
          {mainTab === 'FAVORITES' && <FavoritesScreen />}
          {mainTab === 'PROFILE' && <ProfileScreen profileName={profileName} publisherReady={publisherReady} preview={profilePreview} />}
        </main>

        {/* Bottom Navigation Bar */}
        {mainTab !== 'WORLD' && <BottomBar />}
      </div>

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
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--market-ink)] px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default function App({ initialProducts = [], initialPosts = [], hasLiveProducts = false, profileName = null, publisherReady = false, initialWelcome = false, initialEvaChat = false, initialEvaProfile, initialOnboarding = false, deepSeekKeyConfigured = false, onboardingPreview = false, initialPostId, evaPreview = false, profilePreview = false, freshSignupPreview = false, initialAiMessages, initialInstalledSkillIds, feedChatHomePreview = false }: { initialProducts?: ProductItem[]; initialPosts?: ScenePost[]; hasLiveProducts?: boolean; profileName?: string | null; publisherReady?: boolean; initialWelcome?: boolean; initialEvaChat?: boolean; initialEvaProfile?: EvaProfile; initialOnboarding?: boolean; deepSeekKeyConfigured?: boolean; onboardingPreview?: boolean; initialPostId?: string; evaPreview?: boolean; profilePreview?: boolean; freshSignupPreview?: boolean; initialAiMessages?: AiChatMessage[]; initialInstalledSkillIds?: EvaSkillId[]; initialActiveSkillId?: EvaSkillId; feedChatHomePreview?: boolean }) {
  const authenticated = Boolean(profileName && !profilePreview && !evaPreview);
  return (
    <div className="consumer-market-shell">
      <OmnilinkProvider initialProducts={initialProducts} initialPosts={initialPosts} hasLiveProducts={hasLiveProducts} initialWelcome={initialWelcome || initialOnboarding || freshSignupPreview} initialAiMessages={initialAiMessages} authenticated={authenticated}>
        <OmnilinkAppInner profileName={profileName} publisherReady={publisherReady} initialPostId={initialPostId} profilePreview={profilePreview} freshSignupPreview={freshSignupPreview} initialEvaChat={initialEvaChat} initialEvaProfile={initialEvaProfile} initialOnboarding={initialOnboarding} deepSeekKeyConfigured={deepSeekKeyConfigured} onboardingPreview={onboardingPreview || !authenticated} initialInstalledSkillIds={initialInstalledSkillIds} persistSkillChanges={authenticated} feedChatHomePreview={feedChatHomePreview} />
      </OmnilinkProvider>
    </div>
  );
}
