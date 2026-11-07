import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { blogMedia, blogPosts } from '@/db/schema'
import { BlogEditor } from '@/components/admin/blog-editor'
import { isUuid } from '@/lib/id'
import { requireModerator } from '@/lib/server/admin'

export default async function EditBlogPost({ params }: { params: Promise<{ id: string }> }) {
  await requireModerator('admin')
  const { id } = await params
  if (!isUuid(id)) notFound()
  const [p] = await db
    .select({
      post: blogPosts,
      width: blogMedia.width,
      height: blogMedia.height,
    })
    .from(blogPosts)
    .leftJoin(blogMedia, eq(blogMedia.id, blogPosts.coverId))
    .where(eq(blogPosts.id, id))
  if (!p) notFound()
  const { post } = p
  return (
    <div className="stack">
      <Link href="/admin/blog" className="fine">
        ← Alle Beiträge
      </Link>
      <h1 className="page-title">Beitrag bearbeiten</h1>
      <BlogEditor
        // Nach dem Speichern liefert der Server den neuen Stand – der Editor fängt dann frisch an.
        key={post.updatedAt.toISOString()}
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          body: post.body,
          locale: post.locale,
          category: post.category,
          status: post.status === 'published' ? 'published' : 'draft',
          cover: post.coverId && p.width && p.height ? { id: post.coverId, width: p.width, height: p.height } : null,
          coverAlt: post.coverAlt ?? '',
        }}
      />
    </div>
  )
}
