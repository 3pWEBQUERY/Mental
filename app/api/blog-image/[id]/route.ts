import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { blogMedia } from "@/db/schema";
import { isUuid } from "@/lib/id";

const WIDTHS = [640, 1200, 2000];

/**
 * Titelbild eines Blogbeitrags: öffentlich (auch für Entwürfe nur über die zufällige ID erreichbar). Der Inhalt einer
 * ID ändert sich nie (neues Bild = neue ID) – ein Jahr im Browser-Cache. ?w=640|1200|2000 liefert kleinere Fassungen.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return new Response(null, { status: 404 });
  const [row] = await db
    .select({ data: blogMedia.data, width: blogMedia.width })
    .from(blogMedia)
    .where(eq(blogMedia.id, id));
  if (!row)
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const asked = Number(new URL(request.url).searchParams.get("w"));
  const w = WIDTHS.includes(asked) && asked < row.width ? asked : null;
  const data = w
    ? await sharp(row.data)
        .resize({ width: w })
        .webp({ quality: 80 })
        .toBuffer()
    : row.data;
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
