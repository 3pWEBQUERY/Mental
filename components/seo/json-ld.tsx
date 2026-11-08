import { headers } from 'next/headers'

/**
 * Strukturierte Daten (schema.org) für Suchmaschinen. `<` wird maskiert, damit kein Text das Script beenden kann;
 * die Nonce der Seite steht dabei, falls ein Browser auch Datenblöcke der CSP unterwirft.
 */
export async function JsonLd({ data }: { data: Record<string, unknown> }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}
