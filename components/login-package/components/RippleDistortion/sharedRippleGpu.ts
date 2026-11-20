import {
  Renderer,
  Program,
  Mesh,
  Geometry,
  Triangle,
  Texture,
  RenderTarget,
} from "ogl";

export const MAX_WAVES = 48;
const QUALITY_SCALE: Record<string, number> = {
  low: 0.4,
  medium: 0.7,
  high: 1,
};
const START_SCALE = 1.5;
const LIFE_CONSTANT = Math.log(500);
const PI = Math.PI;
const TAU = Math.PI * 2;
const EDGE = 0.006737947;

const LUT_SIZE = 512;
const radialFalloffLut = new Float32Array(LUT_SIZE);
const ringModLut = new Float32Array(LUT_SIZE);
let lastLutRings = -1;

function ensureRippleLut(rings: number) {
  if (rings === lastLutRings) return;
  lastLutRings = rings;
  for (let i = 0; i < LUT_SIZE; i++) {
    const r = i / (LUT_SIZE - 1);
    radialFalloffLut[i] = (Math.exp(-r * 5.0) - EDGE) / (1.0 - EDGE);
    ringModLut[i] = 0.55 + 0.45 * Math.cos(Math.sqrt(r) * PI * 2.0 * rings);
  }
}

export const DEFAULT_HERO_ARTWORK =
  "/login-package/assets/aistudio/The_City_Rises_by_Umberto_Boccioni_1910_c08f466e.webp";

export const waveVertex = `
precision highp float;

attribute vec2 position;
attribute vec2 uv;
attribute vec2 iOffset;
attribute vec2 iScale;
attribute float iOpacity;

varying vec2 vUv;
varying float vOpacity;

void main() {
  vUv = uv;
  vOpacity = iOpacity;
  gl_Position = vec4(iOffset + position * iScale, 0.0, 1.0);
}
`;

export const waveFragment = `
precision highp float;

varying vec2 vUv;
varying float vOpacity;

uniform float uRings;

const float PI = 3.141592653589793;
const float EDGE = 0.006737947;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = dot(p, p);
  if (r > 1.0) discard;

  float brush = (exp(-r * 5.0) - EDGE) / (1.0 - EDGE);
  brush *= 0.55 + 0.45 * cos(sqrt(r) * PI * 2.0 * uRings);

  // R channel: physical ring displacement field
  float ringDisp = brush * vOpacity * vOpacity;
  // G channel: natural radial energy envelope matching homepage ripple size
  float revealEnv = max(abs(brush), exp(-r * 3.2)) * vOpacity * vOpacity;

  gl_FragColor = vec4(ringDisp, revealEnv, 0.0, 1.0);
}
`;

export const screenVertex = `
precision highp float;
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const compositeFragment = `
precision highp float;

varying vec2 vUv;

uniform sampler2D uTexture;
uniform sampler2D uDisplacement;
uniform vec2 uResolution;
uniform vec2 uTextureSize;
uniform vec2 uTexel;
uniform vec3 uTint;
uniform vec3 uHighlight;
uniform float uStrength;
uniform float uSwirl;
uniform float uDispersion;
uniform float uGlint;
uniform float uTintAmount;
uniform float uGrayscale;
uniform float uScrollTransition;
uniform float uPage2Hover;
uniform float uMaskZoneTop;
uniform float uBarrelStrength;
uniform vec2 uPointerOffset;

const float TAU = 6.283185307179586;

// podium.global optical barrel / pincushion lens distortion
vec2 barrelPincushion(vec2 uv, float strength) {
  vec2 st = uv - 0.5;
  float radius = 1.0 + strength * dot(st, st);
  return 0.5 + radius * st;
}

vec2 coverUV(vec2 uv) {
  vec2 safe = max(uTextureSize, vec2(1.0));
  vec2 s = uResolution / safe;
  vec2 scaledSize = safe * max(s.x, s.y);
  vec2 offset = (uResolution - scaledSize) * 0.5;
  return (uv * uResolution - offset) / scaledSize;
}

