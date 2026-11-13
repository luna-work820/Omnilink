import React from "react";
import { StaggeredMenu } from "./StaggeredMenu";
import { PageTheme } from "@/components/login-package/hooks/usePageTheme";

interface NavbarProps {
  onOpenAuth?: () => void;
  theme?: PageTheme;
  redirectTo?: string;
}

export function Navbar({ onOpenAuth, theme, redirectTo }: NavbarProps) {
  return (
    <div className="fixed top-0 inset-x-0 z-50 pointer-events-none">
      <StaggeredMenu
        position="right"
        isFixed={true}
        theme={theme}
        changeMenuColorOnOpen={true}
        colors={["#FF6B00", "#315BFF"]}
        accentColor="#315BFF"
        onLoginClick={onOpenAuth}
        redirectTo={redirectTo}
      />
    </div>
  );
}
