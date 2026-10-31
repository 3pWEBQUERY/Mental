import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Railway Storage Bucket (S3-kompatibel, privat). Variablen kommen als Railway-Referenzen
 * aus dem Credentials-Tab des Buckets: BUCKET, ACCESS_KEY_ID, SECRET_ACCESS_KEY, REGION, ENDPOINT.
 */
let client: S3Client | null = null

export function bucketConfigured() {
  return Boolean(process.env.BUCKET && process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY && process.env.ENDPOINT)
}

export function s3(): S3Client {
  client ??= new S3Client({
    region: process.env.REGION ?? 'auto',
    endpoint: process.env.ENDPOINT,
    forcePathStyle: process.env.BUCKET_PATH_STYLE === '1',
    credentials: { accessKeyId: process.env.ACCESS_KEY_ID!, secretAccessKey: process.env.SECRET_ACCESS_KEY! },
  })
  return client
}

const bucket = () => process.env.BUCKET!

/** Signierte PUT-URL: 5 Minuten, Content-Type und Grösse sind fest. */
export function presignUpload(key: string, contentType: string, size: number) {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: 300, signableHeaders: new Set(['content-type', 'content-length']) },
  )
}

/** Signierte GET-URL – ausgeliefert wird direkt aus dem Bucket (Bucket-Egress statt Service-Egress). */
export function presignDownload(key: string, expiresIn: number, opts: { contentType?: string; filename?: string } = {}) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentType: opts.contentType,
      ResponseContentDisposition: opts.filename ? `attachment; filename="${opts.filename}"` : 'inline',
    }),
    { expiresIn },
  )
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
  return res.Body!.transformToByteArray()
}

export async function putObject(key: string, body: Uint8Array | Buffer, contentType: string) {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }))
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
}

/** Alle Schlüssel unter einem Präfix (seitenweise). */
export async function listKeys(prefix: string): Promise<{ key: string; modified: Date | undefined }[]> {
  const out: { key: string; modified: Date | undefined }[] = []
  let token: string | undefined
  do {
    const res = await s3().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }))
    for (const o of res.Contents ?? []) if (o.Key) out.push({ key: o.Key, modified: o.LastModified })
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return out
}
