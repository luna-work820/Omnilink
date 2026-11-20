'use client';

import './login-package.css';
import React, { useState } from "react";
import { Navbar } from "./components/Navbar";
import { RippleDistortionHero } from "./components/RippleDistortionHero";
import { BleibtGooeySection } from "./components/BleibtGooeySection";
import { Skiper30 } from "./components/Skiper30";
import { LiquidCanvasBackground } from "./components/LiquidCanvasBackground";
import { AuthModal } from "./components/AuthModal";
import { usePageTheme } from "./hooks/usePageTheme";

export default function App({ redirectTo, confirmationError = false }: { redirectTo?: string; confirmationError?: boolean }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(confirmationError);
  const { theme, checkTheme } = usePageTheme();

  const handleOpenAuth = () => {
    checkTheme();
    setIsAuthModalOpen(true);
  };

  return (
    <div className="loginPackage min-h-screen bg-[#000000] text-[#1D1F23] relative selection:bg-[#EEF1FF] selection:text-[#315BFF] overflow-x-clip">
      {/* Interactive Liquid Canvas Background */}
      <LiquidCanvasBackground />

      {/* Floating Staggered Menu Navbar with dynamic scroll-based theme */}
      <Navbar onOpenAuth={handleOpenAuth} theme={theme} redirectTo={redirectTo} />

      <main className="relative z-10">
        {/* Page 1: Pure OGL RippleDistortion Water Surface */}
        <RippleDistortionHero />

        {/* Page 2 & Page 3: Seamless Dual-Layer Liquid Section extending into Pure Black Page 3 with Stationary Water-Ripple Expansion */}
        <BleibtGooeySection />

        {/* Final Page: Scroll-driven 3D Card Flip with WarpText and LoginForm */}
        <Skiper30 redirectTo={redirectTo} />
      </main>

      {/* Sliding Auth Modal adapting to black/white page background */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        theme={theme}
        redirectTo={redirectTo}
        confirmationError={confirmationError}
      />
    </div>
  );
}
