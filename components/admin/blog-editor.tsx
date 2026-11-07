"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { deleteBlogPost, saveBlogPost } from "@/app/admin/blog/actions";
import { RichText } from "@/components/blog/rich-text";
import { askConfirm } from "@/components/confirm";
import { BLOG_CATEGORIES, readingMinutes, slugify } from "@/lib/blog-text";
import { toast } from "@/lib/client/bus";

export type EditorPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  locale: string;
  category: string;
  status: "draft" | "published";
  cover: { id: string; width: number; height: number } | null;
  coverAlt: string;
};

const LANGS = [
  ["de", "Deutsch"],
  ["fr", "Französisch"],
  ["it", "Italienisch"],
  ["en", "Englisch"],
] as const;
const CATS: Record<string, string> = {
  news: "Neuigkeiten",
  knowledge: "Wissen",
  stories: "Erfahrungen",
};

const HELP: [string, string][] = [
  ["## Zwischentitel", "grosser Zwischentitel"],
  ["### Kleiner Titel", "kleiner Zwischentitel"],
  ["- Punkt", "Liste (eine Zeile pro Punkt)"],
  ["1. Schritt", "nummerierte Liste"],
  ["> Zitat", "hervorgehobenes Zitat"],
  ["**fett**  *kursiv*", "Betonung"],
  ["[Text](https://…)", "Link (nur https)"],
];

/**
 * Blogbeitrag schreiben: Titel, Adresse (aus dem Titel, solange nicht selbst geändert), Sprache, Thema, Titelbild,
 * Kurzbeschreibung und Text mit Vorschau. Speichert als Entwurf oder veröffentlicht. Ein neuer Beitrag öffnet nach
 * dem ersten Speichern seine Bearbeiten-Seite.
 */
