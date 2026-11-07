import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CoverImage, PostCard, PostMeta } from "@/components/blog/cards";
import { RichText } from "@/components/blog/rich-text";
import { Mark, PublicShell } from "@/components/ui";
import { SLUG } from "@/lib/blog-text";
import { canModerate } from "@/lib/server/admin";
import { getMorePosts, getPost } from "@/lib/server/blog";
import { getViewer } from "@/lib/server/session";
import { currentLocale, getMessages, LOCALE_TAG, m } from "@/messages";

export const instant = false;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ vorschau?: string }>;
};

/** Entwürfe sieht nur das Admin-Team – mit ?vorschau=1 aus dem Admin-Bereich. */
async function load({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!SLUG.test(slug)) return null;
  const preview = (await searchParams).vorschau === "1";
  const v = preview ? await getViewer() : null;
  return getPost(slug, Boolean(v && canModerate(v, "admin")));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const post = await load(props);
  if (!post) return { title: m.blog.title };
  return {
    title: post.title,
    description: post.excerpt,
    // Entwürfe nie in Suchmaschinen.
    robots:
      post.status === "published" ? undefined : { index: false, follow: false },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt,
      images: post.cover
        ? [{ url: `${post.cover.src}?w=1200`, alt: post.cover.alt }]
        : undefined,
    },
  };
}

export default async function BlogPostPage(props: Props) {
  await connection();
  const post = await load(props);
  if (!post) notFound();
  // Der Beitrag in seiner Sprache; Rahmen und Hinweise in der Sprache der lesenden Person.
  const t = m.blog;
  const own = getMessages(post.locale);
  const more = post.status === "published" ? await getMorePosts(post) : [];
  return (
    <PublicShell>
      <article className="blog-article" lang={LOCALE_TAG[post.locale]}>
        <Link href="/blog" className="blog-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          {t.back}
        </Link>
        {post.status !== "published" && (
          <p className="notice warn">{t.draft}</p>
        )}
        <header className="blog-article-head">
          <PostMeta post={post} t={own} />
          <h1 className="blog-article-title">{post.title}</h1>
          <p className="blog-article-lead">{post.excerpt}</p>
          <p className="blog-byline">
            <Mark className="blog-byline-mark" />
            {own.blog.byTeam}
          </p>
        </header>
        {post.cover && (
          <figure className="blog-article-cover">
            <CoverImage
              cover={post.cover}
              sizes="(min-width: 1100px) 1040px, 100vw"
              priority
            />
          </figure>
        )}
        <div className="blog-article-body">
          <RichText source={post.body} />
        </div>
        <aside
          className="blog-help"
          aria-labelledby="blog-help-title"
          lang={LOCALE_TAG[currentLocale()]}
        >
          <h2 id="blog-help-title">{t.helpTitle}</h2>
          <p>{t.helpText}</p>
          <Link className="btn small" href={m.help.href}>
            {t.helpLink}
          </Link>
        </aside>
      </article>
      {more.length > 0 && (
        <section className="blog blog-more" aria-labelledby="blog-more">
          <h2 id="blog-more" className="section-label">
            {t.moreTitle}
          </h2>
          <div className="blog-grid">
            {more.map((p) => (
              <PostCard key={p.id} post={p} t={own} />
            ))}
          </div>
        </section>
      )}
    </PublicShell>
  );
}
