"use client";

import "./login-package.css";
import React, { useCallback, useState } from "react";
import { Navbar } from "./components/Navbar";
import { BleibtGooeySection } from "./components/BleibtGooeySection";
import { Skiper30 } from "./components/Skiper30";
import { AuthModal } from "./components/AuthModal";
import { usePageTheme } from "./hooks/usePageTheme";
import { jumpToFinalLogin } from "./lib/utils";

export default function App({ redirectTo, confirmationError = false }: { redirectTo?: string; confirmationError?: boolean }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(confirmationError);
  const { theme } = usePageTheme();
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  return (
    <div className="loginPackage min-h-screen bg-[#000000] text-[#1C2024] relative selection:bg-[#008F83]/15 selection:text-[#008F83] overflow-x-clip">
      <a
        href="#gallery-parallax"
        onClick={(event) => {
          event.preventDefault();
          jumpToFinalLogin();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315BFF]"
      >
        跳到登录
      </a>
      <Navbar theme={theme} redirectTo={redirectTo} />

      <main className="relative z-10">
        <BleibtGooeySection />
        <Skiper30 redirectTo={redirectTo} />
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        theme={theme}
        redirectTo={redirectTo}
        confirmationError={confirmationError}
      />
    </div>
  );
}
