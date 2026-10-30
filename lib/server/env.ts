import 'server-only'

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Umgebungsvariable ${name} fehlt (siehe .env.example)`)
  return v
}

export const env = {
  get secret() {
    const s = required('SESSION_SECRET')
    if (s.length < 32) throw new Error('SESSION_SECRET muss mindestens 32 Zeichen lang sein')
    return s
  },
  get appUrl() {
    return process.env.APP_URL ?? 'http://localhost:3000'
  },
  get rpId() {
    return process.env.WEBAUTHN_RP_ID ?? new URL(this.appUrl).hostname
  },
  get isProd() {
    return process.env.NODE_ENV === 'production'
  },
  /** Nur ausserhalb von Produktion: Admin-Zugang auch ohne Passkey (für lokale Tests). */
  get adminWithoutPasskey() {
    return process.env.NODE_ENV !== 'production' && process.env.ADMIN_ALLOW_PASSWORD === '1'
  },
  /** Max. 3 neue Konten pro IP-Hash und Tag (für lokale Tests erhöhbar). */
  get registrationsPerIpPerDay() {
    return Number(process.env.REGISTRATIONS_PER_IP_PER_DAY ?? 3)
  },
  get hibpEnabled() {
    return process.env.HIBP_DISABLED !== '1'
  },
}
