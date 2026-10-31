'use client'

import { decode } from 'blurhash'
import { useEffect, useRef, useState } from 'react'
import type { PublicMedia } from '@/lib/dto'
import { m } from '@/messages'

/** Bild über eine kurzlebige, signierte URL. Bis es geladen ist: die BlurHash-Vorschau. */
export function PostImage({ media }: { media: PublicMedia }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)
  const ratio = media.width && media.height ? media.height / media.width : 0.75

  useEffect(() => {
    if (!media.blurhash || !canvas.current) return
    try {
      const px = decode(media.blurhash, 32, Math.max(8, Math.round(32 * ratio)))
      const ctx = canvas.current.getContext('2d')
      if (!ctx) return
      const img = ctx.createImageData(32, Math.max(8, Math.round(32 * ratio)))
      img.data.set(px)
      ctx.putImageData(img, 0, 0)
    } catch {}
  }, [media.blurhash, ratio])

  if (media.status !== 'ready') {
    return (
      <div className="post-image" style={{ aspectRatio: '4 / 3', maxWidth: 320 }}>
        <span className="state">{media.status === 'rejected' ? m.feed.imageRejected : m.feed.imagePending}</span>
      </div>
    )
  }
  return (
    <div className="post-image" style={{ aspectRatio: `${1 / ratio}` }}>
      {!loaded && media.blurhash && (
        <canvas ref={canvas} width={32} height={Math.max(8, Math.round(32 * ratio))} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/media/${media.id}`}
        alt={media.alt || m.feed.image}
        width={media.width ?? undefined}
        height={media.height ?? undefined}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        referrerPolicy="no-referrer"
      />
    </div>
  )
}
