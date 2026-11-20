import type { Metadata } from "next";
import "./globals.css";
import "./liquid-theme.css";
import "@/components/ui/line-icons/line-icons.css";
import { cn } from "@/lib/utils";
import { LanguageProvider } from "@/context/LanguageContext";

export const metadata: Metadata = {
  title: "Omnilink",
  description: "面向 AI 时代的商家经营中枢 | Merchant Control Center for the AI Era",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={cn("h-full antialiased")}
    >
      <body data-liquid-theme="white" suppressHydrationWarning className="min-h-full flex flex-col font-sans bg-[var(--background)] text-[var(--ink)]">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
