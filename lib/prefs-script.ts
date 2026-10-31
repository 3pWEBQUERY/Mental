/**
 * Läuft vor dem ersten Paint und setzt Farbschema, Schriftgrösse und Animation aus dem lokalen Speicher –
 * und <html lang> auf Französisch, wenn das so gewählt ist (ausser auf den nur deutschen, vorgerenderten Seiten).
 * Ohne gespeicherte Wahl ist Lichtung hell.
 * Der Inhalt ist konstant; sein SHA-256-Hash steht in der Content Security Policy (proxy.ts).
 */
export const PREFS_KEY = 'lichtung-prefs'
export const PREFS_SCRIPT = `try{var p=JSON.parse(localStorage.getItem('${PREFS_KEY}')||'{}'),d=document.documentElement;if(p.theme&&p.theme!=='light')d.dataset.theme=p.theme;if(p.fontSize&&p.fontSize!=='normal')d.dataset.font=p.fontSize;if(p.motion&&p.motion!=='on')d.dataset.motion=p.motion;if(p.discreet)d.dataset.discreet='1'}catch(e){}try{var d=document.documentElement,pa=location.pathname.split('/')[1];if(pa==='aide'||(['hilfe','datenschutz','impressum','offline'].indexOf(pa)<0&&(' '+document.cookie+';').indexOf(' lichtung_lang=fr;')>=0))d.lang='fr-CH'}catch(e){}`

export type LocalPrefs = {
  theme?: 'system' | 'light' | 'dark'
  fontSize?: 'normal' | 'large' | 'xlarge'
  motion?: 'on' | 'reduced' | 'off'
  discreet?: boolean
}

export function readLocalPrefs(): LocalPrefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as LocalPrefs
  } catch {
    return {}
  }
}

export function applyLocalPrefs(p: LocalPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {}
  const d = document.documentElement
  // Hell ist Standard; «system» folgt dem Betriebssystem, «dark» ist immer dunkel.
  if (p.theme && p.theme !== 'light') d.dataset.theme = p.theme
  else delete d.dataset.theme
  if (p.fontSize && p.fontSize !== 'normal') d.dataset.font = p.fontSize
  else delete d.dataset.font
  if (p.motion && p.motion !== 'on') d.dataset.motion = p.motion
  else delete d.dataset.motion
  if (p.discreet) d.dataset.discreet = '1'
  else delete d.dataset.discreet
  window.dispatchEvent(new Event('lichtung:prefs'))
}
