import { adapt, pickInk, tintFloor } from "./adapt.js";
import { liquidGlass } from "./lens.js";

type Tone = "auto" | "dark";
type Rgb = [number, number, number];
type BackdropSample = { luminance: number; texture: number; color: Rgb };

type SurfaceOptions = {
  tone?: Tone;
  radius?: number;
  rim?: number;
  dispersion?: number;
  tint?: number;
};

export function setupGlassworkSurface(el: HTMLElement, options: SurfaceOptions = {}) {
  const tone = options.tone ?? "auto";
  const dispersion = clamp(options.dispersion ?? 0.15, 0, 0.4);
  const tint = clamp(options.tint ?? 1, 0, 1.5);
  const existingRadius = getComputedStyle(el).borderRadius;
  el.style.setProperty("--glasswork-radius", existingRadius);
  el.classList.add("glass");
  el.style.setProperty("--glass-k", String(tint));
  markWebkitEngine();

  const lens = liquidGlass(el, {
    rim: clamp(options.rim ?? 40, 4, 96),
    dispersion,
    radius: options.radius ?? null,
  });

  let frame = 0;
  const refresh = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => applyBackdropSample(el, tone));
  };
  refresh();
  window.addEventListener("scroll", refresh, true);
  window.addEventListener("resize", refresh);
  window.addEventListener("load", refresh, true);
  window.addEventListener("loadeddata", refresh, true);
  window.addEventListener("market-glass-preferences", refresh);
  const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  colorScheme.addEventListener("change", refresh);
  const themeObserver = new MutationObserver(refresh);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });
  const shell = el.closest<HTMLElement>(".consumer-market-shell");
  if (shell) {
    themeObserver.observe(shell, {
      attributes: true,
      attributeFilter: ["data-color-scheme"],
    });
  }

  return {
    refresh,
    destroy() {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("load", refresh, true);
      window.removeEventListener("loadeddata", refresh, true);
      window.removeEventListener("market-glass-preferences", refresh);
      colorScheme.removeEventListener("change", refresh);
      themeObserver.disconnect();
      lens.destroy();
    },
  };
}

function markWebkitEngine() {
  const userAgent = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari\//.test(userAgent) && !/(?:Chrome|Chromium|Edg|OPR)\//.test(userAgent);
  if (isIos || isSafari) document.documentElement.dataset.engine = "webkit";
}

export function observeGlassworkSurfaces(root: HTMLElement) {
  const surfaces = new Map<HTMLElement, ReturnType<typeof setupGlassworkSurface>>();
  const attach = (node: Element) => {
    const candidates = [
      ...(node.matches("[data-glasswork]") ? [node] : []),
      ...Array.from(node.querySelectorAll("[data-glasswork]")),
    ];
    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement) || surfaces.has(candidate)) continue;
      const tone = candidate.dataset.glasswork === "dark" ? "dark" : "auto";
      surfaces.set(candidate, setupGlassworkSurface(candidate, {
        tone,
        radius: numberAttribute(candidate, "glassworkRadius"),
        rim: numberAttribute(candidate, "glassworkRim"),
        dispersion: numberAttribute(candidate, "glassworkDispersion"),
        tint: numberAttribute(candidate, "glassworkTint"),
      }));
    }
  };

  attach(root);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) attach(node);
      });
    }
    for (const [element, surface] of surfaces) {
      if (!root.contains(element)) {
        surface.destroy();
        surfaces.delete(element);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    for (const surface of surfaces.values()) surface.destroy();
    surfaces.clear();
  };
}

