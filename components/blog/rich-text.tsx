import type { ReactNode } from "react";
import { parseBlocks, type Inline } from "@/lib/blog-text";

/** Inline-Auszeichnung als React-Elemente. Externe Links öffnen in einem neuen Fenster, ohne Referrer. */
function inline(nodes: Inline[], key = ""): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}${i}`;
    if (n.t === "text") return n.v;
    if (n.t === "b") return <strong key={k}>{inline(n.c, `${k}-`)}</strong>;
    if (n.t === "i") return <em key={k}>{inline(n.c, `${k}-`)}</em>;
    const external = /^https:/.test(n.href);
    return (
      <a
        key={k}
        href={n.href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {inline(n.c, `${k}-`)}
      </a>
    );
  });
}

/** Text eines Blogbeitrags (lib/blog-text.ts) – nie als HTML eingefügt. */
export function RichText({ source }: { source: string }) {
  return (
    <>
      {parseBlocks(source).map((b, i) => {
        if (b.t === "h2") return <h2 key={i}>{inline(b.c)}</h2>;
        if (b.t === "h3") return <h3 key={i}>{inline(b.c)}</h3>;
        if (b.t === "quote")
          return <blockquote key={i}>{inline(b.c)}</blockquote>;
        if ("items" in b) {
          const List = b.t;
          return (
            <List key={i}>
              {b.items.map((item, j) => (
                <li key={j}>{inline(item)}</li>
              ))}
            </List>
          );
        }
        return <p key={i}>{inline(b.c)}</p>;
      })}
    </>
  );
}
