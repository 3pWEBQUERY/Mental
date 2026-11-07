import { db } from "@/db";
import { blogMedia, moderationActions } from "@/db/schema";
import { canModerate, hasStrongAuth } from "@/lib/server/admin";
import { COVER_MAX_BYTES, processCover } from "@/lib/server/blog";
import { getViewer } from "@/lib/server/session";

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Titelbild hochladen (Admin → Blog). Route Handler statt Server-Aktion: Server-Aktionen sind auf 1 MB begrenzt.
 * Nur Admins mit Passkey-Sitzung, nur von der eigenen Seite. Gibt die ID zurück – zugewiesen wird beim Speichern.
 */
export async function POST(request: Request) {
  const v = await getViewer();
  if (!v || !canModerate(v, "admin") || !hasStrongAuth(v))
    return json(403, { error: "Nur für Admins mit Passkey." });
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  if (
    (site && site !== "same-origin") ||
    (origin !== null && !sameHost(origin, request.headers.get("host")))
  )
    return json(403, { error: "Nur von der eigenen Seite." });
  const length = Number(request.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(length) || length > COVER_MAX_BYTES + 64 * 1024)
    return json(413, { error: "Das Bild ist zu gross (höchstens 8 MB)." });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: "Keine Datei erhalten." });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return json(400, { error: "Bitte eine Bilddatei wählen." });
  if (file.size > COVER_MAX_BYTES)
    return json(413, { error: "Das Bild ist zu gross (höchstens 8 MB)." });
  let img: Awaited<ReturnType<typeof processCover>>;
  try {
    img = await processCover(Buffer.from(await file.arrayBuffer()));
  } catch {
    return json(415, {
      error:
        "Das Bild liess sich nicht lesen. Erlaubt: JPEG, PNG, WebP, AVIF, HEIC.",
    });
  }
  const [row] = await db
    .insert(blogMedia)
    .values({
      data: img.data,
      width: img.width,
      height: img.height,
      bytes: img.bytes,
    })
    .returning({ id: blogMedia.id });
  await db
    .insert(moderationActions)
    .values({
      moderatorId: v.userId,
      targetType: "user",
      targetId: v.userId,
      action: "blog-media:upload",
      reason: null,
    });
  return json(201, { id: row!.id, width: img.width, height: img.height });
}

/** Origin «null» oder unlesbar zählt als fremd. */
function sameHost(origin: string, host: string | null) {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
