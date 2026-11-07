import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, desc, eq, ne } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { blogMedia, blogPosts } from "@/db/schema";
import {
  isBlogCategory,
  readingMinutes,
  type BlogCategory,
} from "@/lib/blog-text";
import type { Locale } from "@/messages";

export type BlogCover = {
  src: string;
  width: number;
  height: number;
  alt: string;
};
export type BlogCard = {
  id: string;
  slug: string;
  locale: Locale;
  category: BlogCategory;
  title: string;
  excerpt: string;
  cover: BlogCover | null;
  publishedAt: string;
  minutes: number;
};
export type BlogArticle = BlogCard & {
  body: string;
  status: "draft" | "published";
  updatedAt: string;
};

const FALLBACK = { stale: 30, revalidate: 30, expire: 300 };

const cols = {
  id: blogPosts.id,
  slug: blogPosts.slug,
  locale: blogPosts.locale,
  category: blogPosts.category,
  title: blogPosts.title,
  excerpt: blogPosts.excerpt,
  body: blogPosts.body,
  status: blogPosts.status,
  coverAlt: blogPosts.coverAlt,
  publishedAt: blogPosts.publishedAt,
  updatedAt: blogPosts.updatedAt,
  createdAt: blogPosts.createdAt,
  coverId: blogMedia.id,
  width: blogMedia.width,
  height: blogMedia.height,
};
const query = () =>
  db
    .select(cols)
    .from(blogPosts)
    .leftJoin(blogMedia, eq(blogMedia.id, blogPosts.coverId));
type Row = Awaited<ReturnType<typeof query>>[number];

function toArticle(r: Row): BlogArticle {
  return {
    id: r.id,
    slug: r.slug,
    locale: r.locale as Locale,
    category: isBlogCategory(r.category) ? r.category : "news",
    title: r.title,
    excerpt: r.excerpt,
    body: r.body,
    status: r.status === "published" ? "published" : "draft",
    cover:
      r.coverId && r.width && r.height
        ? {
            src: `/api/blog-image/${r.coverId}`,
            width: r.width,
            height: r.height,
            alt: r.coverAlt ?? "",
          }
        : null,
    publishedAt: (r.publishedAt ?? r.createdAt).toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    minutes: readingMinutes(r.body),
  };
}

/** Veröffentlichte Beiträge (neueste zuerst), alle Sprachen – gefiltert wird beim Ausliefern. Admin-Änderungen gelten sofort (Tag «blog»). */
export async function getPublishedPosts(): Promise<BlogCard[]> {
  "use cache";
  cacheTag("blog");
  try {
    const rows = await query()
      .where(eq(blogPosts.status, "published"))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(200);
    cacheLife("hours");
    return rows.map((r) => {
      const {
        body: _body,
        status: _status,
        updatedAt: _u,
        ...card
      } = toArticle(r);
      return card;
    });
  } catch {
    cacheLife(FALLBACK);
    return [];
  }
}

/** Beiträge für eine Sprache; gibt es dort keine, die deutschen (mit lang-Attribut ausgeliefert). */
export async function getPostsFor(locale: Locale): Promise<BlogCard[]> {
  const all = await getPublishedPosts();
  const own = all.filter((p) => p.locale === locale);
  return own.length ? own : all.filter((p) => p.locale === "de");
}

/** Ein Beitrag nach Kurzname. Entwürfe nur, wenn `preview` (Admin) – sonst null. */
export async function getPost(
  slug: string,
  preview = false,
): Promise<BlogArticle | null> {
  if (preview) return loadPost(slug);
  const post = await loadPublished(slug);
  return post;
}

async function loadPublished(slug: string): Promise<BlogArticle | null> {
  "use cache";
  cacheTag("blog");
  try {
    const [row] = await query()
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published")))
      .limit(1);
    cacheLife("hours");
    return row ? toArticle(row) : null;
  } catch {
    cacheLife(FALLBACK);
    return null;
  }
}

/** Ohne Cache: Vorschau eines Entwurfs für das Admin-Team. */
async function loadPost(slug: string): Promise<BlogArticle | null> {
  const [row] = await query().where(eq(blogPosts.slug, slug)).limit(1);
  return row ? toArticle(row) : null;
}

/** Weitere Beiträge unter einem Artikel: gleiche Sprache, ohne den aktuellen. */
export async function getMorePosts(
  current: BlogArticle,
  n = 3,
): Promise<BlogCard[]> {
  const all = await getPublishedPosts();
  return all
    .filter((p) => p.id !== current.id && p.locale === current.locale)
    .slice(0, n);
}

/** Kurzname schon vergeben (ausser vom Beitrag selbst)? */
export async function slugTaken(slug: string, exceptId?: string) {
  const [row] = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(
      exceptId
        ? and(eq(blogPosts.slug, slug), ne(blogPosts.id, exceptId))
        : eq(blogPosts.slug, slug),
    )
    .limit(1);
  return Boolean(row);
}

export const COVER_MAX_BYTES = 8 * 1024 * 1024;
const FORMATS = new Set(["png", "jpeg", "webp", "avif", "heif", "gif"]);

/** Titelbild neu rechnen: WebP ohne Metadaten (auch kein GPS), höchstens 2000×1250 px, richtig gedreht. */
export async function processCover(input: Buffer) {
  const meta = await sharp(input, { limitInputPixels: 60_000_000 }).metadata();
  if (!meta.format || !FORMATS.has(meta.format)) throw new Error("format");
  const { data, info } = await sharp(input, {
    limitInputPixels: 60_000_000,
    animated: false,
  })
    .rotate()
    .resize({
      width: 2000,
      height: 1250,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, bytes: data.length };
}
