'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

const LOOP_SECONDS = 8

export function FlowerStudiesLanding() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const params = new URLSearchParams(window.location.search)
    const initialTime = Number(params.get('t') || 0)
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = new THREE.Timer()
    timer.connect(document)
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x122c22, 0.085)
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
    camera.position.set(0, 0.1, 6.5)

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.18

    const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
    })
    renderTarget.texture.colorSpace = THREE.SRGBColorSpace
    const composer = new EffectComposer(renderer, renderTarget)
    const renderPass = new RenderPass(scene, camera)
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.16, 0.55, 0.58)
    composer.addPass(renderPass)
    composer.addPass(bloom)

    const seeded = (seed: number) => {
      let value = seed >>> 0
      return () => {
        value += 0x6d2b79f5
        let t = value
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }

    const random = seeded(24101990)
    const pointsPerPetal = Math.min(1200, Math.max(720, Math.floor((window.innerWidth * window.innerHeight) / 700)))
    const layers = [
      { count: 5, start: 0.04, length: 0.72, width: 0.42, cup: 0.35, curl: 0.18, tilt: 0.5, depth: 0.22 },
      { count: 7, start: 0.2, length: 1.08, width: 0.6, cup: 0.4, curl: 0.3, tilt: 0.35, depth: 0.04 },
      { count: 8, start: 0.34, length: 1.5, width: 0.76, cup: 0.3, curl: 0.5, tilt: 0.22, depth: -0.14 },
    ]
    const totalPetals = layers.reduce((sum, layer) => sum + layer.count, 0)
    const totalPoints = totalPetals * pointsPerPetal
    const positions = new Float32Array(totalPoints * 3)
    const randoms = new Float32Array(totalPoints)
    const petalIds = new Float32Array(totalPoints)
    const edges = new Float32Array(totalPoints)
    const sizes = new Float32Array(totalPoints)
    const golds = new Float32Array(totalPoints)

    let cursor = 0
    let petalIndex = 0
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
      const layer = layers[layerIndex]
      const layerPhase = random() * Math.PI * 2
      for (let petal = 0; petal < layer.count; petal += 1) {
        const irregularity = (random() - 0.5) * 0.17
        const angle = layerPhase + (petal / layer.count) * Math.PI * 2 + irregularity
        const length = layer.length * (0.91 + random() * 0.16)
        const widthScale = layer.width * (0.9 + random() * 0.2)
        const petalTilt = layer.tilt + (random() - 0.5) * 0.18
        const petalCurl = layer.curl * (0.82 + random() * 0.32)
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)

        for (let i = 0; i < pointsPerPetal; i += 1) {
          const u = Math.pow(random(), layerIndex === 0 ? 0.72 : 0.86)
          const v = random() - 0.5
          const surface = Math.pow(Math.sin(Math.PI * u), 0.62)
          const width = widthScale * (0.24 + surface * 0.76)
          const across = v * width
          const radial = layer.start + u * length
          const fold = Math.sin(u * Math.PI * 2.2 + v * 5.5 + layerPhase) * 0.035 * surface
          const curledEdge = Math.sign(across || 1) * Math.pow(Math.abs(across) / Math.max(width, 0.001), 1.6) * petalCurl * u * u
          const x = across + Math.sin(u * Math.PI + layerPhase) * 0.035 * u + curledEdge * 0.18
          const y = radial
          const z = layer.depth + layer.cup * surface + fold + curledEdge
          const tiltedY = y * Math.cos(petalTilt) - z * Math.sin(petalTilt)
          const tiltedZ = y * Math.sin(petalTilt) + z * Math.cos(petalTilt)
          const index = cursor * 3
          positions[index] = x * cos - tiltedY * sin
          positions[index + 1] = x * sin + tiltedY * cos
          positions[index + 2] = tiltedZ + (random() - 0.5) * 0.035
          randoms[cursor] = random()
          petalIds[cursor] = petalIndex / totalPetals
          edges[cursor] = Math.min(1, Math.abs(across) / Math.max(width, 0.001))
          sizes[cursor] = 0.54 + random() * 0.92
          golds[cursor] = 0.58 + layerIndex * 0.08 + random() * 0.24
          cursor += 1
        }
        petalIndex += 1
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1))
    geometry.setAttribute('aPetal', new THREE.BufferAttribute(petalIds, 1))
    geometry.setAttribute('aEdge', new THREE.BufferAttribute(edges, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aGold', new THREE.BufferAttribute(golds, 1))

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: initialTime % LOOP_SECONDS },
        uDpr: { value: Math.min(window.devicePixelRatio, 1.7) },
      },
      vertexShader: `
        attribute float aRandom;
        attribute float aPetal;
        attribute float aEdge;
        attribute float aSize;
        attribute float aGold;
        uniform float uTime;
        uniform float uDpr;
        varying float vEdge;
        varying float vGold;
        varying float vDepth;
        void main() {
          vec3 p = position;
          float phase = aPetal * 6.28318 + aRandom * 4.0;
          float breath = sin(uTime * 0.7854 + phase) * 0.07;
          float unfurl = 1.0 + sin(uTime * 0.7854 + aPetal * 6.28318) * 0.085;
          p.xy *= unfurl;
          p.z += breath + sin(uTime * 1.5708 + aRandom * 13.0) * 0.045;
          p.x += sin(uTime * 0.7854 + p.y * 1.8 + phase) * 0.03 * (1.0 - aEdge);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float perspective = 5.0 / max(1.0, -mvPosition.z);
          gl_PointSize = aSize * uDpr * (0.82 + aEdge * 0.32) * perspective * 2.45;
          vEdge = aEdge;
          vGold = aGold;
          vDepth = clamp((-mvPosition.z - 3.2) / 4.0, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        varying float vEdge;
        varying float vGold;
        varying float vDepth;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float dot = smoothstep(0.5, 0.04, d);
          float halo = smoothstep(0.5, 0.2, d) * 0.18;
          vec3 peach = vec3(0.54, 0.28, 0.08);
          vec3 gold = vec3(1.0, 0.72, 0.3);
          vec3 warm = mix(peach, gold, vGold);
          warm = mix(warm, vec3(1.0, 0.91, 0.68), vEdge * 0.3);
          gl_FragColor = vec4(warm, (dot + halo) * (0.34 + vEdge * 0.2) * (1.0 - vDepth * 0.12));
        }
      `,
    })

    const flower = new THREE.Points(geometry, material)
    flower.rotation.z = -0.12
    flower.rotation.x = 0.14
    flower.scale.setScalar(0.82)
    scene.add(flower)

    const innerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xffb74f, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    scene.add(innerGlow)

    const resize = () => {
      const width = canvas.clientWidth || window.innerWidth
      const height = canvas.clientHeight || window.innerHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 700 ? 1.35 : 1.7))
      renderer.setSize(width, height, false)
      composer.setSize(width, height)
      bloom.setSize(width, height)
    }

    resize()
    window.addEventListener('resize', resize)
    let frame = 0
    const animate = () => {
      frame = window.requestAnimationFrame(animate)
      timer.update()
      const elapsed = timer.getElapsed()
      const t = prefersReducedMotion ? initialTime % LOOP_SECONDS : (initialTime + elapsed) % LOOP_SECONDS
      material.uniforms.uTime.value = t
      flower.rotation.y = 0.08 + Math.sin((t / LOOP_SECONDS) * Math.PI * 2) * 0.055
      flower.rotation.x = 0.14 + Math.cos((t / LOOP_SECONDS) * Math.PI * 2) * 0.035
      innerGlow.scale.setScalar(0.9 + Math.sin((t / LOOP_SECONDS) * Math.PI * 2) * 0.04)
      composer.render()
    }
    animate()

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      geometry.dispose()
      material.dispose()
      innerGlow.geometry.dispose()
      ;(innerGlow.material as THREE.Material).dispose()
      renderer.dispose()
      composer.dispose()
      renderTarget.dispose()
      timer.dispose()
    }
  }, [])

  return (
    <main className="flower-poster">
      <div className="flower-poster__wash" aria-hidden="true" />
      <canvas ref={canvasRef} className="flower-poster__canvas" aria-label="由金色粒子组成的动态花卉" />
      <div className="flower-poster__grain" aria-hidden="true" />
      <div className="flower-poster__scanlines" aria-hidden="true" />

      <header className="flower-poster__header">
        <a className="flower-poster__brand" href="#top" aria-label="Omnilink Flower Studies 首页">
          <span className="flower-poster__brand-mark" aria-hidden="true">✳</span>
          <span>OMNILINK</span>
        </a>
        <div className="flower-poster__edition">STUDIO / 026<br /><span>数字花卉研究所</span></div>
      </header>

      <section id="top" className="flower-poster__copy" aria-labelledby="poster-title">
        <p className="flower-poster__kicker">商家经营的生成式样本</p>
        <h1 id="poster-title"><span>FLOWER</span><span>STUDIES</span></h1>
        <p className="flower-poster__dek">让每一个商品，像一朵花一样<br />在正确的语境里开放。</p>
      </section>

      <div className="flower-poster__meta flower-poster__meta--left"><span>01</span><span>形态 / FORM</span><span>粒子表面研究</span></div>
      <div className="flower-poster__meta flower-poster__meta--right"><span>OMNI / LINK</span><span>视觉经营中枢</span><span>2026 — 2027</span></div>

      <footer className="flower-poster__footer">
        <span>AI-NATIVE COMMERCE INFRASTRUCTURE</span>
        <span>SCROLL TO GROW →</span>
      </footer>
    </main>
  )
}
