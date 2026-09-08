"use client";

import { useEffect, useId, useRef, useState } from "react";

let inited = false;
async function lib() {
  const m = (await import("mermaid")).default;
  if (!inited) {
    m.initialize({
      // Same family for measuring and rendering, otherwise labels overflow their nodes.
      startOnLoad: false, securityLevel: "loose", theme: "base", fontFamily: "var(--font-inter), Inter, sans-serif",
      flowchart: { htmlLabels: true, curve: "basis", padding: 22, nodeSpacing: 34, rankSpacing: 44, useMaxWidth: true, wrappingWidth: 320 },
      themeVariables: { fontSize: "12px", primaryColor: "#f3f5f8", primaryBorderColor: "#cfd4dc", primaryTextColor: "#1a1d23", lineColor: "#9aa1ad" },
    });
    inited = true;
  }
  return m;
}

/** Renders a mermaid diagram client-side. */
export function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = "mm" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    lib()
      .then((m) => m.render(id, code))
      .then(({ svg, bindFunctions }) => {
        if (!live || !ref.current) return;
        ref.current.innerHTML = svg;
        bindFunctions?.(ref.current);
        setErr(null);
      })
      .catch((e: unknown) => { if (live) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [code, id]);

  if (err) return <pre className="mmerr">{err}</pre>;
  return <div className="mm" ref={ref} />;
}
