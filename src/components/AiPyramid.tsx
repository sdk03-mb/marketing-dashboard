// AI recommendations as one pyramid: read from the bottom. Stop the waste, fix the funnel, hold, grow, then attack.
// Page 5 is the summary in phrases; one deep-dive page per level follows (text in src/content/aiDetail.ts).
import type { ReactNode } from "react";
import { AI_DETAIL } from "@/content/aiDetail";
import { ISO } from "@/lib/plan";

export type Level = { key: string; head: string; tag: string; what: string; why: string; how: string; svg: [string, string, string]; flags?: string[] };

export const LEVELS: Level[] = [
  { key: "attack", head: "ATTACK RIVALS", tag: "Exness, XM, IC Markets, Pepperstone, AvaTrade",
    what: "**All five bid on our name; we bid on none.**",
    why: "A switching trader **already has a funded account**.",
    how: "**Their brand terms and followers, one “Switch to a DFSA-regulated broker” page. $5k test, 30 days.**",
    svg: ["ATTACK RIVALS", "rivals’ clients", ""] },
  { key: "scale", head: "SCALE WINNERS", tag: "return above 200%",
    what: "**Seven winners from $159k to $232k.** UAE PPC $51k to $80k, Jordan Social $4k to $15k.",
    why: "**$22 back per $1 in UAE PPC.** $1.5m re-deposited across the seven.",
    how: "**+20% a week while return stays above 200%.**",
    svg: ["SCALE WINNERS", "", "return above 200%"], flags: ["UAE", "KSA", "Canada", "Australia", "Spain", "Jordan"] },
  { key: "hold", head: "HOLD BUDGET", tag: "return 30% to 200%",
    what: "**Five combinations, $55k, held flat.** Germany PPC, Turkey Social, Germany Social, Australia Social, Switzerland PPC.",
    why: "**Deposits coming, slowly.** Second month needed, not more budget.",
    how: "**Same budget 30 days; Sales calls every funded account for the second deposit.**",
    svg: ["HOLD BUDGET", "", "same budget, 30 days"], flags: ["Germany", "Turkey", "Australia", "Switzerland"] },
  { key: "fix", head: "FIX FUNDING", tag: "the leak is after the account opens",
    what: "**2,000 accounts opened, 95 funded.** Expected 26%, actual 4.8%.",
    why: "**No call in the first hour, one English page, no local payment.**",
    how: "**WhatsApp in 15 minutes, call in 48 hours, local page and payment in five countries.**",
    svg: ["FIX FUNDING", "2,000 accounts opened, 95 funded", "call, local page, local payment"] },
  { key: "stop", head: "STOP FUNDING", tag: "money in, nothing out",
    what: "**18 combinations, $119k, 0 funded, $0 deposited.** PPC in 9 countries, Social in 9.",
    why: "**A full month, no first deposit.** Pakistan: 1,068 leads, 0 funded.",
    how: "**Stop from Monday; $119k to the SCALE list.** Restart only after a $2,000 two-week test funds one account.",
    svg: ["STOP FUNDING", "", "$119k a month, 0 funded"], flags: ["Morocco", "Greece", "Poland", "Oman", "Sweden", "Norway", "Pakistan", "Turkey", "Kazakhstan", "Netherlands", "Switzerland", "Qatar"] },
];

// Pyramid geometry: 5 levels of equal height, apex on top, half-widths widening by 40 per level in a 400-wide box.
const PW = 400, LH = 140, HALF = [60, 100, 140, 180, 200];
const FW = 24, FH = 15; // flag cell width and height inside the pyramid
const BLUES = ["#b9dbf5", "#8cc3ee", "#5ba7e5", "#2e75b6", "#1f4e79"];

/** Renders **bold** markers as <b>. */
const rich = (t: string) => t.split("**").map((x, i) => (i % 2 ? <b key={i}>{x}</b> : x));

