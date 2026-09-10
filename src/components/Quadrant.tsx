"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Derived, GridGroup, Period } from "@/lib/engine";
import { fmt, money, type Fmt } from "@/lib/format";
import { Flag } from "./Flag";

/** Which figure runs up the page. `dir` says which way is good: cost metrics want low, volume metrics want high. */
export type QuadMetric = { k: keyof Derived; l: string; f: Fmt; dir: "cost" | "vol" };
export const QUAD_METRICS: Record<string, QuadMetric> = {
  ROI: { k: "ROI", l: "deposits as % of spend", f: "pct", dir: "vol" },
  CPC: { k: "CPC", l: "CPC", f: "$2", dir: "cost" },
  CPL: { k: "CPL", l: "CPL", f: "$0", dir: "cost" },
  CPA: { k: "CPA", l: "CPA", f: "$0", dir: "cost" },
  CPFA: { k: "CPFA", l: "CPFA", f: "$0", dir: "cost" },
  AvgAccountSize: { k: "AvgAccountSize", l: "Avg account size", f: "$0", dir: "vol" },
  Redeposit: { k: "Redeposit", l: "Re-deposits", f: "$0", dir: "vol" },
};

// Zone edges as multiples of the benchmark. Volume: scale above it, stop under 0.3x. Cost: scale under it, stop above 3x.
const STOP_VOL = 0.3, STOP_COST = 3;
const minSpendOf = (p: Period) => (p.cadence === "Daily" ? 300 : 1500);

type Dot = { name: string; lbl: string; v: number; spend: number; funded: number; zone: "stop" | "fix" | "grow" | "early"; x: number; y: number; r: number };
type Label = { x: number; y: number; w: number; h: number; lead: boolean };
const LW = 6.1, LH = 15, GAP = 3, STEP = 17, FLAGW = 22; // label metrics: text width per character, line height, flag slot

/** Places every label near its dot: below, above, right or left first, then rings further out in eight directions with a leader line. Nothing overlaps a dot or another label. */
function placeLabels(dots: Dot[], W: number, H: number): Label[] {
  const px = dots.map((d) => ({ cx: (d.x / 100) * W, cy: (d.y / 100) * H, r: d.r }));
  const PAD = 2;
  const boxes: { x: number; y: number; w: number; h: number }[] = px.map((p) => ({ x: p.cx - p.r - PAD, y: p.cy - p.r - PAD, w: (p.r + PAD) * 2, h: (p.r + PAD) * 2 }));
  const hits = (b: { x: number; y: number; w: number; h: number }) => boxes.some((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
  const out: Label[] = [];
  // Dots in crowded spots go first, so they get the near positions and the loners take the long leads.
  const crowd = (i: number) => px.filter((q, j) => j !== i && Math.hypot(q.cx - px[i].cx, q.cy - px[i].cy) < 60).length;
  const order = dots.map((_, i) => i).sort((a, b) => crowd(b) - crowd(a));
  for (const i of order) {
    const p = px[i], w = dots[i].lbl.length * LW + 8 + FLAGW, h = LH;
    // Candidate centres: [x, y, needs a leader line]. Near ring first, then rings 1..8 steps out in eight directions.
    const cands: [number, number, boolean][] = [
      [p.cx, p.cy + p.r + GAP + h / 2, false], [p.cx, p.cy - p.r - GAP - h / 2, false],
      [p.cx + p.r + GAP + w / 2, p.cy, false], [p.cx - p.r - GAP - w / 2, p.cy, false],
    ];
    for (let k = 1; k <= 8; k++) {
      const d = p.r + GAP + STEP * k;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) cands.push([p.cx + dx * (d + (dx ? w / 2 : 0)), p.cy + dy * (d + (dy ? h / 2 : 0)), true]);
    }
    let pick: [number, number, boolean] | null = null;
    for (const c of cands) {
      const x = Math.min(Math.max(c[0] - w / 2, 0), W - w), y = c[1] - h / 2;
      if (y < 0 || y + h > H) continue;
      if (!hits({ x: x - PAD, y: y - PAD, w: w + PAD * 2, h: h + PAD * 2 })) { pick = [x + w / 2, c[1], c[2]]; break; }
    }
    if (!pick) pick = cands[0];
    const x = Math.min(Math.max(pick[0] - w / 2, 0), W - w), y = pick[1] - h / 2;
    const lab = { x, y, w, h, lead: pick[2] };
    out[i] = lab; boxes.push({ x: x - PAD, y: y - PAD, w: w + PAD * 2, h: h + PAD * 2 });
  }
  return out;
}

/** Log ticks 1, 2, 3, 5, 10, 20 ... inside [lo, hi]. */
function logTicks(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(Math.max(lo, 1e-6))); e <= Math.ceil(Math.log10(hi)); e++) for (const m of [1, 2, 3, 5]) { const v = m * 10 ** e; if (v >= lo && v <= hi) out.push(v); }
  return out;
}

