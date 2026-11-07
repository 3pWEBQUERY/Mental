/**
 * Blogtexte: eine kleine, sichere Auszeichnung statt HTML. Das Admin-Team schreibt Absätze und
 *   ## Zwischentitel   ### kleiner Zwischentitel   - Liste   1. nummerierte Liste   > Zitat
 *   **fett**   *kursiv*   [Linktext](https://…)
 * Daraus werden React-Elemente (components/blog/rich-text.tsx) – nie rohes HTML, also kein Einschleusen von Skripten.
 */

export const BLOG_CATEGORIES = ["news", "knowledge", "stories"] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];
export const isBlogCategory = (x: unknown): x is BlogCategory =>
  BLOG_CATEGORIES.includes(x as BlogCategory);

export type Inline =
  | { t: "text"; v: string }
  | { t: "b"; c: Inline[] }
  | { t: "i"; c: Inline[] }
  | { t: "a"; href: string; c: Inline[] };
export type Block =
  | { t: "p"; c: Inline[] }
  | { t: "h2" | "h3"; c: Inline[] }
  | { t: "ul" | "ol"; items: Inline[][] }
  | { t: "quote"; c: Inline[] };

/** Kurzname für die Adresse: «Über Ängste reden» → «ueber-aengste-reden». */
export function slugify(input: string): string {
  return input
    .normalize("NFC")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Nur sichere Ziele: https, mailto, tel und Pfade auf dieser Seite. */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^\/(?!\/)[^\s]*$/.test(h)) return h;
  if (/^(mailto|tel):[^\s]+$/i.test(h)) return h;
  try {
    const u = new URL(h);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** **fett**, *kursiv*, [Link](ziel) – verschachtelt erlaubt, alles andere bleibt Text. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ t: "text", v: text });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("**", i)) {
      const end = src.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: "b", c: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (src[i] === "*" && src[i + 1] !== " ") {
      const end = src.indexOf("*", i + 1);
      if (end > i + 1 && src[end - 1] !== " ") {
        flush();
        out.push({ t: "i", c: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (src[i] === "[") {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(src.slice(i));
      const href = m ? safeHref(m[2]!) : null;
      if (m && href) {
        flush();
        out.push({ t: "a", href, c: parseInline(m[1]!) });
        i += m[0].length;
        continue;
      }
    }
    text += src[i];
    i++;
  }
  flush();
  return out;
}

/** Text in Blöcke. Leere Zeilen trennen Absätze; Zeilenumbrüche innerhalb eines Absatzes werden zu Leerzeichen. */
export function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ t: "p", c: parseInline(para.join(" ")) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) {
      flushPara();
      continue;
    }
    const h = /^(#{2,3})\s+(.+)$/.exec(line);
    if (h) {
      flushPara();
      blocks.push({
        t: h[1]!.length === 2 ? "h2" : "h3",
        c: parseInline(h[2]!),
      });
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const kind = bullet ? "ul" : "ol";
      const re = bullet ? /^[-*]\s+(.+)$/ : /^\d+[.)]\s+(.+)$/;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = re.exec(lines[i]!.trim());
        if (!m) break;
        items.push(parseInline(m[1]!));
        i++;
      }
      i--;
      blocks.push({ t: kind, items });
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushPara();
      const parts: string[] = [];
      while (i < lines.length) {
        const m = /^>\s?(.*)$/.exec(lines[i]!.trim());
        if (!m) break;
        parts.push(m[1]!);
        i++;
      }
      i--;
      blocks.push({ t: "quote", c: parseInline(parts.join(" ").trim()) });
      continue;
    }
    para.push(line);
  }
  flushPara();
  return blocks;
}

/** Lesezeit in Minuten (rund 200 Wörter pro Minute, mindestens 1). */
export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
