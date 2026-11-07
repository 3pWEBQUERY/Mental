import Link from "next/link";
import { BlogEditor } from "@/components/admin/blog-editor";
import { requireModerator } from "@/lib/server/admin";

export default async function NewBlogPost() {
  await requireModerator("admin");
  return (
    <div className="stack">
      <Link href="/admin/blog" className="fine">
        ← Alle Beiträge
      </Link>
      <h1 className="page-title">Neuer Beitrag</h1>
      <BlogEditor post={null} />
    </div>
  );
}
