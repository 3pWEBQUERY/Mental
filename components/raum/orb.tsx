'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { BREATH, MOODS } from '@/lib/constants'

export type OrbApi = {
  setMood(i: number): void
  pulse(): void
  breathe(onTick: (phase: 'inhale' | 'hold' | 'exhale', secondsLeft: number) => void, onEnd: (finished: boolean) => void): void
  stopBreath(): void
  /** 5-4-3-2-1: Punkte fliessen zur Ziffer `n` (oder mit `null` zurück zur Kugel). `dir` +1 vorwärts, -1 zurück. */
  ground(n: number | null, dir: 1 | -1): void
  /** Ziffern schon vermessen (bei Annäherung an den Umschalter), damit die Punkte sofort losfliessen. */
  prepareGround(): void
}

export type Motion = 'on' | 'reduced' | 'off'

/** Funken: Position ganz im Shader – steigen von unterhalb der Mitte auf, schwanken leicht, verglimmen. */
const EMBER_VS = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uPR;
varying float vAlpha;
void main(){
  float life = fract(uTime * (0.035 + aSeed * 0.03) + aSeed * 7.31);
  float ang = aSeed * 6.2831;
  float r = 0.55 + 0.6 * fract(aSeed * 13.7);
  vec3 p = vec3(cos(ang) * r, mix(-0.4, 2.1, life), sin(ang) * r * 0.5);
  p.x += sin(uTime * 0.7 + aSeed * 20.0) * 0.08 * life;
  vAlpha = sin(3.14159 * life) * (0.5 + 0.45 * fract(aSeed * 5.3));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (3.5 + 3.5 * fract(aSeed * 3.1)) * uPR * (6.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`
const EMBER_FS = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(uColor, vAlpha * smoothstep(0.5, 0.1, d));
}`

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`

const VS = /* glsl */ `${NOISE}
uniform float uTime, uAmp, uBreath, uPulse, uPR;
uniform float uMix, uFromS, uToS, uDir, uGlow;
uniform mat3 uRot;
attribute float aRand;
attribute vec3 aFrom, aTo;
varying float vA;
varying float vG;
varying float vHi;
void main(){
  vec3 base = position;
  float n  = snoise(base*1.3 + vec3(0.0, uTime*0.18, uTime*0.12));
  float n2 = snoise(base*3.2 - vec3(uTime*0.10));
  float rip = uPulse * 0.09 * sin(base.y*9.0 - uTime*5.0);
  // Kugel: wie bisher verformt, die Drehung kommt als Matrix (die Ziffer bleibt dem Blick zugewandt).
  vec3 ps = uRot * (base * (1.0 + n*uAmp + n2*uAmp*0.3 + uBreath + rip) + base * aRand * 0.035);
  // Ziffer: Punkte der Glyphe, mit einem Hauch derselben Bewegung – sie lebt, ohne zu zerfliessen.
  vec3 sh = vec3(n, n2, n * n2) * 0.016 + vec3(0.0, 0.0, rip * 0.5);
  vec3 from = mix(aFrom + sh, ps, uFromS);
  vec3 to = mix(aTo + sh, ps, uToS);
  // Welle quer über die Form: vorwärts von rechts nach links (wie eine Folie, die nach links weicht).
  float xn = clamp(to.x / 1.4, -1.0, 1.0) * uDir;
  float d = 0.55 * (0.5 - 0.5 * xn) + aRand * 0.25;
  float t = clamp(uMix * 1.8 - d, 0.0, 1.0);
  float e = t * t * (3.0 - 2.0 * t);
  float arc = sin(3.14159265 * t);
  vec3 p = mix(from, to, e);
  p.x -= uDir * arc * (0.22 + 0.24 * aRand);
  p.z += arc * (aRand - 0.5) * 0.7;
  vec4 w  = modelMatrix * vec4(p, 1.0);
  vec4 mv = viewMatrix * w;
  gl_Position = projectionMatrix * mv;
  float g = mix(1.0 - uFromS, 1.0 - uToS, e);
  // Bei Nacht glimmt die Ziffer: weichere, etwas grössere Punkte (siehe FS).
  gl_PointSize = (1.4 + aRand*2.0) * uPR * (5.0 / -mv.z) * mix(1.0, mix(1.12, 1.55, uGlow), g);
  float aS = (0.25 + 0.75*smoothstep(-0.6, 0.8, n)) * (0.35 + 0.65*smoothstep(-1.4, 1.4, w.z));
  float aD = 0.5 + 0.45 * aRand;
  // Bei Nacht leises Funkeln, wie Glut – jeder Punkt in eigenem Takt.
  aD *= 1.0 - uGlow * (0.3 + 0.22 * sin(uTime * (1.6 + aRand * 2.4) + aRand * 40.0));
  vA = mix(aS, aD, g);
  vG = g;
  // Verlauf in der Ziffer: unten tiefer, oben wärmer; einzelne helle Funken.
  vHi = clamp(p.y / 2.6 + 0.5, 0.0, 1.0) * 0.75 + step(0.93, aRand) * 0.5;
}`

const FS = /* glsl */ `
uniform vec3 uColor, uWarm;
uniform float uGlow;
varying float vA;
varying float vG;
varying float vHi;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  if (d2 > 0.25) discard;
  float glow = uGlow * vG;
  // Hell: scharfe Scheibe wie bisher. Nacht-Ziffer: weich auslaufender Glutpunkt.
  float a = vA * mix(1.0, exp(-d2 * 14.0), glow);
  vec3 col = mix(uColor, uWarm, glow * clamp(vHi, 0.0, 1.0));
  // Vormultipliziert: Mit Deckkraft 1 wie normales Überblenden (Hellmodus, Kugel), mit weniger Deckkraft
  // addiert sich das Licht – dicht liegende Punkte der Nacht-Ziffer glimmen heller.
  gl_FragColor = vec4(col * a, a * mix(1.0, 0.3, glow));
}`

function cssColor(token: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return v || '#1C1C1A'
}

/**
 * Punkte einer Ziffer in der Schrift der Seite (Instrument Serif): Glyphe auf ein verstecktes Canvas,
 * gefüllte Pixel einsammeln, jeder Partikel bekommt einen davon (mit Versatz innerhalb des Pixels).
 */
const glyphs = new Map<string, Float32Array>()
async function glyphPoints(ch: string, n: number): Promise<Float32Array> {
  const hit = glyphs.get(ch)
  if (hit) return hit
  const family = getComputedStyle(document.querySelector('.checkin h2') ?? document.body).fontFamily || 'Georgia, serif'
  const S = 420
  const font = `400 ${Math.round(S * 0.86)}px ${family}`
  try {
    await document.fonts.load(font, ch)
  } catch {}
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#000'
  ctx.fillText(ch, S / 2, S * 0.8)
  const data = ctx.getImageData(0, 0, S, S).data
  const px: number[] = []
  let minX = S,
    maxX = 0,
    minY = S,
    maxY = 0
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      if (data[(y * S + x) * 4 + 3]! > 150) {
        px.push(x, y)
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  const out = new Float32Array(n * 3)
  const count = px.length / 2
  if (!count) return out
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  // Etwas grösser als die Kugel (Durchmesser 2): Die Ziffer soll den Raum füllen, nicht darin schweben.
  const scale = 2.5 / Math.max(1, maxY - minY)
  for (let i = 0; i < n; i++) {
    const j = Math.floor(Math.random() * count)
    out[i * 3] = (px[j * 2]! + Math.random() - cx) * scale
    out[i * 3 + 1] = -(px[j * 2 + 1]! + Math.random() - cy) * scale
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.12
  }
  glyphs.set(ch, out)
  return out
}

/** Leiser Ton beim Phasenwechsel – standardmässig aus. */
function chime(ctx: AudioContext | null, freq: number) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 1.3)
}

/**
 * Der Raum: eine weiche Form aus 9000 Partikeln (Fibonacci-Verteilung), verformt durch Simplex-Noise,
 * in der Farbe der eigenen Stimmung – darüber steigen ein paar warme Funken auf.
 * Wird per next/dynamic ohne SSR geladen. Rendering pausiert ausserhalb des Viewports und im Hintergrund-Tab.
 */
export default function Orb({
  motion,
  sound,
  initialMood,
  onApi,
  onUnavailable,
}: {
  motion: Motion
  sound: boolean
  initialMood: number | null
  onApi: (api: OrbApi) => void
  onUnavailable: () => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const soundRef = useRef(sound)
  soundRef.current = sound

  useEffect(() => {
    const host = el.current
    if (!host) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      onUnavailable()
      return
    }
    // Wie im Entwurf: Farben unverändert in den Shader, ohne Farbraum-Umrechnung.
    THREE.ColorManagement.enabled = false
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    const reduce = motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    camera.position.z = 6.4

    const N = 9000
    const pos = new Float32Array(N * 3)
    const rnd = new Float32Array(N)
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2
      const rad = Math.sqrt(1 - y * y)
      const th = golden * i
      pos[i * 3] = Math.cos(th) * rad
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = Math.sin(th) * rad
      rnd[i] = Math.random()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1))
    const fromAttr = new THREE.BufferAttribute(new Float32Array(N * 3), 3)
    const toAttr = new THREE.BufferAttribute(new Float32Array(N * 3), 3)
    fromAttr.setUsage(THREE.DynamicDrawUsage)
    toAttr.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aFrom', fromAttr)
    geo.setAttribute('aTo', toAttr)

    const startMood = initialMood ?? 2
    const startColor = new THREE.Color(cssColor(MOODS[startMood]!.token))
    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: MOODS[startMood]!.amp },
      uBreath: { value: 0 },
      uPulse: { value: 0 },
      uPR: { value: renderer.getPixelRatio() },
      uColor: { value: startColor.clone() },
      uMix: { value: 1 },
      uFromS: { value: 1 },
      uToS: { value: 1 },
      uDir: { value: 1 },
      uRot: { value: new THREE.Matrix3() },
      uGlow: { value: 0 },
      uWarm: { value: new THREE.Color(cssColor('--clay-ink')) },
    }
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
      // Vormultipliziertes Alpha (siehe FS): erlaubt der Nacht-Ziffer, Licht zu addieren.
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    })
    // Nacht: Ziffer als Glut in Aprikose → Gold. Hell: unverändert.
    const theme = () => {
      const bg = new THREE.Color(cssColor('--paper'))
      const night = bg.r * 0.2126 + bg.g * 0.7152 + bg.b * 0.0722 < 0.3
      uniforms.uGlow.value = night ? 1 : 0
      uniforms.uWarm.value.set(night ? '#f7c58d' : cssColor('--clay-ink'))
    }
    theme()
    const group = new THREE.Group()
    const points = new THREE.Points(geo, mat)
    // Die Ziffern liegen ausserhalb der Kugel-Bounding-Sphere – nie wegschneiden.
    points.frustumCulled = false
    group.add(points)
    scene.add(group)

    // Statt Umlaufbahnen: ein paar warme Funken steigen langsam auf und verglimmen –
    // dieselbe Sprache wie die Szene «Beieinander» auf der Startseite. Kein Kreisen, keine Planeten.
    const EMBERS = 28
    const seeds = new Float32Array(EMBERS)
    const emberPos = new Float32Array(EMBERS * 3)
    for (let i = 0; i < EMBERS; i++) seeds[i] = Math.random()
    const emberGeo = new THREE.BufferGeometry()
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3))
    emberGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    const emberColor = new THREE.Color(cssColor('--clay'))
    const emberMat = new THREE.ShaderMaterial({
      uniforms: { uTime: uniforms.uTime, uPR: uniforms.uPR, uColor: { value: emberColor } },
      vertexShader: EMBER_VS,
      fragmentShader: EMBER_FS,
      transparent: true,
      depthWrite: false,
    })
    const embers = new THREE.Points(emberGeo, emberMat)
    embers.frustumCulled = false
    scene.add(embers)
    const disposables: { dispose(): void }[] = [geo, mat, emberGeo, emberMat]

    const target: { amp: number; speed: number; color: THREE.Color; mood: number } = {
      amp: MOODS[startMood]!.amp,
      speed: MOODS[startMood]!.speed,
      color: startColor.clone(),
      mood: startMood,
    }
    let time = 0
    let last = performance.now()
    let mx = 0
    let my = 0
    let rx = 0
    let ry = 0
    let spin = 0
    let raf = 0
    let visible = true
    let inView = true
    const breath: {
      on: boolean
      start: number
      phase: string
      tick: ((p: 'inhale' | 'hold' | 'exhale', left: number) => void) | null
      end: ((finished: boolean) => void) | null
    } = { on: false, start: 0, phase: '', tick: null, end: null }
    let audio: AudioContext | null = null
    // 5-4-3-2-1: laufende Verwandlung (uMix 0 → 1) und ein wartendes Ziel, falls schneller geklickt wird.
    const morph = { from: 0, dur: 1.5, running: false, digit: 0, pending: null as null | { n: number | null; dir: 1 | -1 } }
    const euler = new THREE.Euler()
    const m4 = new THREE.Matrix4()

    const onMove = (e: PointerEvent) => {
      mx = e.clientX / innerWidth - 0.5
      my = e.clientY / innerHeight - 0.5
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    function resize() {
      const w = host!.clientWidth
      const h = host!.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.position.z = Math.max(6.4, 2.3 / (Math.tan(THREE.MathUtils.degToRad(17.5)) * camera.aspect))
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
    const CYCLE = BREATH.inhale + BREATH.hold + BREATH.exhale

    function stopBreath(finished: boolean) {
      if (!breath.on) return
      breath.on = false
      breath.end?.(finished)
    }

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const k = reduce ? 0.3 : 1
      time += dt * target.speed * k
      uniforms.uTime.value = time
      uniforms.uAmp.value += (target.amp - uniforms.uAmp.value) * 0.03
      uniforms.uColor.value.lerp(target.color, 0.03)
      uniforms.uPulse.value *= 0.965

      let b = 0.015 * Math.sin(now / 1600)
      if (breath.on) {
        const t0 = (now - breath.start) / 1000
        if (t0 >= CYCLE * BREATH.cycles) stopBreath(true)
        else {
          const t = t0 % CYCLE
          let phase: 'inhale' | 'hold' | 'exhale'
          if (t < BREATH.inhale) {
            b = ease(t / BREATH.inhale) * 0.22
            phase = 'inhale'
          } else if (t < BREATH.inhale + BREATH.hold) {
            b = 0.22
            phase = 'hold'
          } else {
            b = 0.22 * (1 - ease((t - BREATH.inhale - BREATH.hold) / BREATH.exhale))
            phase = 'exhale'
          }
          if (phase !== breath.phase) {
            if (soundRef.current && breath.phase) chime(audio, phase === 'inhale' ? 392 : phase === 'hold' ? 440 : 330)
            breath.phase = phase
          }
          breath.tick?.(phase, Math.ceil(CYCLE * BREATH.cycles - t0))
        }
      }
      uniforms.uBreath.value += (b - uniforms.uBreath.value) * 0.12

      if (morph.running) {
        const t = reduce ? 1 : Math.min(1, (now - morph.from) / 1000 / morph.dur)
        uniforms.uMix.value = t
        if (t >= 1) {
          morph.running = false
          const next = morph.pending
          morph.pending = null
          if (next) startMorph(next.n, next.dir)
        }
      }
      // Wie viel «Ziffer» gerade im Bild ist: Die Neigung zum Zeiger wird dann ruhiger, die Schrift bleibt lesbar.
      const tm = uniforms.uMix.value
      morph.digit = (1 - uniforms.uFromS.value) * (1 - tm) + (1 - uniforms.uToS.value) * tm

      spin += dt * 0.06 * target.speed * k
      rx += (my * 0.35 - rx) * 0.04
      ry += (mx * 0.5 - ry) * 0.04
      uniforms.uRot.value.setFromMatrix4(m4.makeRotationFromEuler(euler.set(0.25, spin, 0)))
      const calm = 1 - 0.8 * morph.digit
      group.rotation.set(rx * calm, ry * calm, 0)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(frame)
    }

    function run() {
      cancelAnimationFrame(raf)
      // Die Atemübung läuft weiter, auch wenn die Kugel kurz aus dem Bild scrollt.
      if ((visible && inView) || breath.on) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    const io = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true
      run()
    })
    io.observe(host)
    const onVis = () => {
      visible = document.visibilityState === 'visible'
      run()
    }
    document.addEventListener('visibilitychange', onVis)
    run()

    // Farbschema-Wechsel: Farben neu aus den CSS-Tokens lesen.
    const recolor = () => {
      theme()
      target.color.set(cssColor(uniforms.uToS.value < 0.5 ? '--clay-ink' : MOODS[target.mood]!.token))
      emberColor.set(cssColor('--clay'))
    }
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', recolor)
    const mo = new MutationObserver(recolor)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    async function startMorph(n: number | null, dir: 1 | -1) {
      if (morph.running) {
        morph.pending = { n, dir }
        return
      }
      const pts = n === null ? null : await glyphPoints(String(n), N)
      if (morph.running) {
        morph.pending = { n, dir }
        return
      }
      // Was eben noch Ziel war, ist jetzt der Anfang.
      ;(fromAttr.array as Float32Array).set(toAttr.array as Float32Array)
      fromAttr.needsUpdate = true
      uniforms.uFromS.value = uniforms.uToS.value
      if (pts) {
        ;(toAttr.array as Float32Array).set(pts)
        toAttr.needsUpdate = true
      }
      uniforms.uToS.value = pts ? 0 : 1
      uniforms.uDir.value = dir
      uniforms.uMix.value = 0
      morph.from = performance.now()
      morph.running = true
      // Ziffern in Ton, ruhig; zurück zur Kugel in der Farbe der eigenen Stimmung.
      if (pts) {
        target.color.set(cssColor('--clay-ink'))
        target.amp = 0.06
      } else {
        const md = MOODS[target.mood]!
        target.color.set(cssColor(md.token))
        target.amp = md.amp
        uniforms.uPulse.value = reduce ? 0 : 0.6
      }
      run()
    }

    onApi({
      setMood(i) {
        const md = MOODS[i]
        if (!md) return
        target.mood = i
        target.speed = md.speed
        // Während 5-4-3-2-1 bleibt die Ziffer in Ton; die Stimmung gilt wieder, sobald die Kugel zurück ist.
        if (uniforms.uToS.value < 0.5) return
        target.amp = md.amp
        target.color.set(cssColor(md.token))
      },
      pulse() {
        if (!reduce) uniforms.uPulse.value = 1
      },
      breathe(tick, end) {
        if (soundRef.current) {
          audio ??= new AudioContext()
          void audio.resume()
        }
        breath.on = true
        breath.phase = ''
        breath.start = performance.now()
        breath.tick = tick
        breath.end = end
        run()
      },
      stopBreath() {
        stopBreath(false)
      },
      ground(n, dir) {
        void startMorph(n, dir)
      },
      prepareGround() {
        void (async () => {
          for (const d of ['5', '4', '3', '2', '1']) await glyphPoints(d, N)
        })()
      },
    })

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
      void audio?.close()
    }
    // Die Kugel wird genau einmal aufgebaut; Stimmung und Ton laufen über die API bzw. Refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion])

  return <div ref={el} className="orb" aria-hidden="true" />
}