export function BlogEditor({ post }: { post: EditorPost | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [locale, setLocale] = useState(post?.locale ?? "de");
  const [category, setCategory] = useState(post?.category ?? "news");
  const [status, setStatus] = useState<"draft" | "published">(
    post?.status ?? "draft",
  );
  const [cover, setCover] = useState(post?.cover ?? null);
  const [coverAlt, setCoverAlt] = useState(post?.coverAlt ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [error, setError] = useState<{ text: string; field?: string } | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const effectiveSlug = slugTouched ? slug : slugify(title);
  const minutes = useMemo(() => readingMinutes(body), [body]);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/admin/blog-media", {
        method: "POST",
        body: form,
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        width?: number;
        height?: number;
        error?: string;
      };
      if (!res.ok || !json.id)
        return setError({
          text: json.error ?? "Das Hochladen hat nicht geklappt.",
          field: "cover",
        });
      setCover({ id: json.id, width: json.width!, height: json.height! });
    } catch {
      setError({
        text: "Keine Verbindung. Bitte noch einmal versuchen.",
        field: "cover",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function save(nextStatus: "draft" | "published") {
    setError(null);
    start(async () => {
      const res = await saveBlogPost({
        id: post?.id ?? "",
        title,
        slug: effectiveSlug,
        excerpt,
        body,
        locale,
        category,
        status: nextStatus,
        coverId: cover?.id ?? "",
        coverAlt,
      }).catch(() => ({
        ok: false as const,
        error: "Das hat nicht geklappt. Bitte noch einmal versuchen.",
        field: undefined,
      }));
      if (!res.ok) return setError({ text: res.error, field: res.field });
      toast(res.message);
      if (!post) {
        // Next hält «Neuer Beitrag» versteckt im Hintergrund (React Activity): leeren, sonst stünde beim nächsten
        // Klick auf «Neuer Beitrag» noch dieser Text da. Weiter geht es auf der Bearbeiten-Seite.
        setTitle("");
        setSlug("");
        setSlugTouched(false);
        setExcerpt("");
        setBody("");
        setCover(null);
        setCoverAlt("");
        setStatus("draft");
        setTab("write");
        router.replace(`/admin/blog/${res.id}`);
        return;
      }
      setStatus(nextStatus);
      setSlug(res.slug);
      setSlugTouched(true);
    });
  }

  async function remove() {
    if (!post) return;
    if (
      !(await askConfirm(
        `Beitrag «${post.title}» endgültig löschen? Er verschwindet sofort aus dem Blog.`,
        "Löschen",
      ))
    )
      return;
    start(async () => {
      const res = await deleteBlogPost(post.id).catch(() => ({
        ok: false as const,
        error: "Das hat nicht geklappt.",
        field: undefined,
      }));
      if (!res.ok) return setError({ text: res.error });
      toast(res.message);
      router.replace("/admin/blog");
    });
  }

  const invalid = (field: string) =>
    error?.field === field
      ? { "aria-invalid": true as const, "aria-describedby": "blog-error" }
      : {};

  return (
    <div className="blog-editor" aria-busy={pending || undefined}>
      <div className="blog-editor-main">
        <label className="be-field">
          <span className="field-label">Titel</span>
          <input
            className="input be-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            placeholder="Worum geht es?"
            {...invalid("title")}
          />
        </label>
        <label className="be-field">
          <span className="field-label">Adresse</span>
          <span className="be-slug">
            <span className="fine">jiaia.app/blog/</span>
            <input
              className="input"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                );
              }}
              maxLength={80}
              aria-label="Adresse des Beitrags"
              {...invalid("slug")}
            />
          </span>
        </label>
        <label className="be-field">
          <span className="field-label">Kurzbeschreibung</span>
          <textarea
            className="input"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            maxLength={320}
            rows={3}
            placeholder="Ein, zwei Sätze – erscheinen in der Übersicht und unter dem Titel."
            {...invalid("excerpt")}
          />
          <span className="fine be-count">{excerpt.length} / 320</span>
        </label>

        <div className="be-field">
          <div className="be-tabs" role="tablist" aria-label="Text">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "write"}
              onClick={() => setTab("write")}
            >
              Schreiben
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "preview"}
              onClick={() => setTab("preview")}
            >
              Vorschau
            </button>
            <span className="fine">
              {body.trim()
                ? `${body.trim().split(/\s+/).length} Wörter · ${minutes} Min. Lesezeit`
                : ""}
            </span>
          </div>
          {tab === "write" ? (
            <textarea
              className="input be-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={40_000}
              rows={22}
              aria-label="Text des Beitrags"
              {...invalid("body")}
            />
          ) : (
            <div className="be-preview blog-article-body">
              {body.trim() ? (
                <RichText source={body} />
              ) : (
                <p className="fine">Noch kein Text.</p>
              )}
            </div>
          )}
          <details className="be-help">
            <summary className="fine">Formatierung</summary>
            <dl>
              {HELP.map(([code, what]) => (
                <div key={code}>
                  <dt>
                    <code>{code}</code>
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
            <p className="fine">Leere Zeile = neuer Absatz.</p>
          </details>
        </div>
      </div>

      <aside className="blog-editor-side">
        <section className="card be-card" aria-label="Veröffentlichen">
          <p className="be-status">
            <span className={`be-dot ${status}`} aria-hidden="true" />
            {status === "published" ? "Veröffentlicht" : "Entwurf"}
          </p>
          <div className="be-actions">
            <button
              type="button"
              className="btn"
              disabled={pending || uploading}
              onClick={() => save("published")}
            >
              {status === "published" ? "Aktualisieren" : "Veröffentlichen"}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={pending || uploading}
              onClick={() => save("draft")}
            >
              {status === "published"
                ? "Zurück zum Entwurf"
                : "Als Entwurf speichern"}
            </button>
          </div>
          {post && (
            <p className="fine">
              <Link
                href={`/blog/${post.slug}${status === "published" ? "" : "?vorschau=1"}`}
                target="_blank"
              >
                {status === "published"
                  ? "Im Blog ansehen"
                  : "Vorschau im Blog"}
              </Link>
            </p>
          )}
          {error && (
            <p className="error" role="alert" id="blog-error">
              {error.text}
            </p>
          )}
        </section>

        <section className="card be-card" aria-label="Einordnung">
          <label className="be-field">
            <span className="field-label">Sprache</span>
            <select
              className="input"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
            >
              {LANGS.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="be-field">
            <span className="field-label">Thema</span>
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {BLOG_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATS[c]}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="card be-card" aria-label="Titelbild">
          <span className="field-label">Titelbild</span>
          {cover ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="be-cover"
                src={`/api/blog-image/${cover.id}?w=640`}
                alt=""
                width={cover.width}
                height={cover.height}
              />
              <label className="be-field">
                <span className="field-label">Bildbeschreibung</span>
                <input
                  className="input"
                  value={coverAlt}
                  onChange={(e) => setCoverAlt(e.target.value)}
                  maxLength={200}
                  placeholder="Was ist zu sehen?"
                  {...invalid("coverAlt")}
                />
              </label>
            </>
          ) : (
            <p className="fine">
              Optional. Querformat wirkt am besten (z. B. 1600 × 1000 px).
              Metadaten wie Standort werden entfernt.
            </p>
          )}
          <div className="row-actions">
            <label
              className={`btn ghost small be-upload${uploading ? " busy" : ""}`}
            >
              {uploading
                ? "Lädt hoch …"
                : cover
                  ? "Anderes Bild"
                  : "Bild hochladen"}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
              />
            </label>
            {cover && (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setCover(null)}
              >
                Bild entfernen
              </button>
            )}
          </div>
        </section>

        {post && (
          <button
            type="button"
            className="btn ghost small be-delete"
            disabled={pending}
            onClick={remove}
          >
            Beitrag löschen
          </button>
        )}
      </aside>
    </div>
  );
}
