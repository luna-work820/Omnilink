'use client'

import React, { useEffect, useRef, useState } from 'react'
import { UnifiedAuthForm } from '@/components/auth/UnifiedAuthForm'
import { BrandStudioWizard } from '@/components/onboarding/wizard'
import { LightLiquidGlassCanvas } from '@/components/onboarding/LightLiquidGlassCanvas'
import { ArrowRight, ChevronDown } from 'lucide-react'

export function KeynoteMotionLanding({ initialShowLogin = false }: { initialShowLogin?: boolean }) {
  const compRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const rulerRef = useRef<HTMLSpanElement>(null)
  const onboardingRef = useRef<HTMLDivElement>(null)
  const [showLoginModal, setShowLoginModal] = useState(initialShowLogin)

  const DUR = 30.122
  const W = 1280
  const H = 720

  useEffect(() => {
    const comp = compRef.current
    const stage = stageRef.current
    const ruler = rulerRef.current
    if (!comp || !stage || !ruler) return

    comp.innerHTML = ''

    const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a || 1e-6), 0, 1)
    const smooth = (t: number) => t * t * (3 - 2 * t)
    const eOut = (t: number) => 1 - Math.pow(1 - t, 3)
    const back = (t: number) => {
      const c = 1.6
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
    }

    const compEl = comp
    const rulerEl = ruler

    function rng(s: number) {
      let a = s >>> 0
      return function () {
        a += 0x6d2b79f5
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }

    function el(tag: string, cls?: string, parent?: HTMLElement, html?: string) {
      const n = document.createElement(tag)
      if (cls) n.className = cls
      if (html != null) n.innerHTML = html
      ;(parent || compEl).appendChild(n)
      return n
    }

    function setT(n: any, v: string) {
      if (n._t !== v) {
        n._t = v
        n.style.transform = v
      }
    }
    function setO(n: any, v: number) {
      const r = clamp(v, 0, 1).toFixed(3)
      if (n._o !== r) {
        n._o = r
        n.style.opacity = r
      }
    }
    function setF(n: any, v: string) {
      if (n._f !== v) {
        n._f = v
        n.style.filter = v
      }
    }
    const TXY = 'translateY(-50%) '

    function fitPx(str: string, target: number, weight?: string | number) {
      if (!rulerEl) return 80
      rulerEl.style.fontWeight = String(weight || 700)
      rulerEl.style.fontSize = '100px'
      rulerEl.textContent = str
      return (100 * target) / (rulerEl.getBoundingClientRect().width || 1)
    }

    function letters(node: HTMLElement, str: string) {
      node.textContent = ''
      const out: HTMLElement[] = []
      for (let i = 0; i < str.length; i++) {
        const s = document.createElement('span')
        s.textContent = str[i] === ' ' ? '\u00a0' : str[i]
        node.appendChild(s)
        out.push(s)
      }
      return out
    }

    function textLine(scene: HTMLElement, str: string, targetW: number) {
      const wrap = el('div', 'line', scene)
      const tx = el('div', 'tx', wrap)
      tx.style.color = 'var(--ink)'
      const fs = fitPx(str, targetW)
      tx.style.fontSize = fs.toFixed(2) + 'px'
      return { wrap, tx, chars: letters(tx, str), fs }
    }

    const BRAND_SYMBOL = `<svg viewBox="0 0 24 24" aria-hidden="true" class="w-full h-full"><path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`

    // 1 & 21 · OMNILINK wordmark chromatic assemble
    function makeWordmark() {
      const s = el('div', 'scene')
      const wrap = el('div', 'line', s)
      const tx = el('div', 'tx', wrap)
      const fs = fitPx('OMNILINK', 660, 800)
      tx.style.fontSize = fs.toFixed(2) + 'px'
      tx.style.letterSpacing = '-0.03em'
      tx.style.fontWeight = '800'
      tx.style.color = 'var(--ink)'
      const mk = el('span', 'mark', tx, BRAND_SYMBOL)
      mk.style.color = 'var(--primary)'
      const chars: HTMLElement[] = []
      const str = 'OMNILINK'
      for (let i = 0; i < str.length; i++) {
        const sp = document.createElement('span')
        sp.textContent = str[i] === ' ' ? '\u00a0' : str[i]
        sp.style.color = 'var(--ink)'
        tx.appendChild(sp)
        chars.push(sp)
      }
      const R = rng(7719)
      const jit = chars.map(() => [R() * 2 - 1, R() * 2 - 1, R()])

      return {
        node: s,
        update: function (t: number, p: number) {
          setO(mk, smooth(seg(p, 0.26, 0.5)))
          setT(mk, 'scale(' + lerp(0.55, 1, eOut(seg(p, 0.26, 0.56))).toFixed(3) + ')')
          for (let i = 0; i < chars.length; i++) {
            const j = jit[i]
            const a = eOut(clamp(seg(p, 0.02, 0.5) * 1.5 - j[2] * 0.5, 0, 1))
            setT(
              chars[i],
              'translate(' +
                (j[0] * 62 * (1 - a)).toFixed(1) +
                'px,' +
                (j[1] * 34 * (1 - a)).toFixed(1) +
                'px) scale(' +
                lerp(1.24, 1, a).toFixed(3) +
                ')'
            )
            setO(chars[i], Math.min(1, a * 1.6))
            const sep = (1 - a) * 11
            chars[i].style.textShadow =
              sep > 0.4
                ? (-sep).toFixed(1) +
                  'px 0 rgba(2,74,216,0.85),' +
                  sep.toFixed(1) +
                  'px 0 rgba(0,180,140,0.8),0 ' +
                  (sep * 0.55).toFixed(1) +
                  'px rgba(120,40,255,0.7)'
                : 'none'
            setF(chars[i], sep > 0.7 ? 'blur(' + (sep * 0.3).toFixed(2) + 'px)' : 'none')
          }
        },
      }
    }

    // 2 · Wall of creative windows
    const WALLPAL = [
      ['#1c6b47', '#93d46b'],
      ['#8a1d3c', '#f05a6d'],
      ['var(--primary)', '#4aa8f0'],
      ['#572a86', '#c07af0'],
      ['#7d4a12', '#f0b45a'],
      ['#0e4f54', '#4fd6c8'],
      ['#6b1050', '#f05ac0'],
      ['#24406b', '#7aa8f0'],
      ['#3a5f10', '#b0e05a'],
      ['#6b2a10', '#f08a5a'],
      ['#02226b', '#8a8af0'],
      ['#0d5a2c', '#5ad68a'],
    ]
    function makeWall() {
      const s = el('div', 'scene')
      const R = rng(4242)
      const wins: any[] = []
      for (let i = 0; i < 34; i++) {
        const w = el('div', 'win', s)
        const pal = WALLPAL[Math.floor(R() * WALLPAL.length)]
        const variant = i % 6
        const bw = lerp(160, 330, R())
        const bh = bw * lerp(0.6, 0.68, R())
        w.style.width = bw.toFixed(0) + 'px'
        w.style.height = bh.toFixed(0) + 'px'
        el('div', 'bar', w, '<i></i><i></i><i></i>')
        const body = el('div', 'body', w)
        body.style.background = '#0d0d12'
        const pane = el('div', 'pane', body)
        pane.style.background = 'linear-gradient(150deg,' + pal[0] + ',' + pal[1] + ')'
        pane.style.opacity = '0.82'
        let k: number
        if (variant === 0) {
          el('div', 'side', body, '<u></u><u></u><u></u><u></u><u></u>')
          const st = el('div', 'strip', body)
          st.style.height = '26%'
          for (k = 0; k < 5; k++) {
            const u = el('u', '', st)
            u.style.left = 6 + k * 18 + '%'
            u.style.width = '15%'
            u.style.height = '11px'
            u.style.background = k % 2 ? pal[1] : '#3f4a6a'
          }
        } else if (variant === 1) {
          pane.style.display = 'none'
          const st2 = el('div', 'strip', body)
          st2.style.height = '56%'
          for (k = 0; k < 7; k++) {
            const u2 = el('u', '', st2)
            u2.style.left = 3 + k * 13.6 + '%'
            u2.style.width = '12%'
            u2.style.height = 10 + (k % 3) * 8 + 'px'
            u2.style.bottom = 7 + (k % 3) * 15 + 'px'
            u2.style.background = k % 2 ? pal[1] : pal[0]
          }
        } else if (variant === 2) {
          pane.style.display = 'none'
          body.style.background = '#e9e9ee'
          const bars = el('div', 'bars', body)
          for (k = 0; k < 6; k++) {
            const b = el('u', '', bars)
            b.style.height = 24 + ((k * 37) % 70) + '%'
            b.style.background = k % 2 ? pal[1] : pal[0]
          }
          const tx2 = el('div', 'txt', body)
          for (k = 0; k < 3; k++) {
            const l3 = el('u', '', tx2)
            l3.style.background = '#cbcbd2'
            l3.style.width = 80 - k * 18 + '%'
          }
        } else if (variant === 3) {
          pane.style.display = 'none'
          const ti = el('div', 'tiles', body)
          for (k = 0; k < 12; k++) {
            const t4 = el('u', '', ti)
            t4.style.background = 'linear-gradient(' + k * 30 + 'deg,' + pal[0] + ',' + pal[1] + ')'
          }
        } else if (variant === 4) {
          pane.style.display = 'none'
          for (k = 0; k < 3; k++) {
            const tr = el('div', '', body)
            tr.style.cssText =
              'position:absolute;left:6%;right:6%;top:' +
              (11 + k * 29) +
              '%;height:21%;border-radius:4px;background:' +
              (k === 0 ? pal[1] : k === 1 ? pal[0] : 'var(--primary)') +
              ';opacity:.92'
          }
        } else {
          const sh = el('div', '', body)
          sh.style.cssText =
            'position:absolute;left:20%;top:16%;width:60%;height:76%;border-radius:42% 42% 28% 28%;background:var(--ink);filter:blur(7px)'
        }
        wins.push({ n: w, rot: (R() * 2 - 1) * 2.6, ph: R() * 6.283, w: bw, h: bh, d: R() })
      }
      return {
        node: s,
        update: function (t: number) {
          const phase = t < 0.5 ? 0 : t < 1.06 ? 1 : 2
          const pp = phase === 0 ? seg(t, 0, 0.5) : phase === 1 ? seg(t, 0.5, 1.06) : seg(t, 1.06, 1.92)
          const zoom = lerp(0.9, 1.16, pp) * (1 + phase * 0.08)
          for (let i = 0; i < wins.length; i++) {
            const o = wins[i]
            const k = (i + phase * 11) % wins.length
            const gx = ((k * 137) % 13) / 12
            const gy = ((k * 71) % 9) / 8
            const depth = 0.62 + (((k * 53) % 100) / 100) * 0.6
            const x = lerp(-120, 1400, gx) + Math.sin(t * 0.7 + o.ph) * 18
            const y = lerp(-80, 800, gy) + Math.cos(t * 0.55 + o.ph) * 15
            const sc = depth * zoom
            const cx = (x - W / 2) * lerp(1, 1.16, pp) + W / 2
            const cy = (y - H / 2) * lerp(1, 1.16, pp) + H / 2
            o.n.style.left = (cx - o.w / 2).toFixed(1) + 'px'
            o.n.style.top = (cy - o.h / 2).toFixed(1) + 'px'
            setT(o.n, 'scale(' + sc.toFixed(3) + ') rotate(' + o.rot.toFixed(2) + 'deg)')
            setO(
              o.n,
              Math.min(1, smooth(seg(t, 0, 0.24)) * 1.2) * (1 - seg(t, 1.8, 1.92)) * clamp(0.5 + depth * 0.5, 0.4, 1)
            )
          }
        },
      }
    }

    // 3 · One subscription / Endless creativity (Pure English)
    function makeLines() {
      const s = el('div', 'scene')
      function build(str: string, target: number) {
        const wrap = el('div', 'line', s)
        const tx = el('div', 'tx', wrap)
        tx.style.color = 'var(--ink)'
        tx.style.fontSize = fitPx(str, target, 700).toFixed(2) + 'px'
        const out: HTMLElement[] = []
        str.split(' ').forEach((word, i) => {
          const sp = document.createElement('span')
          sp.textContent = (i ? '\u00a0' : '') + word
          sp.style.color = 'var(--ink)'
          tx.appendChild(sp)
          out.push(sp)
        })
        return { tx, words: out }
      }
      const A = build('One subscription.', 705)
      const B = build('Endless creativity.', 702)
      function play(o: any, p: number, a0: number, out0: number) {
        const vis = 1 - smooth(seg(p, out0, out0 + 0.07))
        setO(o.tx, vis)
        for (let i = 0; i < o.words.length; i++) {
          const q = eOut(clamp(seg(p, a0 + i * 0.135, a0 + 0.2 + i * 0.135), 0, 1))
          setO(o.words[i], q * vis)
          setT(o.words[i], 'translateY(' + ((1 - q) * 24).toFixed(1) + 'px)')
          setF(o.words[i], q < 0.97 ? 'blur(' + ((1 - q) * 6).toFixed(2) + 'px)' : 'none')
        }
      }
      return {
        node: s,
        update: function (t: number, p: number) {
          play(A, p, 0.02, 0.44)
          play(B, p, 0.5, 0.94)
        },
      }
    }

    // 4 · Dock
    const ICONS = [
      '<svg viewBox="0 0 32 32"><rect x="7" y="16" width="4.4" height="10" rx="1" fill="#7fd44a"/><rect x="13.8" y="9" width="4.4" height="17" rx="1" fill="#a6e86a"/><rect x="20.6" y="13" width="4.4" height="13" rx="1" fill="#5fbe32"/><rect x="6" y="27" width="20" height="1.8" fill="#c9f2a0"/></svg>',
      '<svg viewBox="0 0 32 32"><path d="M6 20h20l-4-9H10z" fill="var(--primary)"/><rect x="15" y="20" width="2" height="7" fill="#8fd0f7"/><rect x="10" y="26" width="12" height="2" rx="1" fill="var(--primary)"/></svg>',
      '<svg viewBox="0 0 32 32"><path d="M8 25c0-10 3-14 6-14s3 7 5 7 3-4 5-4" stroke="var(--primary)" stroke-width="3.2" fill="none" stroke-linecap="round"/><circle cx="23.4" cy="14.6" r="2.6" fill="#8fd0f7"/></svg>',
      '<svg viewBox="0 0 32 32"><rect x="5" y="12" width="22" height="13" rx="3" fill="var(--primary)"/><path d="M5 12l6-4 16 2-4 3z" fill="#a8c5ff"/></svg>',
      '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12.5" fill="var(--primary)"/><circle cx="16" cy="16" r="7" fill="var(--surface)"/><circle cx="16" cy="16" r="2" fill="#02226b"/></svg>',
      '<svg viewBox="0 0 32 32"><path d="M16 8l9.5 5-9.5 5-9.5-5z" fill="var(--primary)"/><path d="M16 18l9.5 5-9.5 5-9.5-5z" fill="var(--primary)" opacity=".9"/></svg>',
      '<svg viewBox="0 0 32 32"><path d="M8 25l16-17 2.4 3.4-14.4 15z" fill="#3b82f6"/><path d="M8 25.6h18.4" stroke="#93c5fd" stroke-width="2.2"/></svg>',
      '<svg viewBox="0 0 32 32"><path d="M16 6v20" stroke="#4fd6b8" stroke-width="2"/><circle cx="16" cy="9.5" r="3.2" fill="#4fd6b8"/><circle cx="21.5" cy="18" r="3.2" fill="#4fd6b8"/><circle cx="10.5" cy="22.5" r="3.2" fill="#4fd6b8"/></svg>',
      '<svg viewBox="0 0 32 32"><path d="M8 9h16l-8 7 8 7H8l8-7z" fill="none" stroke="#f0d05a" stroke-width="2.6"/></svg>',
      '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11.5" fill="var(--primary)"/><path d="M7.5 17c2-4.4 3 4.4 5 0s3 4.4 5 0 3 3.4 5-1" stroke="#c8eafa" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>',
    ]
    function makeDock() {
      const s = el('div', 'scene')
      const bar = el('div', '', s)
      bar.id = 'dockBar'
      const icos: HTMLElement[] = []
      for (let i = 0; i < ICONS.length; i++) {
        const n = el('div', 'ico', s, ICONS[i])
        n.style.left = 148 + i * 101 + 'px'
        n.style.top = '326px'
        icos.push(n)
      }
      return {
        node: s,
        update: function (t: number, p: number) {
          const q0 = eOut(seg(p, 0, 0.24))
          setO(bar, q0)
          setT(bar, 'scaleX(' + lerp(0.7, 1, q0).toFixed(3) + ')')
          for (let i = 0; i < icos.length; i++) {
            const q = clamp(seg(p, 0.08 + i * 0.03, 0.36 + i * 0.03), 0, 1)
            const lift = i === 4 ? eOut(seg(p, 0.5, 0.76)) : 0
            setO(icos[i], Math.min(1, q * 1.7))
            setT(
              icos[i],
              'translateY(' +
                ((1 - back(q)) * 30 - lift * 52).toFixed(1) +
                'px) scale(' +
                (lerp(0.6, 1, back(q)) * (1 + lift * 0.58)).toFixed(3) +
                ')'
            )
            icos[i].style.boxShadow =
              lift > 0.02
                ? '0 0 ' + (46 * lift).toFixed(0) + 'px rgba(2,74,216,' + (0.95 * lift).toFixed(2) + '),inset 0 1px 0 var(--surface)'
                : 'inset 0 1px 0 var(--surface)'
            icos[i].style.zIndex = i === 4 ? '5' : '1'
          }
        },
      }
    }

    // 5 · Make a beat. (Pure English)
    function makeBeatText() {
      const s = el('div', 'scene')
      const L = textLine(s, 'Make a beat.', 469)
      const R = rng(551)
      const jit = L.chars.map(() => [R() * 2 - 1, R() * 2 - 1])
      return {
        node: s,
        update: function (t: number, p: number) {
          setO(L.tx, smooth(seg(p, 0.02, 0.14)) * (1 - smooth(seg(p, 0.88, 1))))
          for (let i = 0; i < L.chars.length; i++) {
            const q = eOut(clamp(seg(p, 0.04 + i * 0.028, 0.34 + i * 0.028), 0, 1))
            setT(
              L.chars[i],
              'translate(' +
                (jit[i][0] * 34 * (1 - q)).toFixed(1) +
                'px,' +
                (jit[i][1] * 18 * (1 - q) + Math.sin(t * 5.4 + i) * (1 - q) * 5).toFixed(1) +
                'px)'
            )
            setO(L.chars[i], Math.min(1, q * 1.5))
          }
        },
      }
    }

    // 6 · Three-track beat
    function makeTracks() {
      const s = el('div', 'scene')
      const R = rng(9051)
      const specs = [
        { name: 'DRUMS_137BPM', top: 112, h: 138, g: 'linear-gradient(180deg,#84e44e,#5cc832)', glow: '#7fe04a', kind: 'roll' },
        { name: 'BASS_137BPM', top: 259, h: 132, g: 'linear-gradient(180deg,var(--primary),var(--primary))', glow: 'var(--primary)', kind: 'ticks' },
        { name: 'HARMONY_137BPM', top: 400, h: 140, g: 'linear-gradient(180deg,#3b82f6,#1d4ed8)', glow: '#3b82f6', kind: 'wave' },
      ]
      const tr = specs.map((sp) => {
        const n = el('div', 'track', s)
        n.style.top = sp.top + 'px'
        n.style.height = sp.h + 'px'
        n.style.background = sp.g
        n.style.boxShadow = '0 0 30px ' + sp.glow + '70,0 0 5px ' + sp.glow + 'bb'
        el('b', '', n).textContent = sp.name
        const art = el('div', 'art', n)
        let i: number, j: number
        if (sp.kind === 'roll') {
          for (i = 0; i < 52; i++) {
            const u = el('u', '', art)
            u.style.left = 8 + i * 11.4 + 'px'
            u.style.width = '6px'
            u.style.height = (R() < 0.3 ? 15 : 9) + 'px'
            u.style.top = 34 + R() * 58 + 'px'
          }
        } else if (sp.kind === 'ticks') {
          for (i = 0; i < 28; i++) {
            const y = 24 + R() * 54
            const g = el('u', '', art)
            g.style.left = 16 + i * 20.4 + 'px'
            g.style.width = '15px'
            g.style.height = '2px'
            g.style.top = y + 'px'
            const v = el('u', '', art)
            v.style.left = 16 + i * 20.4 + 'px'
            v.style.width = '2px'
            v.style.height = '11px'
            v.style.top = y - 4 + 'px'
          }
        } else {
          for (i = 0; i < 2; i++) {
            for (j = 0; j < 126; j++) {
              const amp = (Math.sin(j * 0.2) * 0.4 + Math.sin(j * 0.06) * 0.4 + 0.62) * 16
              const wv = el('u', '', art)
              wv.style.left = 7 + j * 4.7 + 'px'
              wv.style.width = '2px'
              wv.style.height = Math.max(2, amp * (0.5 + R() * 0.7)).toFixed(1) + 'px'
              wv.style.top = 16 + i * 40 + (20 - amp / 2) + 'px'
              wv.style.background = 'var(--surface)'
            }
          }
        }
        return n
      })
      const head = el('div', '', s)
      head.style.cssText = 'position:absolute;top:75px;width:6px;height:30px;background:#111;border-radius:1px'
      return {
        node: s,
        update: function (t: number, p: number) {
          for (let i = 0; i < tr.length; i++) {
            const q = eOut(clamp(seg(p, 0.06 + i * 0.2, 0.32 + i * 0.2), 0, 1))
            setO(tr[i], q)
            setT(tr[i], 'translateY(' + ((1 - q) * 30).toFixed(1) + 'px) scaleY(' + lerp(0.68, 1, q).toFixed(3) + ')')
          }
          setO(head, smooth(seg(p, 0.02, 0.12)))
          head.style.left = (516 + Math.sin(t * 2.4) * 7).toFixed(1) + 'px'
        },
      }
    }

    // 7 · Edit a video. (Pure English)
    function makeEditVideo() {
      const s = el('div', 'scene')
      const fs = fitPx('Edit a', 237)
      const pre = el('div', 'line', s)
      const p1 = el('div', 'tx', pre)
      const p2 = el('div', 'tx', pre)
      p1.style.fontSize = p2.style.fontSize = fs.toFixed(2) + 'px'
      p1.textContent = 'Edit a'
      p2.textContent = 'video.'
      p1.style.color = 'var(--primary)'
      p1.style.textShadow = '0 0 30px rgba(2,74,216,.4)'
      p2.style.color = 'var(--ink)'
      const main = el('div', 'line', s)
      const mt = el('div', 'tx', main)
      mt.style.color = 'var(--ink)'
      mt.style.fontSize = fs.toFixed(2) + 'px'
      const a = el('span', '', mt)
      a.textContent = 'Edit\u00a0a\u00a0'
      const gap = el('span', '', mt)
      gap.style.display = 'inline-block'
      const b = el('span', '', mt)
      b.textContent = '\u00a0video.'
      const clip = el('div', '', s)
      clip.id = 'clip'
      clip.style.borderColor = 'var(--primary)'
      clip.style.boxShadow = '0 0 34px rgba(2,74,216,.5)'
      const th = el('div', 'thumbs', clip)
      for (let i = 0; i < 3; i++) el('u', '', th)
      const wv = el('div', 'wave', clip)
      for (let i = 0; i < 64; i++) {
        const u = el('u', '', wv)
        u.style.height = 22 + Math.abs(Math.sin(i * 0.7)) * 58 + ((i * 37) % 20) + '%'
      }
      return {
        node: s,
        update: function (t: number, p: number) {
          const swap = seg(p, 0.58, 0.7)
          const pv = 1 - smooth(swap)
          setO(pre, pv)
          const q1 = eOut(seg(p, 0.02, 0.24))
          const q2 = eOut(seg(p, 0.14, 0.42))
          setT(p1, TXY + 'translate(' + lerp(-40, -118, q1).toFixed(0) + 'px,' + lerp(-30, -46, q1).toFixed(0) + 'px)')
          setO(p1, q1)
          setT(p2, TXY + 'translate(' + lerp(160, 118, q2).toFixed(0) + 'px,' + lerp(58, 42, q2).toFixed(0) + 'px)')
          setO(p2, q2)
          const mv = smooth(swap)
          setO(main, mv)
          const open = eOut(seg(p, 0.66, 0.84))
          const gw = lerp(0, 575, open)
          gap.style.width = gw.toFixed(0) + 'px'
          clip.style.width = Math.max(2, gw - 6).toFixed(0) + 'px'
          clip.style.height = '200px'
          clip.style.left = (W / 2 - gw / 2 + 3).toFixed(0) + 'px'
          clip.style.top = '262px'
          setO(clip, mv * Math.min(1, open * 2.4) * (1 - seg(p, 0.93, 1)))
          setT(clip, 'scaleY(' + lerp(0.5, 1, eOut(seg(p, 0.64, 0.82))).toFixed(3) + ')')
        },
      }
    }

    // 8 · MacBook (Pure English)
    function macFrame(parent: HTMLElement) {
      const m = el('div', 'mac', parent)
      const lid = el('div', 'lid', m)
      const scr = el('div', 'scr', lid)
      el('div', 'notch', lid)
      const inn = el('div', 'scrIn', scr)
      el('div', 'base', m)
      return { root: m, screen: inn }
    }
    function makeMac() {
      const s = el('div', 'scene')
      const mac = macFrame(s)
      const clip = el('div', '', mac.screen)
      clip.style.cssText = 'position:absolute;inset:0;background:linear-gradient(150deg,#1e293b,var(--primary))'
      const pal = el('div', 'palette', mac.screen)
      for (let i = 0; i < 11; i++) el('u', '', pal)
      const guide = el('div', 'guide', mac.screen)
      guide.style.background = 'var(--primary)'
      const b1 = el('div', 'tbox', mac.screen, '<i></i><i></i><i></i><i></i><span>Take</span>')
      const b2 = el('div', 'tbox', mac.screen, '<i></i><i></i><i></i><i></i><span>your</span>')
      ;(b1.querySelector('span') as HTMLElement).style.fontSize = '132px'
      ;(b2.querySelector('span') as HTMLElement).style.fontSize = '86px'
      return {
        node: s,
        update: function (t: number, p: number) {
          setO(mac.root, smooth(seg(p, 0, 0.09)))
          setT(mac.root, 'scale(' + lerp(0.95, 1, eOut(seg(p, 0, 0.3))).toFixed(3) + ')')
          setO(clip, 1 - seg(p, 0.18, 0.32))
          setO(pal, smooth(seg(p, 0.22, 0.4)))
          guide.style.top = '64%'
          setO(guide, smooth(seg(p, 0.34, 0.48)) * (1 - seg(p, 0.92, 1)))
          const i1 = seg(p, 0.28, 0.44)
          b1.style.left = '16%'
          b1.style.top = '30%'
          b1.style.width = '52%'
          b1.style.height = '34%'
          setO(b1, smooth(i1))
          setT(b1, 'scale(' + lerp(0.9, 1, eOut(i1)).toFixed(3) + ')')
          const i2 = seg(p, 0.64, 0.8)
          b2.style.left = '54%'
          b2.style.top = '36%'
          b2.style.width = '30%'
          b2.style.height = '24%'
          setO(b2, smooth(i2))
          setT(b2, 'translateX(' + ((1 - eOut(i2)) * 26).toFixed(1) + 'px)')
        },
      }
    }

    // 9 · Take your design anywhere. (Pure English)
    const GRADS = [
      { bg: '#07090e', blobs: ['var(--primary)', 'var(--primary)', '#3b82f6'] },
      { bg: '#020b20', blobs: ['var(--primary)', 'var(--primary)', '#60a5fa'] },
      { bg: '#05070a', blobs: ['var(--primary)', '#1d4ed8', '#93c5fd'] },
    ]
    function gradientCanvas(parent: HTMLElement) {
      const g = el('div', 'grad', parent)
      const blobs: HTMLElement[] = []
      for (let i = 0; i < 3; i++) blobs.push(el('b', '', g))
      return {
        set: function (idx: number, t: number) {
          const sp = GRADS[idx]
          g.style.background = sp.bg
          for (let i = 0; i < blobs.length; i++) {
            const b = blobs[i]
            const sz = lerp(152, 112, i / 2)
            b.style.width = sz + '%'
            b.style.height = sz * 1.35 + '%'
            b.style.left = lerp(-26, 6, i / 2) + '%'
            b.style.top = lerp(-8, 26, i / 2) + Math.sin(t * 0.7 + i) * 2 + '%'
            b.style.background = 'radial-gradient(circle at 42% 36%,' + sp.blobs[i] + ',var(--ink) 70%)'
            b.style.opacity = (0.96 - i * 0.08).toFixed(2)
          }
        },
      }
    }
    function makeCanvasScene() {
      const s = el('div', 'scene')
      const mac = macFrame(s)
      const pad = el('div', 'pad', s)
      const padIn = el('div', 'scrIn', el('div', 'scr', pad))
      const gMac = gradientCanvas(mac.screen)
      const gPad = gradientCanvas(padIn)
      function typeBlock(parent: HTMLElement, unit: number) {
        const w = el('div', 'canvasType', parent)
        const rows = [
          { txt: 'Take', x: '5%', y: '3%', s: 1.0 },
          { txt: 'your', x: '43%', y: '25%', s: 1.0 },
          { txt: 'design', x: '4%', y: '47%', s: 1.0 },
          { txt: 'anywhere.', x: '2%', y: '69%', s: 1.0 },
        ]
        return {
          root: w,
          rows: rows.map((r) => {
            const d = el('div', '', w)
            d.textContent = r.txt
            d.style.left = r.x
            d.style.top = r.y
            d.style.fontSize = unit * r.s + 'px'
            d.style.color = 'var(--surface)'
            return d
          }),
        }
      }
      const tMac = typeBlock(mac.screen, 114)
      const tPad = typeBlock(padIn, 110)
      return {
        node: s,
        update: function (t: number, p: number) {
          const onPad = p > 0.42
          mac.root.style.display = onPad ? 'none' : 'block'
          pad.style.display = onPad ? 'block' : 'none'
          const idx = p < 0.18 ? 0 : p < 0.38 ? 1 : 2
          const g = onPad ? gPad : gMac
          const tb = onPad ? tPad : tMac
          g.set(idx, t)
          const host = onPad ? pad : mac.root
          setO(host, smooth(seg(p, 0, 0.08)))
          const grow = eOut(seg(p, 0.42, 1))
          setT(
            host,
            onPad
              ? 'scale(' +
                  lerp(1, 1.44, grow).toFixed(3) +
                  ') translate(' +
                  lerp(0, -16, grow).toFixed(0) +
                  'px,' +
                  lerp(0, 26, grow).toFixed(0) +
                  'px)'
              : 'scale(' + lerp(0.96, 1, eOut(seg(p, 0, 0.3))).toFixed(3) + ')'
          )
          setF(host, onPad && grow > 0.5 ? 'blur(' + ((grow - 0.5) * 5.2).toFixed(2) + 'px)' : 'none')
          for (let i = 0; i < tb.rows.length; i++) {
            const q = eOut(clamp(seg(p, 0.01 + i * 0.045, 0.11 + i * 0.045), 0, 1))
            setO(tb.rows[i], q)
            setT(tb.rows[i], 'translateY(' + ((1 - q) * 20).toFixed(1) + 'px)')
          }
        },
      }
    }

    // 10 · Prompt it.
    function makePrompt() {
      const s = el('div', 'scene')
      const L = textLine(s, 'Prompt it.', 600)
      return {
        node: s,
        update: function (t: number, p: number) {
          const cq = smooth(seg(p, 0.01, 0.07)) * (1 - smooth(seg(p, 0.88, 1)))
          setO(L.tx, cq)
          setT(L.tx, TXY + 'scale(' + lerp(1.04, 1, eOut(seg(p, 0.02, 0.24))).toFixed(3) + ')')
        },
      }
    }

    // 11 · Perform it.
    function makePerform() {
      const s = el('div', 'scene')
      const L = textLine(s, 'Perform it.', 575)
      return {
        node: s,
        update: function (t: number, p: number) {
          const env = smooth(seg(p, 0.02, 0.16)) * (1 - smooth(seg(p, 0.84, 1)))
          setO(L.tx, env)
          for (let i = 0; i < L.chars.length; i++) {
            setO(L.chars[i], 1)
            setT(L.chars[i], 'translateY(' + (Math.sin(t * 9 + i * 0.7) * 1.4).toFixed(2) + 'px)')
          }
        },
      }
    }

    // 12 · Loop it.
    function makeLoop() {
      const s = el('div', 'scene')
      const L = textLine(s, 'Loop it.', 375)
      return {
        node: s,
        update: function (t: number, p: number) {
          setO(L.tx, smooth(seg(p, 0.02, 0.14)) * (1 - smooth(seg(p, 0.9, 1))))
          for (let i = 0; i < L.chars.length; i++) {
            const q = eOut(clamp(seg(p, 0.03 + i * 0.03, 0.3 + i * 0.03), 0, 1))
            const spin = i === 1 || i === 2 ? Math.sin(t * 4.6 + i * 0.7) * 140 * (1 - seg(p, 0.1, 0.34)) : 0
            setT(L.chars[i], 'translateY(' + ((1 - q) * 20).toFixed(1) + 'px) rotateY(' + spin.toFixed(0) + 'deg)')
            setO(L.chars[i], q)
          }
        },
      }
    }

    // 13 · Select it.
    function makeSelect() {
      const s = el('div', 'scene')
      const L = textLine(s, 'Select it.', 499)
      return {
        node: s,
        update: function (t: number, p: number) {
          const env = smooth(seg(p, 0.02, 0.14)) * (1 - smooth(seg(p, 0.88, 1)))
          setO(L.tx, env)
          for (let i = 0; i < L.chars.length; i++) {
            setO(L.chars[i], 1)
          }
        },
      }
    }

    // 14 · Write it.
    function makeWrite() {
      const s = el('div', 'scene')
      const L = textLine(s, 'Write it.', 520)
      return {
        node: s,
        update: function (t: number, p: number) {
          const env = 1 - smooth(seg(p, 0.86, 1))
          setO(L.tx, env)
          for (let i = 0; i < L.chars.length; i++) {
            const q = clamp(seg(p, 0.06 + i * 0.055, 0.2 + i * 0.055), 0, 1)
            setO(L.chars[i], q * env)
          }
        },
      }
    }

    // 15 · Scrap it.
    function makeScrap() {
      const s = el('div', 'scene')
      const L = textLine(s, 'Scrap it.', 469)
      return {
        node: s,
        update: function (t: number, p: number) {
          const env = smooth(seg(p, 0.01, 0.06)) * (1 - smooth(seg(p, 0.9, 1)))
          setO(L.tx, env)
        },
      }
    }

    // 16 · Move it.
    function makeMove() {
      const s = el('div', 'scene')
      const L = textLine(s, 'Move it.', 462)
      return {
        node: s,
        update: function (t: number, p: number) {
          setO(L.tx, smooth(seg(p, 0.02, 0.14)) * (1 - smooth(seg(p, 0.9, 1))))
          for (let i = 0; i < L.chars.length; i++) {
            const q = eOut(clamp(seg(p, 0.06 + i * 0.06, 0.5 + i * 0.06), 0, 1))
            const dir = i % 2 ? 1 : -1
            setT(L.chars[i], 'translate(' + (dir * 86 * (1 - q)).toFixed(1) + 'px,' + (dir * -14 * (1 - q)).toFixed(1) + 'px)')
            setO(L.chars[i], Math.min(1, q * 1.6))
          }
        },
      }
    }

    // 17 · Upscale it.
    function makeUpscale() {
      const s = el('div', 'scene')
      const L = textLine(s, 'Upscale it.', 598)
      return {
        node: s,
        update: function (t: number, p: number) {
          const env = smooth(seg(p, 0.02, 0.14)) * (1 - smooth(seg(p, 0.86, 1)))
          setO(L.tx, env)
        },
      }
    }

    // 18 · Share it.
    function makeShare() {
      const s = el('div', 'scene')
      const L = textLine(s, 'Share it.', 421)
      return {
        node: s,
        update: function (t: number, p: number) {
          setO(L.tx, smooth(seg(p, 0.02, 0.14)) * (1 - smooth(seg(p, 0.9, 1))))
        },
      }
    }

    // 19 · Enterprise
    function makePrice() {
      const s = el('div', 'scene')
      const str = 'OMNILINK Enterprise'
      const wrap = el('div', 'line', s)
      const tx = el('div', 'tx', wrap)
      tx.style.color = 'var(--ink)'
      tx.style.fontSize = fitPx(str, 811, 700).toFixed(2) + 'px'
      const chars = letters(tx, str)
      return {
        node: s,
        update: function (t: number, p: number) {
          setO(tx, smooth(seg(p, 0.02, 0.14)) * (1 - smooth(seg(p, 0.9, 1))))
          for (let i = 0; i < chars.length; i++) {
            const q = clamp(seg(p, 0.04 + i * 0.028, 0.24 + i * 0.028), 0, 1)
            setO(chars[i], q)
          }
        },
      }
    }

    // 20 · App list (Pure English)
    function makeApps() {
      const s = el('div', 'scene')
      const APPS = [
        ['Storefront Generator', 'var(--primary)', 'linear-gradient(160deg,var(--primary),var(--primary))'],
        ['Visual Synthesizer', '#2563eb', 'linear-gradient(160deg,#2563eb,#1d4ed8)'],
        ['Design Studio', 'var(--primary)', 'linear-gradient(160deg,var(--primary),#080d1a)'],
        ['Catalog Matrix', '#3b82f6', 'linear-gradient(160deg,#3b82f6,#1d4ed8)'],
        ['Commerce Copilot', '#60a5fa', 'linear-gradient(160deg,#60a5fa,#2563eb)'],
      ]
      const rows = APPS.map((a) => {
        const d = el('div', 'appRow', s)
        d.innerHTML = '<em style="background:' + a[2] + '"></em>' + a[0]
        d.style.color = a[1]
        d.style.fontSize = '68px'
        d.style.fontWeight = '700'
        return d
      })
      return {
        node: s,
        update: function (t: number, p: number) {
          const pos = 0.2 + 4 * Math.pow(p, 2.2)
          const fade = 1 - smooth(seg(p, 0.96, 1))
          for (let i = 0; i < rows.length; i++) {
            const d = i - pos
            const near = clamp(1 - Math.abs(d), 0, 1)
            const sc = lerp(0.86, 1.35, Math.pow(near, 1.5))
            rows[i].style.top = '0px'
            rows[i].style.transform = 'translateY(' + (360 + d * 132 - 48).toFixed(1) + 'px) scale(' + sc.toFixed(3) + ')'
            setO(rows[i], clamp(1.3 - Math.abs(d) * 0.92, 0, 1) * fade)
            setF(rows[i], near < 0.6 ? 'brightness(.7)' : 'none')
          }
        },
      }
    }

    const SCENES = [
      { a: 0.0, b: 1.72, s: makeWordmark() },
      { a: 1.72, b: 3.42, s: makeWall() },
      { a: 3.42, b: 5.62, s: makeLines() },
      { a: 5.62, b: 6.92, s: makeDock() },
      { a: 6.92, b: 7.72, s: makeBeatText() },
      { a: 7.72, b: 9.52, s: makeTracks() },
      { a: 9.52, b: 11.42, s: makeEditVideo() },
      { a: 11.42, b: 13.32, s: makeMac() },
      { a: 13.32, b: 16.1, s: makeCanvasScene() },
      { a: 16.1, b: 18.02, s: makePrompt() },
      { a: 18.02, b: 18.56, s: makePerform() },
      { a: 18.56, b: 19.42, s: makeLoop() },
      { a: 19.42, b: 20.26, s: makeSelect() },
      { a: 20.26, b: 21.34, s: makeWrite() },
      { a: 21.34, b: 23.1, s: makeScrap() },
      { a: 23.1, b: 24.2, s: makeMove() },
      { a: 24.2, b: 24.86, s: makeUpscale() },
      { a: 24.86, b: 25.82, s: makeShare() },
      { a: 25.82, b: 27.32, s: makePrice() },
      { a: 27.32, b: 28.52, s: makeApps() },
      { a: 28.52, b: DUR, s: makeWordmark() },
    ]

    let active: any = null
    function render(t: number) {
      if (!stage || !comp) return
      const k = Math.min((stage.clientWidth || W) / W, (stage.clientHeight || H) / H)
      comp.style.transform = 'scale(' + k.toFixed(4) + ')'
      for (let i = 0; i < SCENES.length; i++) {
        const sc = SCENES[i]
        if (t >= sc.a && t < sc.b) {
          if (active !== sc) {
            if (active) active.s.node.classList.remove('on')
            sc.s.node.classList.add('on')
            active = sc
          }
          sc.s.update(t - sc.a, seg(t, sc.a, sc.b))
          return
        }
      }
    }

    let start: number | null = null
    let raf = 0
    let at = 0

    function tick(now: number) {
      raf = requestAnimationFrame(tick)
      if (start === null) start = now
      at = ((now - start) / 1000) % DUR
      render(at)
    }

    raf = requestAnimationFrame(tick)

    let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      // When user scrolls back up to the top hero section, replay animation
      if (currentScrollY < 80 && lastScrollY >= 80) {
        start = performance.now()
      }
      lastScrollY = currentScrollY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    const onResize = () => render(at)
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [DUR])

  // Scroll to onboarding section
  const handleGetStarted = () => {
    if (onboardingRef.current) {
      onboardingRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div suppressHydrationWarning className="relative min-h-screen w-full bg-[var(--surface)] text-[var(--ink)] overflow-x-hidden font-sans selection:bg-[var(--primary)] selection:text-[var(--surface)]">
      {/* 顶部白色系极简导航栏 (无边框卡片，玻璃拟态) */}
      <header suppressHydrationWarning className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between pointer-events-auto bg-[var(--surface)]/80 backdrop-blur-xl shadow-[0_1px_3px_var(--ink)]">
        <div suppressHydrationWarning className="flex items-center gap-3">
          <div
            suppressHydrationWarning
            translate="no"
            className="w-7 h-7  bg-[var(--primary)] flex items-center justify-center text-[var(--surface)] shadow-sm select-none notranslate"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8" />
            </svg>
          </div>
          <span
            suppressHydrationWarning
            translate="no"
            className="font-extrabold text-base tracking-tight text-[var(--ink)] font-mono notranslate select-none"
          >
            OMNILINK
          </span>
        </div>

        {/* 导航按钮：专门设计的「登录」与「Get Started」按钮 */}
        <div suppressHydrationWarning className="flex items-center gap-3">
          {/* 登录按钮：HP Enterprise 次要按钮规范 (白色底 + 灰边框 + 黑色文字 + 4px 圆角) */}
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => setShowLoginModal(true)}
            className="px-4 py-1.5  bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-muted)] hover:border-[var(--border)] text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-2xs focus:outline-2 focus:outline-[var(--primary)] focus:outline-offset-2"
          >
            登录
          </button>

          {/* 开启体验按钮：HP Enterprise 主要按钮规范 (HP 蓝色 var(--primary) + 4px 圆角) */}
          <button
            type="button"
            suppressHydrationWarning
            onClick={handleGetStarted}
            className="btn-hp-primary px-4 py-1.5  bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] text-[var(--surface)] text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-sm flex items-center gap-1.5 focus:outline-2 focus:outline-[var(--primary)] focus:outline-offset-2"
          >
            <span>开启体验</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      {/* 第一屏：Keynote 纯英文动效画布 (White Stage) */}
      <section id="hero-keynote" className="relative w-full h-screen flex flex-col items-center justify-center pt-16 bg-[var(--surface)] overflow-hidden">
        <div id="stage" ref={stageRef} className="relative w-full max-w-[177.78vh] aspect-video bg-[var(--surface)] overflow-hidden">
          <div id="comp" ref={compRef} className="absolute left-1/2 top-1/2 w-[1280px] h-[720px] -ml-[640px] -mt-[360px]" />
          <svg width="0" height="0" className="absolute" aria-hidden="true">
            <filter id="goo">
              <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b" />
              <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="g" />
              <feComposite in="SourceGraphic" in2="g" operator="atop" />
            </filter>
          </svg>
        </div>
        <span id="ruler" ref={rulerRef} className="absolute -left-[9999px] top-0 invisible whitespace-pre font-bold text-[100px]" aria-hidden="true" />

        {/* 底部纯符号引导 (无任何解释文字) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center cursor-pointer p-2" onClick={handleGetStarted}>
          <ChevronDown size={18} className="text-[var(--primary)] animate-bounce" />
        </div>
      </section>

      {/* 第二屏：点击 Get Started 滚动展开的 Onboarding 页面内容 (无卡片边框) */}
      <section ref={onboardingRef} id="onboarding-section" className="relative w-full min-h-screen bg-[var(--surface)]">
        <LightLiquidGlassCanvas />
        <div className="relative z-10 w-full">
          <BrandStudioWizard />
        </div>
      </section>

      {/* 登录弹窗 (带蓝色同色系呼吸光带) */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--ink)]/30 backdrop-blur-sm animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLoginModal(false)
            }
          }}
        >
          <div className="w-full max-w-md relative z-10" onClick={(e) => e.stopPropagation()}>
            <UnifiedAuthForm isModal onClose={() => setShowLoginModal(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
