"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { GridGroup, Period } from "@/lib/engine";
import { fmt, money } from "@/lib/format";
import { Flag } from "./Flag";

// Same thresholds as recRows: ROI under STOP stops, over GROW scales, in between fixes; under minSpend is too early to judge.
const STOP = 0.3, GROW = 1;
const minSpendOf = (p: Period) => (p.cadence === "Daily" ? 300 : 1500);

type Dot = { name: string; roi: number; spend: number; funded: number; zone: "stop" | "fix" | "grow" | "early"; x: number; y: number; r: number };
type Label = { x: number; y: number; w: number; h: number; lead: boolean };
const LW = 6.1, LH = 13, GAP = 3, STEP = 15;

/** Places every name below its bubble, or above / further away with a leader line when it would overlap another name or bubble. */
function placeLabels(dots: Dot[], W: number, H: number): Label[] {
  const px = dots.map((d) => ({ cx: (d.x / 100) * W, cy: (d.y / 100) * H, r: d.r }));
  const boxes: { x: number; y: number; w: number; h: number }[] = px.map((p) => ({ x: p.cx - p.r, y: p.cy - p.r, w: p.r * 2, h: p.r * 2 }));
  const hits = (b: { x: number; y: number; w: number; h: number }) => boxes.some((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
  const out: Label[] = [];
  // Bigger bubbles claim their spot first.
  const order = dots.map((_, i) => i).sort((a, b) => dots[b].r - dots[a].r);
  for (const i of order) {
    const p = px[i], w = dots[i].name.length * LW + 6;
    const cands: [number, number, boolean][] = [[p.cx, p.cy + p.r + GAP, false], [p.cx, p.cy - p.r - GAP - LH, false]];
    for (let k = 1; k <= 6; k++) cands.push([p.cx, p.cy + p.r + GAP + STEP * k, true], [p.cx, p.cy - p.r - GAP - LH - STEP * k, true]);
    let pick = cands[0];
    for (const c of cands) {
      const x = Math.min(Math.max(c[0] - w / 2, 0), W - w);
      const b = { x, y: c[1], w, h: LH };
      if (b.y < 0 || b.y + LH > H) continue;
      if (!hits(b)) { pick = [x + w / 2, c[1], c[2]]; break; }
    }
    const x = Math.min(Math.max(pick[0] - w / 2, 0), W - w);
    const lab = { x, y: pick[1], w, h: LH, lead: pick[2] };
    out[i] = lab; boxes.push(lab);
  }
  return out;
}

/** Spend vs return map: spend across, ROI up. One bubble per market; horizontal bands follow the stop / fix / scale rules; bubble size = funded accounts. */
export function Quadrant({ groups, period, height = 340 }: { groups: GridGroup[]; period: Period; height?: number }) {
  const minSpend = minSpendOf(period);
  const mk = groups.filter((g) => !g.tot && g.name !== "Other" && g.act.Spend > 0);
  // Log axes. Markets with no return at all sit in a "no return" lane along the bottom (ROI under LANE), spread out so they do not pile up.
  const LANE = 0.1;
  const Y0 = 0.01, Y1 = Math.max(10, ...mk.map((g) => g.act.ROI)) * 1.6;
  const X0 = minSpend / 2.5, X1 = Math.max(minSpend * 4, ...mk.map((g) => g.act.Spend)) * 1.5;
  const lx = (v: number) => (Math.log10(Math.max(v, X0)) - Math.log10(X0)) / (Math.log10(X1) - Math.log10(X0));
  const ly = (v: number) => 1 - (Math.log10(Math.max(v, Y0)) - Math.log10(Y0)) / (Math.log10(Y1) - Math.log10(Y0));
  const maxF = Math.max(1, ...mk.map((g) => g.act.FundedAccounts));
  const laneTop = ly(LANE) * 100;
  const ys = ly(STOP) * 100, yg = ly(GROW) * 100, xe = lx(minSpend) * 100;
  const zeros = mk.filter((g) => g.act.ROI < LANE).sort((a, b) => b.act.Spend - a.act.Spend);
  const dots: Dot[] = mk.map((g) => {
    const a = g.act;
    const zone: Dot["zone"] = a.Spend < minSpend ? "early" : a.FundedAccounts === 0 || a.ROI < STOP ? "stop" : a.ROI >= GROW ? "grow" : "fix";
    const zi = zeros.indexOf(g);
    // Lane dots: evenly spaced across the lane in spend order (biggest spend right), so equal spends do not stack.
    const x = zi >= 0 ? xe + ((zeros.length - zi - 0.5) / zeros.length) * (100 - xe) : lx(a.Spend) * 100;
    const y = zi >= 0 ? (laneTop + 100) / 2 : ly(a.ROI) * 100;
    return { name: g.name, roi: a.ROI, spend: a.Spend, funded: a.FundedAccounts, zone, x, y, r: 14 + Math.sqrt(a.FundedAccounts / maxF) * 22 };
  });
  const yt = [0.3, 1, 3, 10, 30].filter((v) => v <= Y1);
  const xt = [300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000].filter((v) => v >= X0 && v <= X1);

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

  return (
    <div className="quad">
      <div className="quad-plot" style={{ height }} ref={plot}>
        <div className="quad-zone z-grow" style={{ top: 0, height: yg + "%" }}><span>Scale</span></div>
        <div className="quad-zone z-fix" style={{ top: yg + "%", height: ys - yg + "%" }}><span>Fix</span></div>
        <div className="quad-zone z-stop" style={{ top: ys + "%", height: 100 - ys + "%" }}><span>Stop</span></div>
        <div className="quad-lane" style={{ top: laneTop + "%" }}><span>No return</span></div>
        <div className="quad-early" style={{ width: xe + "%" }}><span>Too little spend to judge (under {money(minSpend)})</span></div>
        <div className="quad-yt" style={{ top: (laneTop + 100) / 2 + "%" }}>0</div>
        {yt.map((v) => <div key={v} className="quad-yt" style={{ top: ly(v) * 100 + "%" }}>{fmt(v, "pct")}</div>)}
        {xt.map((v) => <div key={v} className="quad-xt" style={{ left: lx(v) * 100 + "%" }}>{money(v)}</div>)}
        {W > 0 && (
          <svg className="quad-leads" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            {dots.map((d, i) => {
              const l = labels[i]; if (!l?.lead) return null;
              const cx = (d.x / 100) * W, cy = (d.y / 100) * H, below = l.y > cy;
              return <line key={d.name} x1={cx} y1={cy + (below ? d.r : -d.r)} x2={l.x + l.w / 2} y2={below ? l.y : l.y + l.h} />;
            })}
          </svg>
        )}
        {dots.map((d) => (
          <div key={d.name} className={"quad-dot z-" + d.zone + (d.funded === 0 ? " nofund" : "")} style={{ left: d.x + "%", top: d.y + "%", width: d.r * 2, height: d.r * 2 }} title={d.name + ": " + money(d.spend) + " spent, " + fmt(d.funded, "n") + " funded, ROI " + fmt(d.roi, "pct")}>
            <Flag country={d.name} />
          </div>
        ))}
        {dots.map((d, i) => labels[i] && (
          <label key={d.name} className={"quad-lab" + (labels[i].lead ? " lead" : "")} style={{ left: labels[i].x, top: labels[i].y, width: labels[i].w }}>{d.name}</label>
        ))}
      </div>
      <div className="quad-axes"><span>Across: spend (log scale)</span><span>Up: deposits as % of spend (log scale)</span><span>Bubble: funded accounts (dashed = none)</span></div>
    </div>
  );
}
