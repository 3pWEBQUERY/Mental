'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { BREATH, MOODS } from '@/lib/constants'

export type OrbApi = {
  setMood(i: number): void
  pulse(): void
  breathe(onTick: (phase: 'inhale' | 'hold' | 'exhale', secondsLeft: number) => void, onEnd: (finished: boolean) => void): void
  stopBreath(): void
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
attribute float aRand;
varying float vA;
void main(){
  vec3 base = position;
  float n  = snoise(base*1.3 + vec3(0.0, uTime*0.18, uTime*0.12));
  float n2 = snoise(base*3.2 - vec3(uTime*0.10));
  float rip = uPulse * 0.09 * sin(base.y*9.0 - uTime*5.0);
  vec3 p = base * (1.0 + n*uAmp + n2*uAmp*0.3 + uBreath + rip);
  p += base * aRand * 0.035;
  vec4 w  = modelMatrix * vec4(p, 1.0);
  vec4 mv = viewMatrix * w;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.4 + aRand*2.0) * uPR * (5.0 / -mv.z);
  vA = (0.25 + 0.75*smoothstep(-0.6, 0.8, n)) * (0.35 + 0.65*smoothstep(-1.4, 1.4, w.z));
}`

const FS = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c,c) > 0.25) discard;
  gl_FragColor = vec4(uColor, vA);
}`

function cssColor(token: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return v || '#1C1C1A'
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

    const startMood = initialMood ?? 2
    const startColor = new THREE.Color(cssColor(MOODS[startMood]!.token))
    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: MOODS[startMood]!.amp },
      uBreath: { value: 0 },
      uPulse: { value: 0 },
      uPR: { value: renderer.getPixelRatio() },
      uColor: { value: startColor.clone() },
    }
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false })
    const group = new THREE.Group()
    group.add(new THREE.Points(geo, mat))
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

    const target = { amp: MOODS[startMood]!.amp, speed: MOODS[startMood]!.speed, color: startColor.clone(), mood: startMood }
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

      spin += dt * 0.06 * target.speed * k
      rx += (my * 0.35 - rx) * 0.04
      ry += (mx * 0.5 - ry) * 0.04
      group.rotation.set(0.25 + rx, spin + ry, 0)
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
      target.color.set(cssColor(MOODS[target.mood]!.token))
      emberColor.set(cssColor('--clay'))
    }
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', recolor)
    const mo = new MutationObserver(recolor)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    onApi({
      setMood(i) {
        const md = MOODS[i]
        if (!md) return
        target.mood = i
        target.amp = md.amp
        target.speed = md.speed
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
