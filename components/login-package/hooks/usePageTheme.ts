import { useState, useEffect, useCallback } from "react";

export type PageTheme = "light" | "dark";

/**
 * 实时精准检测用户当前视口停留位置的背景色：
 * 1. 首页 (Hero)：依据用户需求，必须是白色 ('light')
 * 2. 第二页 (BleibtGooeySection 上部)：流体白色背景区 ('light')
 * 3. 第三页 (BleibtGooeySection 下部)：水波纹下钻放大进入的纯黑背景区 ('dark')
 * 4. 倒数第二页 (Skiper30)：由黑渐变至纯白区，按实际计算亮度 ('light' / 'dark')
 * 5. 页面末尾 (Signup05)：纯黑背景 ('dark')
 */
export function detectCurrentPageTheme(): PageTheme {
  if (typeof window === "undefined") return "light";

  const vh = window.innerHeight || 800;
  const scrollY = window.scrollY || 0;

  // 1. 如果是首页，那就是白色的
  if (scrollY < vh * 0.8) {
    return "light";
  }

  // 2. 检查底部 Footer (Signup05, 纯黑背景)
  const footer = document.querySelector("footer");
  if (footer) {
    const fRect = footer.getBoundingClientRect();
    if (fRect.top <= vh * 0.5) {
      return "dark";
    }
  }

  // 3. 检查倒数第二页 (Skiper30 / #gallery-parallax)
  const gallery = document.getElementById("gallery-parallax");
  if (gallery) {
    const gRect = gallery.getBoundingClientRect();
    if (gRect.top <= vh * 0.55 && gRect.bottom >= vh * 0.35) {
      const computedBg = window.getComputedStyle(gallery).backgroundColor;
      const rgbMatch = computedBg.match(/\d+/g);
      if (rgbMatch && rgbMatch.length >= 3) {
        const r = Number(rgbMatch[0]);
        const g = Number(rgbMatch[1]);
        const b = Number(rgbMatch[2]);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness >= 128 ? "light" : "dark";
      }
      return "light";
    }
  }

  // 4. 检查首页、第二页与第三页 (#product-entropy)
  const runway = document.getElementById("product-entropy");
  if (runway) {
    const rRect = runway.getBoundingClientRect();
    const scrollIntoRunway = -rRect.top;

    // 前 ~2.15vh（首页与第二页）上层为白色表层
    // 超过后进入水波纹下钻放大并吞没全屏为纯黑的第三页
    if (scrollIntoRunway < vh * 2.15) {
      return "light";
    } else {
      return "dark";
    }
  }

  return "light";
}

export function usePageTheme() {
  const [theme, setTheme] = useState<PageTheme>(detectCurrentPageTheme);

  const checkTheme = useCallback(() => {
    const current = detectCurrentPageTheme();
    setTheme((prev) => (prev !== current ? current : prev));
  }, []);

  useEffect(() => {
    checkTheme();

    let rafId = 0;
    const handleScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(() => {
          checkTheme();
          rafId = 0;
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [checkTheme]);

  return { theme, checkTheme };
}
