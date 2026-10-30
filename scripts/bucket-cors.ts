/**
 * Setzt die CORS-Regel des Buckets: Browser-Uploads (PUT) nur von der eigenen Domain.
 * Läuft als Pre-Deploy-Befehl – idempotent, ohne Bucket-Konfiguration ein No-op.
 */
import { PutBucketCorsCommand } from '@aws-sdk/client-s3'
import { bucketConfigured, s3 } from '../lib/s3'

const origin = process.env.APP_URL
if (!bucketConfigured() || !origin) {
  console.log('Bucket-CORS übersprungen (kein Bucket oder keine APP_URL).')
} else {
  await s3().send(
    new PutBucketCorsCommand({
      Bucket: process.env.BUCKET!,
      CORSConfiguration: {
        CORSRules: [{ AllowedOrigins: [new URL(origin).origin], AllowedMethods: ['PUT'], AllowedHeaders: ['content-type', 'content-length'], MaxAgeSeconds: 3000 }],
      },
    }),
  )
  console.log(`Bucket-CORS gesetzt für ${new URL(origin).origin}.`)
}
