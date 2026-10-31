'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { LIGHT, PEOPLE, VIEW_HEIGHT } from './scene'

const BLOB_VS = /* glsl */ `
uniform float uTime, uSeed, uAmp, uPulse, uFlame;
void main(){
  vec3 p = position;
  // Flamme: unten rund, nach oben schmaler und länger – mit leichtem Wiegen der Spitze.
  float up = max(p.y, 0.0);
  p.x *= 1.0 - 0.42 * smoothstep(0.0, 1.0, up) * uFlame;
  p.x += sin(uTime * 1.3 + uSeed) * 0.12 * up * up * uFlame;
  p.y *= 1.0 + 0.7 * up * uFlame;
  float a = atan(position.y, position.x);
  float r = length(position.xy);
  float w = sin(a*3.0 + uTime*0.9 + uSeed) * 0.5
          + sin(a*5.0 - uTime*0.6 + uSeed*1.7) * 0.3
          + sin(a*2.0 + uTime*0.4 + uSeed*0.3) * 0.4;
  // Mittelpunkt bleibt, der Rand atmet und verformt sich weich.
  p.xy *= 1.0 + (uAmp * w + uPulse * 0.22) * r;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`

const FLAT_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main(){ gl_FragColor = vec4(uColor, uOpacity); }`

const EMBER_VS = /* glsl */ `
uniform float uTime, uPR, uScale;
attribute float aSeed;
varying float vA;
void main(){
  float life = fract(uTime * (0.07 + aSeed * 0.05) + aSeed * 7.0);
  vec3 p = position;
  p.x += sin(life * 6.2831 * (0.6 + aSeed) + aSeed * 12.0) * 0.35 * life;
  p.y += life * 3.6;
  vA = smoothstep(0.0, 0.12, life) * (1.0 - life);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (2.0 + aSeed * 3.0) * uPR * uScale * (1.0 - life * 0.5);
}`

const EMBER_FS = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;
  gl_FragColor = vec4(uColor, vA * 0.85);
}`

function css(token: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback
}

type Spark = { mesh: THREE.Mesh; line: THREE.Line; from: number; to: number; t: number }

/**
 * «Beieinander»: Menschen sitzen um ein warmes Feuer. Glut steigt auf, und ab und zu
 * wandert ein Funke Zuspruch – an einem feinen Faden – von einer Person zur nächsten. Flache Farben aus den Design-Tokens,
 * pausiert ausserhalb des Viewports, steht still bei reduzierter Bewegung.
 */
