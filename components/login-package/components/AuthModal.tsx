import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { LoginForm } from "@/components/login-package/components/login-form";
import { SignupForm } from "@/components/login-package/components/SignupForm";
import TextCursor from "@/components/login-package/components/TextCursor";
import { PageTheme } from "@/components/login-package/hooks/usePageTheme";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: PageTheme;
}

export function AuthModal({ isOpen, onClose, theme = "light" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const isDark = theme === "dark";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* 向左弹出的登录/创建页面（根据停留区域自适应纯白或纯黑）+ 末尾同款 TextCursor 动效文字 */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className={`relative w-full md:w-[44vw] min-w-[360px] max-w-[580px] h-full shadow-2xl z-10 flex flex-col justify-between p-6 sm:p-10 overflow-y-auto overflow-x-hidden transition-colors ${
              isDark
                ? "bg-[#0B0C0E] text-white border-l border-white/10"
                : "bg-white text-[#0B0C0E] border-l border-black/10"
            }`}
          >
            {/* Background TextCursor Effect (same as footer Signup05) */}
            <div
              className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
              style={{ height: "100%", position: "absolute" }}
            >
              <TextCursor
                text="Hello"
                mode="ribbon"
                fontSize="33px"
                spacing={88}
                maxPoints={7}
                shrink={0.5}
                fade={0.6}
                smoothing={0.3}
                exitDuration={0.5}
                removalInterval={30}
                followMouseDirection
                keepUpright
                randomFloat
                popIn
                hideCursor={false}
                color={isDark ? "rgba(110, 145, 255, 0.42)" : "rgba(49, 91, 255, 0.42)"}
              />
            </div>

            {/* Top Bar with Close Button & Mode Switcher */}
            <div className="relative z-10 flex flex-col gap-4">
              <div
                className={`flex items-center justify-end pb-3 border-b ${
                  isDark ? "border-white/10" : "border-black/10"
                }`}
              >
                <button
                  onClick={onClose}
                  className={`p-2 rounded-full transition-colors cursor-pointer ${
                    isDark
                      ? "bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white"
                      : "bg-black/5 hover:bg-black/10 text-neutral-600 hover:text-black"
                  }`}
                  aria-label="关闭窗口"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

            </div>

            {/* Form Container with Bottom-Only Switcher */}
            <div className="relative z-10 flex-1 flex flex-col justify-center max-w-sm mx-auto w-full py-6">
              {mode === "login" ? (
                <LoginForm
                  variant={theme}
                  hideTitle={false}
                  onSwitchToSignup={() => setMode("signup")}
                />
              ) : (
                <SignupForm
                  variant={theme}
                  hideTitle={false}
                  onSwitchToLogin={() => setMode("login")}
                />
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