type Props = {
  groups: GridGroup[]; period: Period; height?: number;
  /** Figure on the Y axis; ROI when omitted. */
  metric?: QuadMetric;
  /** Red dotted benchmark line; the plan total for the metric when omitted (100% for ROI). */
  bench?: number;
  /** Small multiple: smaller bubbles, fewer ticks. */
  compact?: boolean;
};

/** Spend vs one figure per market: spend across, the figure up. Bands follow the stop / fix / scale rules around the benchmark; bubble size = funded accounts. */
export function Quadrant({ groups, period, height = 340, metric = QUAD_METRICS.ROI, bench, compact }: Props) {
  const minSpend = minSpendOf(period);
  const cost = metric.dir === "cost";
  const mk = groups.filter((g) => !g.tot && g.name !== "Other" && g.act.Spend > 0);
  const tot = groups.find((g) => g.tot);
  // Benchmark: the caller's figure, else the plan total for the avenue, else the best market so the bands still draw.
  // Re-deposits are a per-market volume, so the benchmark is the median market plan rather than the avenue total.
  const planList = mk.map((g) => g.pl[metric.k]).filter((v) => v > 0).sort((a, b) => a - b);
  const planB = metric.k === "ROI" ? 1 : metric.k === "Redeposit" ? (planList[Math.floor(planList.length / 2)] ?? 0) : (tot?.pl[metric.k] ?? 0);
  const B = bench ?? (planB > 0 ? planB : Math.max(1, ...mk.map((g) => g.act[metric.k])));
  const val = (g: GridGroup) => g.act[metric.k];
  // Markets with no figure at all (no funded account, no re-deposit) sit in a lane along the bottom, spread out so they do not pile up.
  const zeros = mk.filter((g) => val(g) <= 0).sort((a, b) => b.act.Spend - a.act.Spend);
  const vals = mk.map(val).filter((v) => v > 0);
  const lo = Math.min(B * (cost ? 0.3 : STOP_VOL), ...vals), hi = Math.max(B * (cost ? STOP_COST : 3), ...vals);
  const Y0 = lo / 1.6, Y1 = hi * 1.6;
  const X0 = minSpend / 2.5, X1 = Math.max(minSpend * 4, ...mk.map((g) => g.act.Spend)) * 1.5;
  const lx = (v: number) => (Math.log10(Math.max(v, X0)) - Math.log10(X0)) / (Math.log10(X1) - Math.log10(X0));
  const ly = (v: number) => 1 - (Math.log10(Math.max(v, Y0)) - Math.log10(Y0)) / (Math.log10(Y1) - Math.log10(Y0));
  const LANE = zeros.length ? (compact ? 14 : 8) : 0; // % of height reserved for the "none" lane
  const yOf = (v: number) => ly(v) * (100 - LANE);
  // Zone edges: benchmark and the stop line.
  const yB = yOf(B), yS = yOf(cost ? B * STOP_COST : B * STOP_VOL);
  const zoneOf = (g: GridGroup): Dot["zone"] => {
    const v = val(g), a = g.act;
    if (a.Spend < minSpend) return "early";
    if (v <= 0) return "stop";
    if (cost) return v <= B ? "grow" : v <= B * STOP_COST ? "fix" : "stop";
    return v >= B ? "grow" : v >= B * STOP_VOL ? "fix" : "stop";
  };
  const dots: Dot[] = mk.filter((g) => val(g) > 0).map((g) => {
    const a = g.act, v = val(g), zi = zeros.indexOf(g);
    const x = lx(a.Spend) * 100;
    const y = zi >= 0 ? 100 - LANE / 2 : yOf(v);
    // Every market is the same small dot; the figure and the band carry the message.
    return { name: g.name, lbl: g.name + " (" + fmt(v, metric.f) + ")", v, spend: a.Spend, funded: a.FundedAccounts, zone: zoneOf(g), x, y, r: compact ? 4 : 5 };
  });
  const yt = logTicks(Y0, Y1).filter((v) => v >= lo / 1.2 && v <= hi * 1.2);
  const xt = logTicks(X0, X1).filter((v) => v >= 100);
  const fv = (v: number) => (metric.f === "$0" && v >= 1_000_000 ? "$" + (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m" : metric.f === "$0" && v >= 1000 ? "$" + Math.round(v / 1000) + "k" : fmt(v, metric.f));

  // Labels need pixels: measure the plot, then lay names out so none overlap.
  const plot = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  useLayoutEffect(() => {
    const el = plot.current; if (!el) return;
    const m = () => setSize([el.clientWidth, el.clientHeight]);
    m();
    const ro = new ResizeObserver(m); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [W, H] = size;
  const labels = W > 0 ? placeLabels(dots, W, H) : [];

  // Bands top to bottom. Cost: stop (dear) on top, scale (cheap) at the bottom. Volume: the reverse.
  const bands = cost
    ? [{ z: "stop", top: 0, h: yS }, { z: "fix", top: yS, h: yB - yS }, { z: "grow", top: yB, h: 100 - LANE - yB }]
    : [{ z: "grow", top: 0, h: yB }, { z: "fix", top: yB, h: yS - yB }, { z: "stop", top: yS, h: 100 - LANE - yS }];

  return (
    <div className={"quad" + (compact ? " compact" : "")}>
      {compact && <h4 className="quad-title">{metric.l}</h4>}
      <div className="quad-plot" style={{ height }} ref={plot}>
        {bands.map((b) => <div key={b.z} className={"quad-zone z-" + b.z} style={{ top: b.top + "%", height: b.h + "%" }}><span>{b.z === "grow" ? "Excellent performance" : b.z === "fix" ? "Average performance" : "Poor performance"}</span></div>)}
        {LANE > 0 && (
          <div className="quad-lane" style={{ top: 100 - LANE + "%" }}>
            <span>No data</span>
            <div className="quad-chips">{zeros.map((g) => <em key={g.name} title={g.name + ": " + money(g.act.Spend) + " spent, no " + metric.l}><Flag country={g.name} />{g.name}</em>)}</div>
          </div>
        )}
        <div className="quad-bench" style={{ top: yB + "%" }}><span>Benchmark {fv(B)}</span></div>
        {yt.map((v) => <div key={"gy" + v} className="quad-gy" style={{ top: yOf(v) + "%" }} />)}
        {xt.map((v) => <div key={"gx" + v} className="quad-gx" style={{ left: lx(v) * 100 + "%" }} />)}
        {LANE > 0 && <div className="quad-yt" style={{ top: 100 - LANE / 2 + "%" }}>0</div>}
        {yt.map((v) => <div key={v} className="quad-yt" style={{ top: yOf(v) + "%" }}>{fv(v)}</div>)}
        {xt.map((v) => <div key={v} className="quad-xt" style={{ left: lx(v) * 100 + "%" }}>{money(v)}</div>)}
        <div className="quad-ylab">{metric.l}</div>
        <div className="quad-xlab">spend</div>
        {W > 0 && (
          <svg className="quad-leads" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            {dots.map((d, i) => {
              const l = labels[i]; if (!l?.lead) return null;
              const cx = (d.x / 100) * W, cy = (d.y / 100) * H;
              // Line ends on the label box edge closest to the dot.
              const tx = Math.min(Math.max(cx, l.x), l.x + l.w), ty = Math.min(Math.max(cy, l.y), l.y + l.h);
              return <line key={d.name} x1={cx} y1={cy} x2={tx} y2={ty} />;
            })}
          </svg>
        )}
        {dots.map((d) => (
          <div key={d.name} className={"quad-dot z-" + d.zone} style={{ left: d.x + "%", top: d.y + "%", width: d.r * 2, height: d.r * 2 }} title={d.name + ": " + money(d.spend) + " spent, " + fmt(d.funded, "n") + " funded, " + metric.l + " " + fmt(d.v, metric.f)} />
        ))}
        {dots.map((d, i) => labels[i] && (
          <label key={d.name} className={"quad-lab" + (labels[i].lead ? " lead" : "")} style={{ left: labels[i].x, top: labels[i].y, width: labels[i].w }}><Flag country={d.name} />{d.lbl}</label>
        ))}
      </div>
      {!compact && <div className="quad-axes"><span>Across: spend (log scale)</span><span>Up: {metric.l} (log scale)</span><span>One dot per country</span><span className="quad-benchkey">Red dotted line: benchmark, the plan figure for the avenue</span></div>}
    </div>
  );
}
