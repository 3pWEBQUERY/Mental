import * as THREE from 'three'
import type { Box } from './tab-blob'

/**
 * Mehrere unabhängige Tropfen auf einem Canvas – für Knöpfe, die man einzeln an- und abschaltet
 * (Zuspruch: «Ich höre dich», «Kenn ich», «Du schaffst das»). Ein neuer Tropfen quillt vom Klickpunkt
 * auf und füllt den Knopf mit leichtem Nachwackeln; beim Abschalten zieht er sich zur Mitte zusammen.
 * Signed-Distance-Pillen im Fragment-Shader, gerendert nur solange sich etwas bewegt.
 */

const MAX = 4

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

const FS = /* glsl */ `
uniform vec2 uRes;
uniform vec4 uBox[${MAX}]; // links, oben, rechts, unten – Gerätepixel; leer: rechts <= links
uniform vec3 uColor;
uniform float uDpr;
varying vec2 vUv;
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  float d = 1e5;
  for (int i = 0; i < ${MAX}; i++) {
    vec4 b = uBox[i];
    if (b.z - b.x < 0.5 || b.w - b.y < 0.5) continue;
    vec2 c = (b.xy + b.zw) * 0.5;
    vec2 h = (b.zw - b.xy) * 0.5;
    d = min(d, sdRoundBox(px - c, h, min(h.x, h.y)));
  }
  float a = 1.0 - smoothstep(-0.75 * uDpr, 0.75 * uDpr, d);
  if (a <= 0.0) discard;
  gl_FragColor = vec4(uColor, a);
}`

type Spring = { x: number; v: number; to: number; k: number; z: number }
type Drop = { l: Spring; t: Spring; r: Spring; b: Spring; dying: boolean; still: boolean }

function cssColor(token: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return new THREE.Color(v || fallback)
}

const spring = (x: number, to: number, k: number, z: number): Spring => ({ x, v: 0, to, k, z })

export function createDropField(
  canvas: HTMLCanvasElement,
  { color, onFrame, onIdle }: { color: string; onFrame?: (boxes: Box[], moving: string[]) => void; onIdle?: () => void },
) {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power', premultipliedAlpha: false })
  } catch {
    return null
  }
  THREE.ColorManagement.enabled = false
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace
  renderer.setClearColor(0x000000, 0)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(dpr)

  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uBox: { value: Array.from({ length: MAX }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uColor: { value: cssColor(color, '#55694d') },
    uDpr: { value: dpr },
  }
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false }))
  scene.add(mesh)

  const drops = new Map<string, Drop>()
  let raf = 0
  let last = 0

  function draw() {
    const boxes: Box[] = []
    let i = 0
    for (const d of drops.values()) {
      if (i >= MAX) break
      const box = { left: Math.min(d.l.x, d.r.x), top: Math.min(d.t.x, d.b.x), right: Math.max(d.l.x, d.r.x), bottom: Math.max(d.t.x, d.b.x) }
      uniforms.uBox.value[i]!.set(box.left * dpr, box.top * dpr, box.right * dpr, box.bottom * dpr)
      boxes.push(box)
      i++
    }
    for (; i < MAX; i++) uniforms.uBox.value[i]!.set(0, 0, 0, 0)
    renderer.render(scene, camera)
    onFrame?.(
      boxes,
      [...drops].filter(([, d]) => !d.still).map(([k]) => k),
    )
  }

  function step(dt: number) {
    let moving = false
    for (const [key, d] of drops) {
      let still = true
      for (const sp of [d.l, d.t, d.r, d.b]) {
        sp.v += (sp.k * (sp.to - sp.x) - 2 * Math.sqrt(sp.k) * sp.z * sp.v) * dt
        sp.x += sp.v * dt
        if (Math.abs(sp.v) > 0.02 || Math.abs(sp.to - sp.x) > 0.05) still = false
        else {
          sp.x = sp.to
          sp.v = 0
        }
      }
      d.still = still
      if (still && d.dying) drops.delete(key)
      else if (!still) moving = true
    }
    return moving
  }

  function frame(now: number) {
    let dt = Math.min(Math.max(0, (now - last) / 1000), 1 / 30)
    last = Math.max(last, now)
    let moving = dt === 0
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240)
      moving = step(h)
      dt -= h
    }
    draw()
    raf = moving ? requestAnimationFrame(frame) : 0
    if (!raf) onIdle?.()
  }

  function kick() {
    if (raf) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  return {
    resize(w: number, h: number) {
      renderer.setSize(w, h, false)
      uniforms.uRes.value.set(w * dpr, h * dpr)
      draw()
    },
    /** Knopf an: Tropfen quillt von `from` (Klickpunkt) auf; `instant` setzt ihn ohne Bewegung. */
    fill(key: string, box: Box, from?: { x: number; y: number }, instant = false) {
      const cur = drops.get(key)
      if (instant) {
        drops.set(key, { l: spring(box.left, box.left, 1, 1), t: spring(box.top, box.top, 1, 1), r: spring(box.right, box.right, 1, 1), b: spring(box.bottom, box.bottom, 1, 1), dying: false, still: true })
        draw()
        return
      }
      const x = from ? Math.min(Math.max(from.x, box.left), box.right) : (box.left + box.right) / 2
      const y = from ? Math.min(Math.max(from.y, box.top), box.bottom) : (box.top + box.bottom) / 2
      // Waagrecht langsamer und weicher als senkrecht: Der Tropfen ist erst rund, dann zieht er sich zur Pille.
      const sx = (to: number, from: number, k: number) => spring(cur && !cur.dying ? from : x, to, k, 0.5)
      const sy = (to: number, from: number, k: number) => spring(cur && !cur.dying ? from : y, to, k, 0.55)
      drops.set(key, {
        l: sx(box.left, cur?.l.x ?? x, 260),
        r: sx(box.right, cur?.r.x ?? x, 260),
        t: sy(box.top, cur?.t.x ?? y, 460),
        b: sy(box.bottom, cur?.b.x ?? y, 460),
        dying: false,
        still: false,
      })
      kick()
    },
    /** Knopf aus: zur Mitte zusammenziehen und verschwinden. */
    drain(key: string, instant = false) {
      const d = drops.get(key)
      if (!d) return
      if (instant) {
        drops.delete(key)
        draw()
        return
      }
      const cx = (d.l.x + d.r.x) / 2
      const cy = (d.t.x + d.b.x) / 2
      for (const [sp, to] of [
        [d.l, cx],
        [d.r, cx],
        [d.t, cy],
        [d.b, cy],
      ] as const) {
        sp.to = to
        sp.k = 380
        sp.z = 0.95
      }
      d.dying = true
      d.still = false
      kick()
    },
    recolor() {
      uniforms.uColor.value = cssColor(color, '#55694d')
      draw()
    },
    get busy() {
      return raf !== 0
    },
    dispose() {
      cancelAnimationFrame(raf)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
      renderer.dispose()
      // Kontext sofort freigeben (viele Gedanken im Feed – Browser erlauben nur wenige gleichzeitig).
      renderer.forceContextLoss()
    },
  }
}

export type DropField = NonNullable<ReturnType<typeof createDropField>>
