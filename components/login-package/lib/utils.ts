import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function jumpToFinalLogin() {
  if (typeof window === "undefined") return;
  const gallery = document.getElementById("gallery-parallax");
  if (!gallery) return;

  const viewportHeight = window.innerHeight || 800;
  const targetY = Math.round(
    gallery.getBoundingClientRect().top + window.scrollY + viewportHeight * 0.38,
  );

  window.dispatchEvent(new CustomEvent("omnilink:open-final-login"));
  window.scrollTo({ top: targetY, behavior: "instant" });
}