function numberAttribute(el: HTMLElement, key: string) {
  const raw = el.dataset[key];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function applyBackdropSample(el: HTMLElement, requestedTone: Tone) {
  const sample = sampleBackdrop(el);
  const previous = el.dataset.glassInk ?? readLastGlassInk();
  const brightest = sample ? clamp(sample.luminance + sample.texture / 2, 0, 1) : 1;
  const useLightInk = sample
    ? (requestedTone === "dark" && brightest <= 0.08) || pickInk(brightest, previous, 0.08, 0.02) === "light"
    : false;
  const kind = useLightInk ? "dark" : "light";
  const ink = kind === "dark" ? "light" : "dark";
  const tintLuminance = 1;
  const adapted = sample ? adapt(sample, ink) : { density: 1, saturate: 1 };
  const floor = sample
    ? ink === "dark" ? tintFloor(sample.luminance, sample.texture, ink, tintLuminance) : 0
    : ink === "dark" ? 0.18 : 0;
  const inkColor = ink === "light" ? "rgb(255 255 255 / 0.94)" : "rgb(0 0 0 / 0.86)";
  const secondaryInk = ink === "light" ? "rgb(235 235 245 / 0.64)" : "rgb(60 60 67 / 0.7)";

  el.dataset.kind = kind;
  el.dataset.glassInk = ink;
  el.style.setProperty("--density", String(ink === "light" ? 0 : adapted.density));
  el.style.setProperty("--keep", String(adapted.saturate));
  el.style.setProperty("--floor", String(floor));
  el.style.setProperty("--market-ink", inkColor);
  el.style.setProperty("--market-text-secondary", secondaryInk);
  rememberGlassInk(ink);
}

function sampleBackdrop(el: HTMLElement): BackdropSample | null {
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  const samples: Rgb[] = [];
  const xStops = [0.1, 0.3, 0.5, 0.7, 0.9];
  const yStops = [0.16, 0.5, 0.84];
  try {
    for (const yRatio of yStops) {
      for (const xRatio of xStops) {
        const x = rect.left + rect.width * xRatio;
        const y = rect.top + rect.height * yRatio;
        let sampled: Rgb | null = null;
        for (const hit of document.elementsFromPoint(x, y)) {
          if (hit === el || el.contains(hit) || !(hit instanceof HTMLElement)) continue;
          if (hit instanceof HTMLVideoElement || hit instanceof HTMLCanvasElement) return null;
          sampled = sampleElement(hit, x, y, context);
          if (sampled) break;
        }
        if (sampled) samples.push(sampled);
      }
    }
  } catch {
    return null;
  }

  if (samples.length < 8) return null;
  const ranked = samples
    .map((color) => ({ color, luminance: luminance(color) }))
    .sort((a, b) => a.luminance - b.luminance);
  const kept = ranked.slice(2, -2);
  const count = kept.length || ranked.length;
  const colors = kept.length ? kept : ranked;
  const color: Rgb = [0, 1, 2].map((channel) =>
    Math.round(colors.reduce((sum, sample) => sum + sample.color[channel], 0) / count),
  ) as Rgb;
  const lumValues = ranked.map((sample) => sample.luminance);
  return {
    color,
    luminance: luminance(color),
    texture: Math.max(...lumValues) - Math.min(...lumValues),
  };
}

function sampleElement(element: HTMLElement, x: number, y: number, context: CanvasRenderingContext2D): Rgb | null {
  if (element instanceof HTMLImageElement) {
    if (!element.complete || !element.naturalWidth || !element.naturalHeight) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const scale = style.objectFit === "cover"
      ? Math.max(rect.width / element.naturalWidth, rect.height / element.naturalHeight)
      : Math.min(rect.width / element.naturalWidth, rect.height / element.naturalHeight);
    const renderedWidth = element.naturalWidth * scale;
    const renderedHeight = element.naturalHeight * scale;
    const sourceX = clamp(((x - rect.left) - (rect.width - renderedWidth) / 2) / scale, 0, element.naturalWidth - 1);
    const sourceY = clamp(((y - rect.top) - (rect.height - renderedHeight) / 2) / scale, 0, element.naturalHeight - 1);
    context.clearRect(0, 0, 1, 1);
    context.drawImage(element, sourceX, sourceY, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  }

  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const color = parseRgb(getComputedStyle(current).backgroundColor);
    if (color) return color;
  }
  return null;
}

function parseRgb(value: string): Rgb | null {
  const values = value.match(/[\d.]+/g)?.map(Number);
  if (!values || values.length < 3 || (values[3] ?? 1) === 0) return null;
  return [values[0], values[1], values[2]];
}

function luminance([r, g, b]: Rgb) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readLastGlassInk() {
  try {
    const value = window.localStorage.getItem("omnilink-glass-ink");
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

function rememberGlassInk(ink: "dark" | "light") {
  try {
    window.localStorage.setItem("omnilink-glass-ink", ink);
  } catch {
    // The current surface still adapts when browser storage is unavailable.
  }
}