export default function Gathering({ onUnavailable }: { onUnavailable: () => void }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      onUnavailable()
      return
    }
    THREE.ColorManagement.enabled = false
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)
    // «Reduziert» und «Aus» aus den Einstellungen zählen wie die Systemeinstellung.
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean(document.documentElement.dataset.motion)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50)
    camera.position.z = 10
    const disposables: { dispose(): void }[] = []
    const flat = (color: string, opacity = 1) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
        vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: FLAT_FS,
        transparent: opacity < 1,
        depthWrite: false,
      })
      disposables.push(mat)
      return mat
    }

    const blobMaterial = (token: string, fallback: string, seed: number, amp: number, opacity = 1) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: seed },
          uAmp: { value: amp },
          uPulse: { value: 0 },
          uFlame: { value: 0 },
          uColor: { value: new THREE.Color(css(token, fallback)) },
          uOpacity: { value: opacity },
        },
        vertexShader: BLOB_VS,
        fragmentShader: FLAT_FS,
        transparent: opacity < 1,
        depthWrite: false,
      })
      disposables.push(mat)
      return mat
    }
    const blobGeo = new THREE.CircleGeometry(1, 128)
    disposables.push(blobGeo)

    // Feuer: ein weicher, atmender Schein und eine flackernde, organische Flamme – keine Kreise, keine Ringe.
    const light = new THREE.Group()
    light.position.set(LIGHT.x, LIGHT.y, 0)
    const glowMat = blobMaterial('--clay-soft', '#F2E1D9', 11.0, 0.03)
    const glow = new THREE.Mesh(blobGeo, glowMat)
    glow.scale.set(LIGHT.r * 3.3, LIGHT.r * 3.1, 1)
    glow.position.set(0, -0.45, -2)
    const flameMat = blobMaterial('--clay', '#C4583A', 3.3, 0.07)
    flameMat.uniforms.uFlame!.value = 1
    const flame = new THREE.Mesh(blobGeo, flameMat)
    flame.scale.set(LIGHT.r * 0.95, LIGHT.r * 0.95, 1)
    flame.position.y = -0.2
    light.add(glow, flame)
    scene.add(light)

    // Fäden: kurz sichtbar, solange ein Funke Zuspruch unterwegs ist.
    const threadMat = new THREE.LineBasicMaterial({ color: new THREE.Color(css('--clay', '#C4583A')), transparent: true, opacity: 0 })
    disposables.push(threadMat)

    // Glut, die vom Licht aufsteigt.
    const EMBERS = 46
    const ePos = new Float32Array(EMBERS * 3)
    const eSeed = new Float32Array(EMBERS)
    for (let i = 0; i < EMBERS; i++) {
      ePos[i * 3] = (Math.random() - 0.5) * LIGHT.r * 0.7
      ePos[i * 3 + 1] = LIGHT.r * 0.9 + (Math.random() - 0.5) * LIGHT.r * 0.4
      ePos[i * 3 + 2] = -1
      eSeed[i] = Math.random()
    }
    const emberGeo = new THREE.BufferGeometry()
    emberGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3))
    emberGeo.setAttribute('aSeed', new THREE.BufferAttribute(eSeed, 1))
    const emberMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uScale: { value: 1 }, uColor: { value: new THREE.Color(css('--clay', '#C4583A')) } },
      vertexShader: EMBER_VS,
      fragmentShader: EMBER_FS,
      transparent: true,
      depthWrite: false,
    })
    disposables.push(emberGeo, emberMat)
    const embers = new THREE.Points(emberGeo, emberMat)
    light.add(embers)

    // Menschen: organische Formen in den Stimmungsfarben.
    const people = PEOPLE.map((p, i) => {
      const mat = blobMaterial(`--mood-${p.mood}`, '#55694D', p.seed, 0.09 + (p.mood === 0 ? 0.04 : 0))
      const mesh = new THREE.Mesh(blobGeo, mat)
      mesh.scale.setScalar(p.r)
      mesh.position.set(p.x, p.y, 0)
      scene.add(mesh)
      return { mesh, mat, base: p, phase: i * 1.7 }
    })

    // Funken Zuspruch.
    const sparkGeo = new THREE.CircleGeometry(0.075, 24)
    const sparkMat = flat(css('--clay', '#C4583A'))
    disposables.push(sparkGeo)
    const sparks: Spark[] = []
    let nextSpark = 1.2

    const recolor = () => {
      glowMat.uniforms.uColor!.value.set(css('--clay-soft', '#F2E1D9'))
      flameMat.uniforms.uColor!.value.set(css('--clay', '#C4583A'))
      threadMat.color.set(css('--clay', '#C4583A'))
      sparkMat.uniforms.uColor!.value.set(css('--clay', '#C4583A'))
      emberMat.uniforms.uColor!.value.set(css('--clay', '#C4583A'))
      people.forEach((p) => p.mat.uniforms.uColor!.value.set(css(`--mood-${p.base.mood}`, '#55694D')))
      if (still) renderer.render(scene, camera)
    }
    const mo = new MutationObserver(recolor)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    // Farbschema «System»: auch den abendlichen Wechsel des Betriebssystems mitnehmen.
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', recolor)

    function resize() {
      const w = el!.clientWidth
      const h = el!.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      const aspect = w / h
      // Immer die ganze Komposition zeigen – auf schmalen Flächen wird die Höhe grösser.
      const height = Math.max(VIEW_HEIGHT, 8.2 / aspect)
      camera.top = height / 2
      camera.bottom = -height / 2
      camera.left = (-height * aspect) / 2
      camera.right = (height * aspect) / 2
      camera.updateProjectionMatrix()
      emberMat.uniforms.uScale!.value = h / 420
      if (still) renderer.render(scene, camera)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    let mx = 0
    let my = 0
    let lx = 0
    let ly = 0
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2
      my = -((e.clientY - r.top) / r.height - 0.5) * 2
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
    let time = 0
    let last = performance.now()
    let raf = 0
    let visible = true
    let inView = true

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      time += dt

      // Atem des Lichts: 4 s ein, 2 s halten, 4 s aus.
      const c = time % 10
      const b = c < 4 ? ease(c / 4) : c < 6 ? 1 : 1 - ease((c - 6) / 4)
      light.scale.setScalar(1 + b * 0.06)
      glowMat.uniforms.uTime!.value = time * 0.6
      // Die Flamme flackert schneller als alles andere.
      flameMat.uniforms.uTime!.value = time * 1.9
      lx += (mx * 0.45 - lx) * 0.03
      ly += (my * 0.3 - ly) * 0.03
      light.position.set(LIGHT.x + lx, LIGHT.y + ly, 0)
      emberMat.uniforms.uTime!.value = time

      for (const p of people) {
        const u = p.mat.uniforms
        u.uTime!.value = time
        u.uPulse!.value *= 0.96
        const breath = 1 + Math.sin(time * 0.55 + p.phase) * 0.035
        p.mesh.scale.setScalar(p.base.r * breath)
        // Leicht zum Licht geneigt, sanft schwebend.
        const dx = light.position.x - p.base.x
        const dy = light.position.y - p.base.y
        const d = Math.hypot(dx, dy) || 1
        p.mesh.position.set(
          p.base.x + (dx / d) * 0.08 * b + Math.sin(time * 0.3 + p.phase) * 0.06,
          p.base.y + (dy / d) * 0.08 * b + Math.cos(time * 0.27 + p.phase) * 0.06,
          0,
        )
      }

      // Zuspruch: ein Funke wandert im Bogen über das Licht zu einer anderen Person.
      nextSpark -= dt
      if (nextSpark <= 0 && sparks.length < 3) {
        const from = Math.floor(Math.random() * people.length)
        let to = Math.floor(Math.random() * (people.length - 1))
        if (to >= from) to++
        const mesh = new THREE.Mesh(sparkGeo, sparkMat)
        mesh.position.z = 1
        const lineGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 33 }, () => new THREE.Vector3()))
        const line = new THREE.Line(lineGeo, threadMat.clone())
        line.position.z = -0.5
        scene.add(mesh, line)
        sparks.push({ mesh, line, from, to, t: 0 })
        nextSpark = 1.6 + Math.random() * 1.8
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]!
        s.t += dt / 2.6
        const a = people[s.from]!.mesh.position
        const z = people[s.to]!.mesh.position
        const k = ease(Math.min(s.t, 1))
        // Der Bogen führt über das Feuer.
        const cx = ((a.x + z.x) / 2) * 0.4 + light.position.x * 0.6
        const cy = Math.max(a.y, z.y) * 0.3 + light.position.y * 0.7 + 1.4
        const at = (u: number) => {
          const q = 1 - u
          return [q * q * a.x + 2 * q * u * cx + u * u * z.x, q * q * a.y + 2 * q * u * cy + u * u * z.y] as const
        }
        const [sx, sy] = at(k)
        s.mesh.position.set(sx, sy, 1)
        s.mesh.scale.setScalar(Math.sin(Math.PI * Math.min(s.t, 1)) * 0.9 + 0.3)
        // Der Faden spannt sich bis zum Funken und verblasst danach.
        const attr = s.line.geometry.getAttribute('position') as THREE.BufferAttribute
        for (let j = 0; j <= 32; j++) {
          const [x, y] = at((j / 32) * k)
          attr.setXYZ(j, x, y, 0)
        }
        attr.needsUpdate = true
        ;(s.line.material as THREE.LineBasicMaterial).opacity = 0.32 * Math.sin(Math.PI * Math.min(s.t, 1))
        if (s.t >= 1) {
          people[s.to]!.mat.uniforms.uPulse!.value = 1
          scene.remove(s.mesh, s.line)
          s.line.geometry.dispose()
          ;(s.line.material as THREE.Material).dispose()
          sparks.splice(i, 1)
        }
      }

      renderer.render(scene, camera)
      raf = requestAnimationFrame(frame)
    }

    function run() {
      cancelAnimationFrame(raf)
      if (still) {
        time = 2.5
        renderer.render(scene, camera)
        return
      }
      if (visible && inView) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    const io = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true
      run()
    })
    io.observe(el)
    const onVis = () => {
      visible = document.visibilityState === 'visible'
      run()
    }
    document.addEventListener('visibilitychange', onVis)
    run()

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      mo.disconnect()
      mq.removeEventListener('change', recolor)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pointermove', onMove)
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
    // Die Szene wird genau einmal aufgebaut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={host} className="gathering" aria-hidden="true" />
}
