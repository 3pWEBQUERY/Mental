'use server'

import { and, eq, sql } from 'drizzle-orm'
import { refresh, updateTag } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { blogMedia, blogPosts, moderationActions } from '@/db/schema'
import { BLOG_CATEGORIES, SLUG, slugify } from '@/lib/blog-text'
import { assertModerator } from '@/lib/server/admin'
import { slugTaken } from '@/lib/server/blog'
import { LOCALES } from '@/messages'

export type BlogResult = { ok: true; message: string; id: string; slug: string } | { ok: false; error: string; field?: string }

const fail = (error: string, field?: string): BlogResult => ({
  ok: false,
  error,
  field,
})

const schema = z.object({
  id: z.uuid().optional().or(z.literal('')),
  title: z.string().trim().min(3).max(140),
  slug: z.string().trim().max(80).optional(),
  excerpt: z.string().trim().min(10).max(320),
  body: z.string().trim().min(20).max(40_000),
  locale: z.enum(LOCALES),
  category: z.enum(BLOG_CATEGORIES),
  status: z.enum(['draft', 'published']),
  coverId: z.uuid().optional().or(z.literal('')),
  coverAlt: z.string().trim().max(200).optional(),
})

async function audit(adminId: string, action: string, reason: string) {
  await db.insert(moderationActions).values({
    moderatorId: adminId,
    targetType: 'user',
    targetId: adminId,
    action,
    reason,
  })
}

/** Titelbilder ohne Beitrag (abgebrochene Uploads, ersetzte Bilder) nach einem Tag entfernen. */
async function sweepMedia() {
  await db.execute(
    sql`DELETE FROM blog_media m WHERE m.created_at < now() - interval '1 day' AND NOT EXISTS (SELECT 1 FROM blog_posts p WHERE p.cover_id = m.id)`,
  )
}

/** Beitrag anlegen oder ändern. Veröffentlicht erscheint er sofort (Tag «blog» auf allen Web-Replikas). */
export async function saveBlogPost(input: Record<string, string>): Promise<BlogResult> {
  const admin = await assertModerator('admin')
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? '')
    const why: Record<string, string> = {
      title: 'Titel: 3 bis 140 Zeichen.',
      excerpt: 'Kurzbeschreibung: 10 bis 320 Zeichen.',
      body: 'Text: mindestens 20 Zeichen.',
    }
    return fail(why[field] ?? 'Bitte die Felder prüfen – etwas fehlt oder ist zu lang.', field)
  }
  const d = parsed.data
  const slug = slugify(d.slug || d.title)
  if (!SLUG.test(slug)) return fail('Adresse: nur a–z, 0–9 und Bindestriche.', 'slug')
  if (await slugTaken(slug, d.id || undefined)) return fail(`Die Adresse «${slug}» hat schon ein anderer Beitrag.`, 'slug')
  if (d.coverId) {
    const [media] = await db.select({ id: blogMedia.id }).from(blogMedia).where(eq(blogMedia.id, d.coverId))
    if (!media) return fail('Dieses Titelbild gibt es nicht mehr – bitte neu hochladen.', 'cover')
    if (!d.coverAlt) return fail('Bitte das Titelbild kurz beschreiben (für Screenreader).', 'coverAlt')
  }
  const values = {
    slug,
    title: d.title,
    excerpt: d.excerpt,
    body: d.body,
    locale: d.locale,
    category: d.category,
    status: d.status,
    coverId: d.coverId || null,
    coverAlt: d.coverId ? d.coverAlt || null : null,
    updatedAt: new Date(),
  }
  let id = d.id || ''
  if (id) {
    // Erstes Veröffentlichen setzt das Datum; spätere Änderungen lassen es stehen.
    const [row] = await db
      .update(blogPosts)
      .set({
        ...values,
        publishedAt: d.status === 'published' ? sql`coalesce(${blogPosts.publishedAt}, now())` : blogPosts.publishedAt,
      })
      .where(eq(blogPosts.id, id))
      .returning({ id: blogPosts.id })
    if (!row) return fail('Diesen Beitrag gibt es nicht mehr.')
  } else {
    const [row] = await db
      .insert(blogPosts)
      .values({
        ...values,
        publishedAt: d.status === 'published' ? new Date() : null,
      })
      .returning({ id: blogPosts.id })
    id = row!.id
  }
  await audit(admin.userId, d.id ? 'blog:update' : 'blog:create', d.title)
  await sweepMedia().catch(() => {})
  updateTag('blog')
  refresh()
  return {
    ok: true,
    id,
    slug,
    message: d.status === 'published' ? `«${d.title}» ist veröffentlicht.` : `«${d.title}» als Entwurf gespeichert.`,
  }
}

/** Beitrag löschen – sofort weg aus Blog und Startseite; sein Titelbild mit. */
export async function deleteBlogPost(id: string): Promise<BlogResult> {
  const admin = await assertModerator('admin')
  if (!z.uuid().safeParse(id).success) return fail('Diesen Beitrag gibt es nicht mehr.')
  const [row] = await db.delete(blogPosts).where(eq(blogPosts.id, id)).returning({
    title: blogPosts.title,
    slug: blogPosts.slug,
    coverId: blogPosts.coverId,
  })
  if (!row) return fail('Diesen Beitrag gibt es nicht mehr.')
  if (row.coverId) {
    await db.delete(blogMedia).where(and(eq(blogMedia.id, row.coverId), sql`NOT EXISTS (SELECT 1 FROM blog_posts p WHERE p.cover_id = ${row.coverId})`))
  }
  await audit(admin.userId, 'blog:delete', row.title)
  updateTag('blog')
  refresh()
  return { ok: true, id, slug: row.slug, message: `«${row.title}» gelöscht.` }
}