void main() {
  // Apply podium.global scroll-velocity barrel distortion to screen UV
  vec2 lensUv = barrelPincushion(vUv, uBarrelStrength);
  vec2 clampedLensUv = clamp(lensUv, 0.001, 0.999);

  vec4 dispSample = texture2D(uDisplacement, clampedLensUv);
  float amount = dispSample.r;
  float baseEnv = dispSample.g;

  // Combine coverUV with podium.global damped pointer micro-parallax
  // Scale down image slightly (0.972) around center so pointer parallax never clips edges
  vec2 rawBase = coverUV(clampedLensUv);
  vec2 base = (rawBase - 0.5) * 0.972 + 0.5 + uPointerOffset * 0.014;

  float theta = amount * uSwirl * TAU;
  vec2 dir = vec2(sin(theta), cos(theta));
  vec2 push = dir * amount * uStrength;

  // Radial lens velocity vector for subtle chromatic fringe during fast scroll
  vec2 lensDelta = (vUv - 0.5) * uBarrelStrength * 0.045;

  // Sample neighborhood of G-channel envelope for homepage water-flow reveal
  float n1 = texture2D(uDisplacement, clampedLensUv + vec2(uTexel.x * 3.5, 0.0)).g;
  float n2 = texture2D(uDisplacement, clampedLensUv - vec2(uTexel.x * 3.5, 0.0)).g;
  float n3 = texture2D(uDisplacement, clampedLensUv + vec2(0.0, uTexel.y * 3.5)).g;
  float n4 = texture2D(uDisplacement, clampedLensUv - vec2(0.0, uTexel.y * 3.5)).g;
  float waveEnvelope = (baseEnv * 2.0 + n1 + n2 + n3 + n4) / 6.0;

  vec3 rawColor;
  float effectiveDispersion = uDispersion + abs(uBarrelStrength) * 1.4;
  if (effectiveDispersion > 0.001) {
    float split = effectiveDispersion * 0.25;
    rawColor.r = texture2D(uTexture, base + push * (1.0 + split) + lensDelta).r;
    rawColor.g = texture2D(uTexture, base + push).g;
    rawColor.b = texture2D(uTexture, base + push * (1.0 - split) - lensDelta).b;
  } else {
    rawColor = texture2D(uTexture, base + push).rgb;
  }

  // =========================================================================
  // 1. Pre-processed Blue-Toned State (不划过 / 不hover时只显示蓝色调)
  // =========================================================================
  float lum = dot(rawColor, vec3(0.2126, 0.7152, 0.0722));
  float shapedLum = smoothstep(0.02, 0.98, pow(clamp(lum, 0.0, 1.0), 0.92));

  vec3 deepNavy = vec3(0.035, 0.078, 0.175);
  vec3 cobaltMid = vec3(0.125, 0.345, 0.720);
  vec3 cyanHigh = vec3(0.660, 0.855, 0.985);

  vec3 blueTone = mix(
    mix(deepNavy, cobaltMid, smoothstep(0.0, 0.56, shapedLum)),
    cyanHigh,
    smoothstep(0.46, 1.0, shapedLum)
  );

  blueTone = mix(blueTone, vec3(rawColor.b * 0.22, rawColor.b * 0.52, rawColor.b * 0.95), 0.18);
  float scanline = 0.975 + 0.025 * sin(clampedLensUv.y * uResolution.y * 1.35);
  blueTone *= scanline;

  // =========================================================================
  // 2. Original Color Tone Reveal State (水流划过 & 第二页遮罩 Hover 显露原色调)
  // Restores the painting's authentic original color tone (Umberto Boccioni, 1910)
  // =========================================================================
  vec3 vibrantColor = mix(vec3(lum), rawColor, 1.18);
  vibrantColor = clamp((vibrantColor - 0.5) * 1.06 + 0.5, 0.0, 1.0);

  // Page 1: strictly wave-wake reveal with original homepage dimensions unchanged
  // Page 2 mask interior: seamlessly preserves incoming wave reveal while illuminating on hover
  float screenY = (1.0 - vUv.y) * uResolution.y;
  float inPage2MaskZone = smoothstep(uMaskZoneTop + 12.0, uMaskZoneTop + 68.0, screenY);
  float waveReveal = smoothstep(0.0, 0.19, waveEnvelope + abs(amount) * 0.65);
  float colorReveal = max(waveReveal, uPage2Hover * inPage2MaskZone);

  vec3 color = mix(blueTone, vibrantColor, colorReveal);

  if (uGrayscale > 0.001) {
    color = mix(color, vec3(lum), uGrayscale);
  }

  if (uTintAmount > 0.001) {
    color = mix(color, color * uTint * 1.35, clamp(amount * 1.2, 0.0, 1.0) * uTintAmount * (1.0 - colorReveal * 0.5));
  }

  if (uGlint > 0.001) {
    float ex = texture2D(uDisplacement, clampedLensUv + vec2(uTexel.x, 0.0)).r - texture2D(uDisplacement, clampedLensUv - vec2(uTexel.x, 0.0)).r;
    float ey = texture2D(uDisplacement, clampedLensUv + vec2(0.0, uTexel.y)).r - texture2D(uDisplacement, clampedLensUv - vec2(0.0, uTexel.y)).r;
    vec3 normal = normalize(vec3(-ex * 26.0, -ey * 26.0, 1.0));
    vec3 light = normalize(vec3(-0.35, 0.55, 1.0));
    float raw = pow(max(dot(normal, light), 0.0), 22.0);
    float flatSpec = pow(max(light.z, 0.0), 22.0);
    color += uHighlight * clamp((raw - flatSpec) / max(1.0 - flatSpec, 0.0001), 0.0, 1.0) * uGlint;
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

export const hexToRGB = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [1, 1, 1];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export interface WaveInstance {
  x: number;
  y: number;
  scale: number;
  target: number;
  size: number;
  opacity: number;
}

export interface RippleShaderConfig {
  src: string;
  brushSize: number;
  strength: number;
  swirl: number;
  rings: number;
  spread: number;
  fade: number;
  spacing: number;
  dispersion: number;
  glint: number;
  tint: string;
  tintAmount: number;
  grayscale: boolean;
  highlightColor: string;
  trigger: "hover" | "click";
  clickStrength: number;
  quality: "low" | "medium" | "high";
  enabled: boolean;
}

export interface DisplacementSample {
  amount: number;
  envelope: number;
  pushX: number;
  pushY: number;
}

/**
 * Shared Shader & Scroll State Processor passed to all synchronized subscribers
 * without triggering forced DOM reflows (`getBoundingClientRect`) during scroll.
 */
export interface SharedShaderState {
  scrollY: number;
  scrollVelocity: number;
  dampedScrollVelocity: number;
  barrelStrength: number;
  transitionProgress: number; // 0 in Page 1 -> 1 in Page 2
  pointerClientX: number;
  pointerClientY: number;
  maskZoneTop: number; // Viewport Y of Page 2 top edge
  maskZoneBottom: number; // Viewport Y of Page 2 bottom edge
}

export type FrameSubscriber = (
  glCanvas: HTMLCanvasElement,
  viewportWidth: number,
  viewportHeight: number,
  sampleDisplacement: (clientX: number, clientY: number) => DisplacementSample,
  sharedState: SharedShaderState
) => void;

class SharedRippleGPUManager {
  private renderer: Renderer | null = null;
  private imageTexture: Texture | null = null;
  private displacementTarget: RenderTarget | null = null;
  private waveMesh: Mesh | null = null;
  private compositeMesh: Mesh | null = null;
  private geometry: Geometry | null = null;

  private waveUniforms: any = null;
  private compositeUniforms: any = null;

  private offsets = new Float32Array(MAX_WAVES * 2);
  private scales = new Float32Array(MAX_WAVES * 2);
  private opacities = new Float32Array(MAX_WAVES);
  private waves: WaveInstance[] = Array.from({ length: MAX_WAVES }, () => ({
    x: 0,
    y: 0,
    scale: START_SCALE,
    target: START_SCALE,
    size: 1,
    opacity: 0,
  }));
  // Pre-filtered active waves list for O(1) fast displacement sampling
  private activeWaves: WaveInstance[] = [];
  private currentWaveIdx = 0;

  private width = 1;
  private height = 1;
  private currentSrc = "";
  private rafId = 0;
  private previousTime = 0;
  private lastInputTime = 0;
  private previousX = 0;
  private previousY = 0;

  // Cached scroll & layout state to avoid getBoundingClientRect() reflows during scroll
  private scrollY = 0;
  private lastScrollY = 0;
  private scrollVelocity = 0;
  private dampedScrollVelocity = 0;
  private barrelStrength = 0;
  private lastScrollWaveTime = 0;
  private pointerClientX = 0;
  private pointerClientY = 0;
  private dampedPointerX = 0;
  private dampedPointerY = 0;
  private maskZones = new Map<
    string,
    { docTop: number; height: number; hover: number }
  >();
  private maskZoneDocTop = 0;
  private maskZoneHeight = 0;
  private hasMaskZone = false;
  private page2HoverAmount = 0;

  private subscribers = new Set<FrameSubscriber>();

  private handleVisibilityChange = () => {
    if (document.hidden) {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = 0;
      return;
    }

    if (this.subscribers.size > 0 && !this.rafId) {
      this.previousTime = 0;
      this.rafId = requestAnimationFrame(this.loop);
    }
  };

  private config: RippleShaderConfig = {
    src: DEFAULT_HERO_ARTWORK,
    brushSize: 150,
    strength: 0.03,
    swirl: 0.35,
    rings: 1.75,
    spread: 5,
    fade: 3,
    spacing: 1,
    dispersion: 0.4,
    glint: 0,
    tint: "#a855f7",
    tintAmount: 0.1,
    grayscale: false,
    highlightColor: "#ffffff",
    trigger: "hover",
    clickStrength: 2,
    quality: "medium",
    enabled: true,
  };

  private recomputeMaskZoneBounds() {
    if (this.maskZones.size === 0) {
      this.hasMaskZone = false;
      this.maskZoneDocTop = 0;
      this.maskZoneHeight = 0;
      this.page2HoverAmount = 0;
      return;
    }
    let minTop = Infinity;
    let maxBottom = -Infinity;
    let maxHover = 0;
    this.maskZones.forEach((zone) => {
      if (zone.height > 0) {
        minTop = Math.min(minTop, zone.docTop);
        maxBottom = Math.max(maxBottom, zone.docTop + zone.height);
        maxHover = Math.max(maxHover, zone.hover);
      }
    });
    if (minTop < Infinity && maxBottom > minTop) {
      this.hasMaskZone = true;
      this.maskZoneDocTop = minTop;
      this.maskZoneHeight = maxBottom - minTop;
      this.page2HoverAmount = maxHover;
    } else {
      this.hasMaskZone = false;
    }
  }

  /**
   * Registers a section's document-relative offsetTop and height so viewport bounds
   * can be computed purely from `this.scrollY` with zero layout thrashing.
   */
  public setMaskZoneDocumentBounds(
    docTop: number,
    height: number,
    zoneId = "page2"
  ) {
    const existing = this.maskZones.get(zoneId);
    this.maskZones.set(zoneId, {
      docTop,
      height,
      hover: existing ? existing.hover : 0,
    });
    this.recomputeMaskZoneBounds();
  }

  public clearMaskZone(zoneId = "page2") {
    this.maskZones.delete(zoneId);
    this.recomputeMaskZoneBounds();
  }

  /**
   * Synchronizes mask section hover intensity (0 = unhovered blue state, 1 = hovered original color tone state)
   */
  public setPage2HoverAmount(amount: number, zoneId = "page2") {
    const clamped = Math.max(0, Math.min(1, amount));
    const existing = this.maskZones.get(zoneId);
    if (existing) {
      existing.hover = clamped;
      let maxHover = 0;
      this.maskZones.forEach((z) => {
        if (z.hover > maxHover) maxHover = z.hover;
      });
      this.page2HoverAmount = maxHover;
    } else {
      this.page2HoverAmount = clamped;
    }
  }

  private initGPU() {
    if (this.renderer || typeof window === "undefined") return;

    const canvas = document.createElement("canvas");
    if (!canvas.getContext("webgl2") && !canvas.getContext("webgl")) return;

    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    this.scrollY = window.scrollY || 0;
    this.lastScrollY = this.scrollY;
    this.pointerClientX = window.innerWidth * 0.52;
    this.pointerClientY = window.innerHeight * 0.36;

    this.renderer = new Renderer({
      canvas,
      alpha: false,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 1.25),
    });

    const gl = this.renderer.gl;
    gl.clearColor(0, 0, 0, 1);

    this.imageTexture = new Texture(gl, {
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });

    this.geometry = new Geometry(gl, {
      position: {
        size: 2,
        data: new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      },
      uv: {
        size: 2,
        data: new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
      },
      iOffset: { instanced: 1, size: 2, data: this.offsets },
      iScale: { instanced: 1, size: 2, data: this.scales },
      iOpacity: { instanced: 1, size: 1, data: this.opacities },
    });

    this.waveUniforms = { uRings: { value: this.config.rings } };
    const waveProgram = new Program(gl, {
      vertex: waveVertex,
      fragment: waveFragment,
      uniforms: this.waveUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      cullFace: false,
    });
    waveProgram.setBlendFunc(gl.ONE, gl.ONE);
    this.waveMesh = new Mesh(gl, {
      geometry: this.geometry,
      program: waveProgram,
      frustumCulled: false,
    });

    this.displacementTarget = new RenderTarget(gl, {
      width: 2,
      height: 2,
      depth: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });

    this.compositeUniforms = {
      uTexture: { value: this.imageTexture },
      uDisplacement: { value: this.displacementTarget.texture },
      uResolution: { value: [1, 1] },
      uTextureSize: { value: [1, 1] },
      uTexel: { value: [1, 1] },
      uTint: { value: hexToRGB(this.config.tint) },
      uHighlight: { value: hexToRGB(this.config.highlightColor) },
      uStrength: { value: this.config.strength },
      uSwirl: { value: this.config.swirl },
      uDispersion: { value: this.config.dispersion },
      uGlint: { value: this.config.glint },
      uTintAmount: { value: this.config.tintAmount },
      uGrayscale: { value: this.config.grayscale ? 1 : 0 },
      uScrollTransition: { value: 0 },
      uPage2Hover: { value: 0 },
      uMaskZoneTop: { value: 99999 },
      uBarrelStrength: { value: 0 },
      uPointerOffset: { value: [0, 0] },
    };

    this.compositeMesh = new Mesh(gl, {
      geometry: new Triangle(gl),
      program: new Program(gl, {
        vertex: screenVertex,
        fragment: compositeFragment,
        uniforms: this.compositeUniforms,
        depthTest: false,
        depthWrite: false,
      }),
    });

    this.loadTexture(this.config.src);
    this.handleResize();

    window.addEventListener("resize", this.handleResize, { passive: true });
    window.addEventListener("scroll", this.handleScroll, { passive: true });
    window.addEventListener("pointermove", this.handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerdown", this.handlePointerDown, {
      passive: true,
    });
  }

  private handleScroll = () => {
    this.scrollY = window.scrollY || 0;
    this.lastInputTime = performance.now();
  };

  private loadTexture(src: string) {
    if (!this.imageTexture || !this.compositeUniforms || this.currentSrc === src)
      return;
    this.currentSrc = src;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (!this.imageTexture || !this.compositeUniforms) return;
      this.imageTexture.image = img;
      this.compositeUniforms.uTextureSize.value = [
        img.naturalWidth || 1,
        img.naturalHeight || 1,
      ];
    };
    img.src = src;
  }

  private handleResize = () => {
    if (!this.renderer || !this.displacementTarget || !this.compositeUniforms)
      return;
    this.width = Math.max(1, window.innerWidth);
    this.height = Math.max(1, window.innerHeight);

    this.renderer.setSize(this.width, this.height);
    this.compositeUniforms.uResolution.value = [this.width, this.height];

    const scale = QUALITY_SCALE[this.config.quality] || QUALITY_SCALE.medium;
    const fieldW = Math.max(2, Math.round(this.width * scale));
    const fieldH = Math.max(2, Math.round(this.height * scale));
    this.displacementTarget.setSize(fieldW, fieldH);
    this.compositeUniforms.uTexel.value = [1 / fieldW, 1 / fieldH];
  };

  /**
   * Returns 0 strictly everywhere on Page 1 (`clientY <= top`),
   * and blends to 1 only inside Page 2 so Page 1 wave dimensions never change.
   */
  private getMaskZoneBlend(clientY: number): number {
    if (!this.hasMaskZone) return 0;
    const top = this.maskZoneDocTop - this.scrollY;
    const bottom = top + this.maskZoneHeight;
    if (clientY <= top || clientY >= bottom) return 0;
    const enterTop = Math.max(0, Math.min(1, (clientY - top) / 80));
    const exitBottom = Math.max(0, Math.min(1, (bottom - clientY) / 80));
    return Math.min(enterTop, exitBottom);
  }

  public spawnWave = (
    glX: number,
    glY: number,
    power = 1,
    maskBlend = 0
  ) => {
    const wave = this.waves[this.currentWaveIdx];
    this.currentWaveIdx = (this.currentWaveIdx + 1) % MAX_WAVES;
    wave.x = glX;
    wave.y = glY;

    // Page 1 (maskBlend = 0) keeps exact original brushSize (150) & spread (5).
    // Page 2 (maskBlend > 0) matches the compact liquid mask diameter.
    const effectiveBrush =
      this.config.brushSize * (1 - maskBlend) + 125 * maskBlend;
    const effectiveSpread =
      this.config.spread * (1 - maskBlend) + 2.85 * maskBlend;

    wave.scale = START_SCALE * power;
    wave.target = START_SCALE * Math.max(1, effectiveSpread) * power;
    wave.size = Math.max(1, effectiveBrush);
    wave.opacity = 1;
  };

  public spawnWaveAtClient = (
    clientX: number,
    clientY: number,
    power = 0.85
  ) => {
    if (!this.config.enabled) return;
    const glX = clientX;
    const glY = this.height - clientY;
    const blend = this.getMaskZoneBlend(clientY);
    this.spawnWave(glX, glY, power, blend);
  };

  private handlePointerMove = (e: PointerEvent) => {
    this.pointerClientX = e.clientX;
    this.pointerClientY = e.clientY;
    this.lastInputTime = performance.now();
    if (!this.config.enabled || this.config.trigger === "click") return;
    const glX = e.clientX;
    const glY = this.height - e.clientY;
    const blend = this.getMaskZoneBlend(e.clientY);
    const step = Math.max(1, this.config.spacing);
    if (
      Math.abs(glX - this.previousX) >= step ||
      Math.abs(glY - this.previousY) >= step
    ) {
      this.spawnWave(glX, glY, 1, blend);
      this.previousX = glX;
      this.previousY = glY;
    }
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.pointerClientX = e.clientX;
    this.pointerClientY = e.clientY;
    this.lastInputTime = performance.now();
    if (!this.config.enabled) return;
    const glX = e.clientX;
    const glY = this.height - e.clientY;
    const blend = this.getMaskZoneBlend(e.clientY);
    this.spawnWave(glX, glY, Math.max(1, this.config.clickStrength), blend);
  };

  /**
   * Fast O(K) displacement evaluator iterating only over currently active waves using precomputed LUT.
   */
  public sampleDisplacement = (
    clientX: number,
    clientY: number
  ): DisplacementSample => {
    const activeCount = this.activeWaves.length;
    if (activeCount === 0) {
      return { amount: 0, envelope: 0, pushX: 0, pushY: 0 };
    }

    const glX = clientX;
    const glY = this.height - clientY;
    let amount = 0;
    let envelope = 0;

    const rings = this.config.rings;
    ensureRippleLut(rings);

    for (let i = 0; i < activeCount; i++) {
      const w = this.activeWaves[i];
      const half = w.scale * w.size * 0.5;
      const dx = glX - w.x;
      const dy = glY - w.y;

      // Fast axis-aligned bounding check before division
      if (dx > half || dx < -half || dy > half || dy < -half) continue;

      const px = dx / half;
      const py = dy / half;
      const r = px * px + py * py;
      if (r >= 1.0) continue;

      const lutIdx = (r * (LUT_SIZE - 1)) | 0;
      const radialFalloff = radialFalloffLut[lutIdx];
      const ringMod = ringModLut[lutIdx];
      const waveVal = radialFalloff * ringMod * w.opacity * w.opacity;

      amount += Math.max(0, waveVal);
      envelope += radialFalloff * w.opacity;
    }

    if (amount === 0 && envelope === 0) {
      return { amount: 0, envelope: 0, pushX: 0, pushY: 0 };
    }

    amount = Math.min(amount, 1.5);
    envelope = Math.min(envelope, 1.2);

    const theta = amount * this.config.swirl * TAU;
    const pushX = Math.sin(theta) * amount * this.config.strength * this.width;
    const pushY =
      -Math.cos(theta) * amount * this.config.strength * this.height;

    return { amount, envelope, pushX, pushY };
  };

  public updateConfig(partial: Partial<RippleShaderConfig>) {
    this.initGPU();
    const prevSrc = this.config.src;
    const prevQuality = this.config.quality;
    this.config = { ...this.config, ...partial };

    if (partial.src && partial.src !== prevSrc) {
      this.loadTexture(partial.src);
    }
    if (partial.quality && partial.quality !== prevQuality) {
      this.handleResize();
    }

    if (this.waveUniforms && this.compositeUniforms) {
      this.waveUniforms.uRings.value = this.config.rings;
      this.compositeUniforms.uStrength.value = this.config.strength;
      this.compositeUniforms.uSwirl.value = this.config.swirl;
      this.compositeUniforms.uDispersion.value = this.config.dispersion;
      this.compositeUniforms.uGlint.value = this.config.glint;
      this.compositeUniforms.uTintAmount.value = this.config.tintAmount;
      this.compositeUniforms.uGrayscale.value = this.config.grayscale ? 1 : 0;
      this.compositeUniforms.uHighlight.value = hexToRGB(
        this.config.highlightColor
      );
      this.compositeUniforms.uTint.value = hexToRGB(this.config.tint);
    }
  }

  public isAvailable() {
    this.initGPU();
    return Boolean(this.renderer);
  }

  public subscribe(fn: FrameSubscriber): () => void {
    this.initGPU();
    if (!this.renderer) return () => {};
    this.subscribers.add(fn);
    if (this.subscribers.size === 1 && !this.rafId && !document.hidden) {
      this.previousTime = 0;
      this.rafId = requestAnimationFrame(this.loop);
    }
    return () => {
      this.subscribers.delete(fn);
      if (this.subscribers.size === 0 && this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
    };
  }

  private loop = (now: number) => {
    if (this.subscribers.size === 0 || document.hidden) {
      this.rafId = 0;
      return;
    }

    const idle = now - this.lastInputTime > 350;
    if (idle && this.previousTime && now - this.previousTime < 1000 / 30) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }
    this.rafId = requestAnimationFrame(this.loop);

    if (
      !this.renderer ||
      !this.geometry ||
      !this.waveMesh ||
      !this.compositeMesh ||
      !this.displacementTarget
    ) {
      return;
    }

    const delta = this.previousTime
      ? Math.min(0.05, (now - this.previousTime) / 1000)
      : 0;
    this.previousTime = now;

    // Update shared scroll & transition state without DOM reflow
    const rawVelocity = this.scrollY - this.lastScrollY;
    this.scrollVelocity = rawVelocity;
    this.lastScrollY = this.scrollY;

    // podium.global damped scroll-velocity barrel pincushion strength
    this.dampedScrollVelocity +=
      (rawVelocity - this.dampedScrollVelocity) * 0.14;
    if (Math.abs(this.dampedScrollVelocity) < 0.01) {
      this.dampedScrollVelocity = 0;
    }
    const targetBarrel = Math.max(
      -0.22,
      Math.min(0.22, this.dampedScrollVelocity * 0.0038)
    );
    this.barrelStrength += (targetBarrel - this.barrelStrength) * 0.16;
    if (Math.abs(this.barrelStrength) < 0.0001) {
      this.barrelStrength = 0;
    }

    // podium.global damped normalized pointer offset in [-0.5, 0.5]
    const normPtrX = this.pointerClientX / Math.max(1, this.width) - 0.5;
    const normPtrY = 0.5 - this.pointerClientY / Math.max(1, this.height);
    this.dampedPointerX += (normPtrX - this.dampedPointerX) * 0.1;
    this.dampedPointerY += (normPtrY - this.dampedPointerY) * 0.1;

    const maskZoneTop = this.hasMaskZone
      ? this.maskZoneDocTop - this.scrollY
      : this.height * 2;
    const maskZoneBottom = maskZoneTop + this.maskZoneHeight;
    const transitionProgress = Math.max(
      0,
      Math.min(1, 1 - maskZoneTop / Math.max(1, this.height))
    );

    // Emit continuous water ripples at cursor while scrolling between Page 1 and Page 2
    if (
      this.config.enabled &&
      Math.abs(rawVelocity) > 0.6 &&
      maskZoneTop > -this.height * 0.35 &&
      maskZoneTop < this.height * 1.15 &&
      now - this.lastScrollWaveTime > 62
    ) {
      this.lastScrollWaveTime = now;
      this.spawnWaveAtClient(
        this.pointerClientX,
        this.pointerClientY,
        Math.min(1.0, 0.72 + Math.abs(rawVelocity) * 0.012)
      );
    }

    if (this.compositeUniforms) {
      this.compositeUniforms.uScrollTransition.value = transitionProgress;
      this.compositeUniforms.uPage2Hover.value = this.page2HoverAmount;
      this.compositeUniforms.uMaskZoneTop.value = maskZoneTop;
      this.compositeUniforms.uBarrelStrength.value = this.barrelStrength;
      this.compositeUniforms.uPointerOffset.value = [
        this.dampedPointerX,
        this.dampedPointerY,
      ];
    }

    const growth = 1 - Math.exp(-delta * 1.09);
    const decay = Math.exp(
      (-delta * LIFE_CONSTANT) / Math.max(0.15, this.config.fade)
    );

    this.activeWaves.length = 0;

    for (let i = 0; i < MAX_WAVES; i++) {
      const wave = this.waves[i];
      if (wave.opacity <= 0) {
        this.opacities[i] = 0;
        continue;
      }

      wave.opacity *= decay;
      wave.scale += (wave.target - wave.scale) * growth;

      if (wave.opacity < 0.003) {
        wave.opacity = 0;
        this.opacities[i] = 0;
        continue;
      }

      this.activeWaves.push(wave);

      const half = (wave.scale * wave.size) / 2;
      this.offsets[i * 2] = (wave.x / this.width) * 2 - 1;
      this.offsets[i * 2 + 1] = (wave.y / this.height) * 2 - 1;
      this.scales[i * 2] = (half / this.width) * 2;
      this.scales[i * 2 + 1] = (half / this.height) * 2;
      this.opacities[i] = wave.opacity;
    }

    // Only execute WebGL FBO render passes when Page 1 or the visible top 40% of Page 2 is in viewport
    const isWebGLVisible =
      !this.hasMaskZone ||
      (maskZoneTop > -this.height * 0.45 &&
        maskZoneTop < this.height * 1.15);
    if (isWebGLVisible) {
      this.geometry.attributes.iOffset.needsUpdate = true;
      this.geometry.attributes.iScale.needsUpdate = true;
      this.geometry.attributes.iOpacity.needsUpdate = true;

      this.renderer.render({
        scene: this.waveMesh,
        target: this.displacementTarget,
        clear: true,
      });
      this.renderer.render({ scene: this.compositeMesh });
    }

    const glCanvas = this.renderer.gl.canvas as HTMLCanvasElement;
    const sharedState: SharedShaderState = {
      scrollY: this.scrollY,
      scrollVelocity: this.scrollVelocity,
      dampedScrollVelocity: this.dampedScrollVelocity,
      barrelStrength: this.barrelStrength,
      transitionProgress,
      pointerClientX: this.pointerClientX,
      pointerClientY: this.pointerClientY,
      maskZoneTop,
      maskZoneBottom,
    };

    this.subscribers.forEach((fn) =>
      fn(
        glCanvas,
        this.width,
        this.height,
        this.sampleDisplacement,
        sharedState
      )
    );
  };
}

export const sharedRippleGPU = new SharedRippleGPUManager();
