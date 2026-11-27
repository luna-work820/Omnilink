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
      <head>
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `(function(i,m,p,a,c,t){c.ire_o=p;c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};t=a.createElement(m);var z=a.getElementsByTagName(m)[0];t.async=1;t.src=i;z.parentNode.insertBefore(t,z)})('https://utt.impactcdn.com/P-A8204156-4e97-47fa-a73f-30751a9075b01.js','script','impactStat',document,window);impactStat('transformLinks');impactStat('trackImpression');`,
          }}
        />
      </head>
      <body data-liquid-theme="white" suppressHydrationWarning className="min-h-full flex flex-col font-sans bg-[var(--background)] text-[var(--ink)]">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
