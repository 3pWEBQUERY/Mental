import { describe, expect, it } from "vitest";
import {
  parseBlocks,
  parseInline,
  readingMinutes,
  safeHref,
  slugify,
} from "@/lib/blog-text";

describe("Blog: Adresse, Text und Links", () => {
  it("macht aus dem Titel eine saubere Adresse", () => {
    expect(slugify("Über Ängste reden – und zuhören!")).toBe(
      "ueber-aengste-reden-und-zuhoeren",
    );
    expect(slugify("  Ça va? Été 2026  ")).toBe("ca-va-ete-2026");
  });

  it("erkennt Zwischentitel, Listen, Zitate und Absätze", () => {
    const blocks = parseBlocks(
      "## Titel\n\nErster Absatz\nzweite Zeile\n\n- eins\n- zwei\n\n1. a\n2. b\n\n> Zitat\n> weiter",
    );
    expect(blocks.map((b) => b.t)).toEqual(["h2", "p", "ul", "ol", "quote"]);
    expect(blocks[1]).toEqual({
      t: "p",
      c: [{ t: "text", v: "Erster Absatz zweite Zeile" }],
    });
    expect(blocks[2]).toMatchObject({
      items: [[{ v: "eins" }], [{ v: "zwei" }]],
    });
  });

  it("erlaubt nur sichere Links – kein javascript:, kein http", () => {
    expect(safeHref("https://143.ch")).toBe("https://143.ch/");
    expect(safeHref("/hilfe")).toBe("/hilfe");
    expect(safeHref("tel:143")).toBe("tel:143");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("http://example.com")).toBeNull();
    expect(safeHref("//evil.com")).toBeNull();
    // Unsicherer Link bleibt einfach Text.
    expect(parseInline("[klick](javascript:alert(1))")).toEqual([
      { t: "text", v: "[klick](javascript:alert(1))" },
    ]);
    expect(parseInline("**fett** und *kursiv* mit [Hilfe](/hilfe)")).toEqual([
      { t: "b", c: [{ t: "text", v: "fett" }] },
      { t: "text", v: " und " },
      { t: "i", c: [{ t: "text", v: "kursiv" }] },
      { t: "text", v: " mit " },
      { t: "a", href: "/hilfe", c: [{ t: "text", v: "Hilfe" }] },
    ]);
  });

  it("schätzt die Lesezeit", () => {
    expect(readingMinutes("kurz")).toBe(1);
    expect(readingMinutes(Array(1000).fill("wort").join(" "))).toBe(5);
  });
});
