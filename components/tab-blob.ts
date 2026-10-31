import * as THREE from 'three'

/**
 * Der aktive Reiter als weicher Tropfen: Beim Wechsel läuft die vordere Kante voraus, die hintere folgt
 * gedämpft nach – der Tropfen dehnt sich, wird dabei etwas flacher und setzt sich als Pille wieder.
 * Gezeichnet als Signed-Distance-Shape im Fragment-Shader: auf jeder Pixeldichte gestochen scharf.
 * Gerendert wird nur, solange sich etwas bewegt.
 */

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

const FS = /* glsl */ `
uniform vec2 uRes;
uniform vec4 uBox; // links, oben, rechts, unten – in Gerätepixeln
uniform vec3 uColor;
uniform float uDpr;
uniform float uRadius; // < 0: Pille (halbe Höhe)
varying vec2 vUv;
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 c = vec2(uBox.x + uBox.z, uBox.y + uBox.w) * 0.5;
  vec2 h = max(vec2(uBox.z - uBox.x, uBox.w - uBox.y) * 0.5, vec2(0.5));
  float r = uRadius < 0.0 ? min(h.x, h.y) : min(uRadius * uDpr, min(h.x, h.y));
  float d = sdRoundBox(px - c, h, r);
  float a = 1.0 - smoothstep(-0.75 * uDpr, 0.75 * uDpr, d);
  if (a <= 0.0) discard;
  gl_FragColor = vec4(uColor, a);
}`

type Spring = { x: number; v: number; to: number }
export type Box = { left: number; top: number; right: number; bottom: number }

function cssColor(token: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return new THREE.Color(v || fallback)
}

/**
 * `onFrame` bekommt die gezeichnete Form (CSS-Pixel) – damit die Schrift darüber hell wird, genau wo der Tropfen ist.
 * `radius` in CSS-Pixeln für eckigere Auswahlen (Kreisliste); ohne Angabe eine Pille.
 */
export function createTabBlob(canvas: HTMLCanvasElement, onFrame?: (box: Box | null) => void, radius = -1) {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power', premultipliedAlpha: false })
  } catch {
    return null
  }
  // Farben unverändert in den Shader – wie die übrigen Szenen.
  THREE.ColorManagement.enabled = false
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace
  renderer.setClearColor(0x000000, 0)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(dpr)

  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uBox: { value: new THREE.Vector4(0, 0, 0, 0) },
    uColor: { value: cssColor('--ink', '#1c1c1a') },
    uDpr: { value: dpr },
    uRadius: { value: radius },
  }
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false }))
  scene.add(mesh)

  const s: Record<'l' | 't' | 'r' | 'b', Spring> = {
    l: { x: 0, v: 0, to: 0 },
    t: { x: 0, v: 0, to: 0 },
    r: { x: 0, v: 0, to: 0 },
    b: { x: 0, v: 0, to: 0 },
  }
  let size = { w: 1, h: 1 }
  let raf = 0
  let last = 0
  // Vordere Kante straff, hintere weich: daraus entsteht das Fliessen.
  let stiff = { l: 300, r: 300, t: 260, b: 260 }
  // Kein Reiter aktiv (z. B. eine Unterseite im Admin): nichts zeichnen, beim nächsten Ziel ohne Anlauf erscheinen.
  let hidden = true

  function draw() {
    if (hidden) {
      renderer.clear()
      onFrame?.(null)
      return
    }
    // Je mehr der Tropfen gedehnt ist, desto schmaler wird er quer dazu – wie Flüssigkeit.
    const stretchX = Math.min(1, Math.max(0, (s.r.x - s.l.x) / Math.max(1, s.r.to - s.l.to) - 1))
    const stretchY = Math.min(1, Math.max(0, (s.b.x - s.t.x) / Math.max(1, s.b.to - s.t.to) - 1))
    const cx = (s.l.x + s.r.x) / 2
    const cy = (s.t.x + s.b.x) / 2
    const halfW = ((s.r.x - s.l.x) / 2) * (1 - 0.12 * stretchY)
    const halfH = ((s.b.x - s.t.x) / 2) * (1 - 0.22 * stretchX)
    // Das Nachschwingen bleibt innerhalb der Fläche.
    const box = { left: Math.max(1, cx - halfW), top: Math.max(0, cy - halfH), right: Math.min(size.w - 1, cx + halfW), bottom: Math.min(size.h, cy + halfH) }
    uniforms.uBox.value.set(box.left * dpr, box.top * dpr, box.right * dpr, box.bottom * dpr)
    renderer.render(scene, camera)
    onFrame?.(box)
  }

  function step(dt: number) {
    let moving = false
    for (const k of ['l', 'r', 't', 'b'] as const) {
      const sp = s[k]
      const kx = stiff[k]
      const damping = 2 * Math.sqrt(kx) * 0.72
      sp.v += (kx * (sp.to - sp.x) - damping * sp.v) * dt
      sp.x += sp.v * dt
      if (Math.abs(sp.v) > 0.02 || Math.abs(sp.to - sp.x) > 0.05) moving = true
      else {
        sp.x = sp.to
        sp.v = 0
      }
    }
    return moving
  }

  function frame(now: number) {
    // Der Zeitstempel von requestAnimationFrame kann knapp vor performance.now() beim Start liegen –
    // dann ist dt ≤ 0, und es geht einfach im nächsten Bild weiter (nicht «fertig»).
    let dt = Math.min(Math.max(0, (now - last) / 1000), 1 / 30)
    last = Math.max(last, now)
    let moving = dt === 0
    // Kleine Teilschritte: stabil auch bei schwankender Bildrate.
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240)
      moving = step(h)
      dt -= h
    }
    draw()
    raf = moving ? requestAnimationFrame(frame) : 0
  }

  function kick() {
    if (raf) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  return {
    resize(w: number, h: number) {
      size = { w, h }
      renderer.setSize(w, h, false)
      uniforms.uRes.value.set(w * dpr, h * dpr)
      draw()
    },
    /** Neues Ziel. `instant` setzt ohne Bewegung (erster Aufbau, Grössenänderung, reduzierte Bewegung). */
    moveTo(box: Box, instant = false) {
      if (hidden) instant = true
      hidden = false
      // Vordere Kante straff, hintere weich – waagrecht wie senkrecht (Kreisliste, umbrechende Leisten).
      const dx = box.left - s.l.to
      const dy = box.top - s.t.to
      stiff = {
        l: dx > 0 ? 140 : dx < 0 ? 420 : 300,
        r: dx > 0 ? 420 : dx < 0 ? 140 : 300,
        t: dy > 0 ? 160 : dy < 0 ? 420 : 260,
        b: dy > 0 ? 420 : dy < 0 ? 160 : 260,
      }
      s.l.to = box.left
      s.r.to = box.right
      s.t.to = box.top
      s.b.to = box.bottom
      if (instant) {
        for (const k of ['l', 'r', 't', 'b'] as const) {
          s[k].x = s[k].to
          s[k].v = 0
        }
        draw()
      } else kick()
    },
    hide() {
      hidden = true
      cancelAnimationFrame(raf)
      raf = 0
      draw()
    },
    recolor() {
      uniforms.uColor.value = cssColor('--ink', '#1c1c1a')
      draw()
    },
    get size() {
      return size
    },
    dispose() {
      cancelAnimationFrame(raf)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
      renderer.dispose()
    },
  }
}

export type TabBlob = NonNullable<ReturnType<typeof createTabBlob>>