/** The pyramid. `focus` dims every other level and only prints level names, for the deep-dive pages. */
function PyramidSvg({ height, focus, gridRow }: { height: number; focus?: string; gridRow?: string }) {
  const H = LH * LEVELS.length, C = PW / 2, width = (PW * height) / H;
  return (
    <svg className="ap-svg" width={width} height={height} viewBox={`0 0 ${PW} ${H}`} style={gridRow ? { gridRow } : undefined} aria-hidden="true">
      {LEVELS.map((l, i) => {
        const y0 = i * LH, y1 = (i + 1) * LH, top = i === 0 ? 0 : HALF[i - 1], bot = HALF[i];
        const pts = i === 0 ? `${C},${y0} ${C + bot},${y1} ${C - bot},${y1}` : `${C - top},${y0} ${C + top},${y0} ${C + bot},${y1} ${C - bot},${y1}`;
        const ym = y0 + LH / 2, first = i === 0, dim = focus !== undefined && focus !== l.key;
        return (
          <g key={l.key} fill={i < 2 ? "#1f4e79" : "#fff"} textAnchor="middle" opacity={dim ? 0.28 : 1}>
            <polygon points={pts} fill={BLUES[i]} />
            {focus === undefined ? (
              <>
                <text x={C} y={first ? ym + 42 : ym + 2} fontSize={first ? 9 : 13} fontWeight={700} letterSpacing={first ? 0.5 : 1}>{l.svg[0]}</text>
                {l.svg[1] && <text x={C} y={first ? ym + 58 : ym + 22} fontSize={first ? 8.5 : 10}>{l.svg[1]}</text>}
                {l.flags && l.flags.map((c, k) => {
                  // Flags in rows of eight, centred under the level name.
                  const per = 8, n = l.flags!.length, row = Math.floor(k / per), col = k % per, inRow = Math.min(per, n - row * per);
                  const x = C - (inRow * FW) / 2 + col * FW + 1, y = ym + 10 + row * (FH + 4);
                  return <image key={c} href={`https://flagcdn.com/w40/${ISO[c]}.png`} x={x} y={y} width={FW - 2} height={FH} preserveAspectRatio="none" />;
                })}
                {l.svg[2] && <text x={C} y={l.flags ? ym + 12 + Math.ceil(l.flags.length / 8) * (FH + 4) + 12 : ym + 38} fontSize={10}>{l.svg[2]}</text>}
              </>
            ) : (
              <text x={C} y={first ? ym + 52 : ym + 6} fontSize={first ? 11 : 15} fontWeight={700} letterSpacing={1}>{l.head}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Page 5: pyramid on the left, one phrase row per level on the right. */
export function AiPyramid({ rowH = 170 }: { rowH?: number }) {
  const svgH = rowH * LEVELS.length, svgW = (PW * svgH) / (LH * LEVELS.length);
  return (
    <div className="ap" style={{ gridTemplateColumns: svgW + 30 + "px minmax(0, 1fr)", gridAutoRows: rowH }}>
      <PyramidSvg height={svgH} gridRow={`1 / ${LEVELS.length + 1}`} />
      {LEVELS.map((l, i) => (
        <div key={l.key} className="ap-lvl" style={{ gridRow: i + 1, borderColor: BLUES[i] }}>
          <h2>{l.head}<span>{l.tag}</span></h2>
          <p><b>What:</b> {rich(l.what)}</p>
          <p><b>Why:</b> {rich(l.why)}</p>
          <p><b>How:</b> {rich(l.how)}</p>
        </div>
      ))}
    </div>
  );
}

type Block = { kind: "h" | "ul" | "ol" | "p"; text?: string; items?: string[] };
function parse(src: string): Block[] {
  const out: Block[] = []; let cur: Block | null = null;
  for (const raw of src.split("\n")) {
    const l = raw.trim(); if (!l) { cur = null; continue; }
    if (l.startsWith("## ")) { out.push({ kind: "h", text: l.slice(3) }); cur = null; continue; }
    const li = l.match(/^- (.*)$/), oi = l.match(/^\d+\. (.*)$/);
    if (li || oi) {
      const kind = li ? "ul" : "ol";
      if (!cur || cur.kind !== kind) { cur = { kind, items: [] }; out.push(cur); }
      cur.items!.push((li ?? oi)![1]); continue;
    }
    out.push({ kind: "p", text: l }); cur = null;
  }
  return out;
}

type Section = { title: string; kind: "stats" | "list" | "why" | "rec" | "result" | "text"; blocks: Block[] };
function sections(blocks: Block[]): Section[] {
  const out: Section[] = [];
  for (const b of blocks) {
    if (b.kind === "h") {
      const t = b.text!.toLowerCase();
      const kind: Section["kind"] = t.startsWith("what we see") ? "stats" : t.startsWith("by ") || t.startsWith("where ") || t.startsWith("what each") ? "list" : t.startsWith("why") ? "why" : t.startsWith("we recommend") ? "rec" : t.startsWith("expected") ? "result" : "text";
      out.push({ title: b.text!, kind, blocks: [] });
    } else if (out.length) out[out.length - 1].blocks.push(b);
  }
  return out;
}
const items = (sec: Section) => sec.blocks.flatMap((b) => b.items ?? (b.text ? [b.text] : []));

/** Deep-dive page for one level: small pyramid with that level lit on the left; on the right every section as cards and boxes. */
export function AiDetail({ level }: { level: string }) {
  const i = LEVELS.findIndex((l) => l.key === level), l = LEVELS[i];
  const secs = sections(parse(AI_DETAIL[level] ?? ""));
  // Consecutive list sections sit side by side.
  const rows: Section[][] = [];
  for (const sec of secs) {
    const last = rows[rows.length - 1];
    if (sec.kind === "list" && last && last[0].kind === "list" && last.length < 2) last.push(sec); else rows.push([sec]);
  }
  const card = (sec: Section, k: number): ReactNode => {
    const xs = items(sec);
    if (sec.kind === "stats") return (
      <section key={k} className="apd-sec"><h3>{sec.title}</h3>
        <div className="apd-stats" style={{ gridTemplateColumns: `repeat(${xs.length}, minmax(0, 1fr))` }}>{xs.map((x, j) => <div key={j} className="apd-stat">{rich(x)}</div>)}</div>
      </section>);
    if (sec.kind === "why") return (
      <section key={k} className="apd-sec"><h3>{sec.title}</h3>
        <div className="apd-why" style={{ gridTemplateColumns: `repeat(${xs.length}, minmax(0, 1fr))` }}>{xs.map((x, j) => <div key={j} className="apd-whyc"><i>{j + 1}</i><span>{rich(x)}</span></div>)}</div>
      </section>);
    if (sec.kind === "rec") return (
      <section key={k} className="apd-sec"><h3>{sec.title}</h3>
        <div className="apd-rec" style={{ gridTemplateColumns: `repeat(${Math.min(xs.length, 3)}, minmax(0, 1fr))` }}>{xs.map((x, j) => <div key={j} className="apd-recc" style={{ borderColor: BLUES[i] }}><i>{j + 1}</i><span>{rich(x)}</span></div>)}</div>
      </section>);
    if (sec.kind === "result") return (
      <section key={k} className="apd-sec apd-result"><h3>{sec.title}</h3><ul>{xs.map((x, j) => <li key={j}>{rich(x)}</li>)}</ul></section>);
    return (
      <section key={k} className="apd-sec apd-list"><h3>{sec.title}</h3><ul>{xs.map((x, j) => <li key={j}>{rich(x)}</li>)}</ul></section>);
  };
  return (
    <div className="apd">
      <div className="apd-side">
        <PyramidSvg height={400} focus={level} />
        <div className="apd-focus" style={{ borderColor: BLUES[i] }}>
          <small>Level {LEVELS.length - i} of {LEVELS.length}, from the base</small>
          <b>{l.head}</b>
          <span>{l.tag}</span>
        </div>
      </div>
      <div className="apd-body">
        {rows.map((r, k) => r.length === 1 ? card(r[0], k) : <div key={k} className="apd-pair">{r.map((sec, j) => card(sec, j))}</div>)}
      </div>
    </div>
  );
}
