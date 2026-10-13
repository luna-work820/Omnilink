/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React from 'react';
import { OmnilinkProvider, useOmnilink } from './context/OmnilinkContext';
import { Header } from './components/Header';
import { BottomBar } from './components/BottomBar';
import { FloatingCard } from './components/FloatingCard';
import { AiCartComparisonDialog } from './components/AiCartComparisonDialog';
import { GlobalAiDrawer } from './components/GlobalAiDrawer';

// Screens
import { HomeScreen } from './screens/HomeScreen';
import { PersonalStudioScreen } from './screens/PersonalStudioScreen';
import { CartScreen } from './screens/CartScreen';
import { ProductDetailScreen } from './screens/ProductDetailScreen';
import { SceneViewerScreen } from './screens/SceneViewerScreen';
import { ExhibitionDetailScreen } from './screens/ExhibitionDetailScreen';
import { ReviewsScreen } from './screens/ReviewsScreen';
import { SearchScreen } from './screens/SearchScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import type { ProductItem } from './types';

const OmnilinkAppInner: React.FC = () => {
  const {
    mainTab,
    selectedFloatingProduct,
    closeFloatingProduct,
    openProductDetail,
    currentProductDetail,
    closeProductDetail,
    currentScenePost,
    currentSceneIndex,
    scenePosts,
    closeScenePost,
    currentExhibition,
    closeExhibition,
    isSearchOpen,
    setSearchOpen,
    searchQuery,
    searchResults,
    updateSearchQuery,
    isReviewsOpen,
    closeReviews,
    cartComparisonPair,
    closeCartComparison,
    addToCart,
    openStore,
    openReviews,
    toastMessage,
  } = useOmnilink();

  const reviewTarget = currentProductDetail || null;

  return (
    <div className="min-h-dvh w-full bg-[#F6F3EE] text-[#181817] antialiased flex flex-col selection:bg-[#A73F32]/15">
      {/* Container with responsive scaling: naturally optimized for mobile, tablet, and desktop */}
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-[#F6F3EE]">
        {/* Main App Header (Shown on World & Profile tabs) */}
        {(mainTab === 'WORLD' || mainTab === 'PROFILE') && <Header />}

        {/* Primary Tab View */}
        <main className="flex-1 w-full">
          {mainTab === 'WORLD' && <HomeScreen />}
          {mainTab === 'PERSONAL' && <PersonalStudioScreen />}
          {mainTab === 'CART' && <CartScreen />}
          {mainTab === 'PROFILE' && <ProfileScreen />}
        </main>

        {/* Bottom Navigation Bar */}
        <BottomBar />
      </div>

      {/* Overlay: Floating Product Card (Bottom Sheet over Feed) */}
      {selectedFloatingProduct && (
        <FloatingCard
          key={selectedFloatingProduct.id}
          product={selectedFloatingProduct}
          onDismiss={closeFloatingProduct}
          onExpandDetail={openProductDetail}
          onAddToCart={addToCart}
          onOpenStore={openStore}
        />
      )}

      {/* Overlay: Full Product Detail Space */}
      {currentProductDetail && (
        <ProductDetailScreen
          product={currentProductDetail}
          onClose={closeProductDetail}
          onOpenStore={openStore}
          onOpenReviews={openReviews}
          onAddToCart={addToCart}
        />
      )}

      {/* Overlay: Full Screen Short Video / Scene Viewer */}
      {currentScenePost && (
        <SceneViewerScreen
          scenePosts={scenePosts}
          initialIndex={currentSceneIndex}
          onClose={closeScenePost}
          onOpenProductDetail={openProductDetail}
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

      {/* Overlay: Search Space */}
      {isSearchOpen && (
        <SearchScreen
          query={searchQuery}
          results={searchResults}
          onQueryChange={updateSearchQuery}
          onClose={() => setSearchOpen(false)}
          onProductClick={(p) => {
            setSearchOpen(false);
            openProductDetail(p);
          }}
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

      {/* Overlay: Full-Scene Global AI Drawer (全场景智能呼出) */}
      <GlobalAiDrawer />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#181817] px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default function App({ initialProducts = [], hasLiveProducts = false }: { initialProducts?: ProductItem[]; hasLiveProducts?: boolean }) {
  return (
    <div className="consumer-market-shell">
      <OmnilinkProvider initialProducts={initialProducts} hasLiveProducts={hasLiveProducts}>
        <OmnilinkAppInner />
      </OmnilinkProvider>
    </div>
  );
}
