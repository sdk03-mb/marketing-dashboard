"use client";

import { useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import world from "world-atlas/countries-110m.json";
import type { GridGroup } from "@/lib/engine";
import { fmt, money } from "@/lib/format";
import { ISO } from "@/lib/plan";

// Dashboard country names -> world-atlas names, plus a label nudge [dx, dy] in px for small or crowded countries.
const GEO: Record<string, { atlas: string; nudge?: [number, number] }> = {
  UAE: { atlas: "United Arab Emirates", nudge: [26, 14] }, KSA: { atlas: "Saudi Arabia" },
  Qatar: { atlas: "Qatar", nudge: [-4, 30] }, Oman: { atlas: "Oman", nudge: [6, 14] },
  Lebanon: { atlas: "Lebanon", nudge: [-36, -8] }, Jordan: { atlas: "Jordan", nudge: [4, 22] }, Syria: { atlas: "Syria", nudge: [8, -16] },
  Tunisia: { atlas: "Tunisia", nudge: [-8, 22] }, Morocco: { atlas: "Morocco" },
  Switzerland: { atlas: "Switzerland", nudge: [-34, 6] }, Spain: { atlas: "Spain" }, Germany: { atlas: "Germany", nudge: [6, -10] },
  Greece: { atlas: "Greece", nudge: [10, 20] }, Norway: { atlas: "Norway", nudge: [-14, 12] }, Sweden: { atlas: "Sweden", nudge: [10, 8] },
  Netherlands: { atlas: "Netherlands", nudge: [-38, -6] }, Poland: { atlas: "Poland", nudge: [4, -6] }, Turkey: { atlas: "Turkey" },
  Kazakhstan: { atlas: "Kazakhstan" }, Canada: { atlas: "Canada", nudge: [0, 20] }, Australia: { atlas: "Australia" },
  India: { atlas: "India" }, Pakistan: { atlas: "Pakistan", nudge: [-6, 4] },
};
const BY_ATLAS: Record<string, string> = {};
for (const [k, v] of Object.entries(GEO)) BY_ATLAS[v.atlas] = k;

type F = Feature<Geometry, { name: string }>;
let cached: F[] | null = null;
function features(): F[] {
  if (cached) return cached;
  const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
  cached = fc.features.filter((f) => f.properties.name !== "Antarctica");
  return cached;
}

// Colour scale 0 .. max ROI: red -> amber -> green.
const STOPS: [number, [number, number, number]][] = [[0, [220, 38, 38]], [0.5, [245, 158, 11]], [1, [22, 163, 74]]];
function ramp(t: number) {
  t = Math.max(0, Math.min(1, t));
  let a = STOPS[0], b = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) if (t >= STOPS[i][0] && t <= STOPS[i + 1][0]) { a = STOPS[i]; b = STOPS[i + 1]; break; }
  const u = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
  const c = a[1].map((x, i) => Math.round(x + (b[1][i] - x) * u));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const W = 1500, H = 720;
const LW = 204, LH = 34;            // label box size
const BAND_X = LW + 22, BAND_Y = LH + 26; // map inset so the four label bands stay clear of the map

/** World map (Natural Earth projection): markets filled by ROI on a colour scale, labels for the significant ones. */
/** `focus`: label only these markets (one continent per annexure page). `fit`: world-atlas names the map zooms to; defaults to the focus markets. */
export function WorldMap({ groups, focus, fit }: { groups: GridGroup[]; focus?: string[]; fit?: string[] }) {
  const { paths, labels } = useMemo(() => {
    const fs = features();
    const focusSet = focus ? new Set(focus) : null;
    const fitSet = fit ? new Set(fit) : null;
    const fitTo = fitSet ? fs.filter((f) => fitSet.has(f.properties.name)) : focusSet ? fs.filter((f) => focusSet.has(BY_ATLAS[f.properties.name] ?? "")) : fs;
    const proj = geoNaturalEarth1().fitExtent([[BAND_X, BAND_Y], [W - BAND_X, H - BAND_Y]], { type: "FeatureCollection", features: fitTo.length ? fitTo : fs });
    const path = geoPath(proj);
    const byName = new Map(groups.filter((g) => !g.tot).map((g) => [g.name, g]));
    const spent = [...byName.values()].filter((g) => g.act.Spend > 0);
    // Scale tops out at 300% so one outlier does not wash out the rest.
    const max = Math.min(300, Math.max(100, ...spent.map((g) => Math.round(g.act.ROI * 100))));
    const t = (g: GridGroup) => (g.act.ROI * 100) / max;
    const paths = fs.map((f) => {
      const name = BY_ATLAS[f.properties.name];
      const g = byName.get(name ?? "");
      const fill = g && g.act.Spend > 0 ? ramp(t(g)) : g ? "#d5dbe5" : "#eef1f5";
      // Hover text (native SVG title): works in the app and in an exported HTML file with no script.
      const tip = g
        ? name + " · " + (g.act.Spend > 0 ? money(g.act.Spend) + " spent · " + fmt(g.act.Leads, "n") + " leads · " + fmt(g.act.FundedAccounts, "n") + " funded · ROI " + fmt(g.act.ROI, "pct") : "planned " + money(g.pl.Spend) + ", no spend")
        : f.properties.name;
      return { key: f.properties.name, d: path(f) ?? "", fill, tip, market: !!g };
    });
    // Labels sit in four bands around the map (top, bottom, left, right), chosen by direction from the map centre,
    // spread evenly along each band, with a light leader line back to the country.
    type Side = "t" | "b" | "l" | "r";
    type L = { key: string; name: string; cx: number; cy: number; x: number; y: number; avg: string; fill: string; side: Side };
    // Only the significant markets get a label: the best payers (ROI at or above 100%) and the biggest
    // spenders with a poor return (ROI under 50%), so the bands never crowd.
    const all = fs.flatMap((f) => {
      const name = BY_ATLAS[f.properties.name]; const g = name ? byName.get(name) : undefined;
      if (!g || g.act.Spend <= 0 || (focusSet && !focusSet.has(name))) return [];
      const [cx, cy] = path.centroid(f);
      return [{ name, g, cx, cy }];
    });
    // A focused region labels every market; the world view labels only the significant ones.
    const pos = focusSet ? all : all.filter((x) => x.g.act.ROI >= 1).sort((a, b) => b.g.act.ROI - a.g.act.ROI).slice(0, 5);
    const neg = focusSet ? [] : all.filter((x) => x.g.act.ROI < 0.5).sort((a, b) => b.g.act.Spend - a.g.act.Spend).slice(0, 7);
    const cap: Record<Side, number> = { t: 5, b: 5, l: 10, r: 10 };
    const used: Record<Side, number> = { t: 0, b: 0, l: 0, r: 0 };
    const raw: Omit<L, "x" | "y">[] = [...pos, ...neg].map(({ name, g, cx, cy }) => {
      const dx = (cx - W / 2) / (W / 2), dy = (cy - H / 2) / (H / 2);
      // Preferred band by direction from the centre; fall through to the next band if that one is full.
      const order: Side[] = Math.abs(dx) > Math.abs(dy)
        ? [dx < 0 ? "l" : "r", dy < 0 ? "t" : "b", dy < 0 ? "b" : "t", dx < 0 ? "r" : "l"]
        : [dy < 0 ? "t" : "b", dx < 0 ? "l" : "r", dx < 0 ? "r" : "l", dy < 0 ? "b" : "t"];
      const side = order.find((s) => used[s] < cap[s]) ?? "b";
      used[side]++;
      return { key: name, name, cx, cy, side, avg: g.act.FundedAccounts > 0 ? money(g.act.CPFA) : "$0", fill: ramp(t(g)) };
    });
    const labels: L[] = [];
    const spread = (n: number, from: number, to: number, i: number) => (n <= 1 ? (from + to) / 2 : from + ((to - from) * i) / (n - 1));
    for (const side of ["t", "b", "l", "r"] as Side[]) {
      const band = raw.filter((r) => r.side === side).sort((a, b) => (side === "t" || side === "b" ? a.cx - b.cx : a.cy - b.cy));
      band.forEach((r, i) => {
        if (side === "t" || side === "b") labels.push({ ...r, x: spread(band.length, BAND_X + LW / 2, W - BAND_X - LW / 2, i), y: side === "t" ? LH / 2 + 4 : H - LH / 2 - 4 });
        else labels.push({ ...r, x: side === "l" ? LW / 2 + 4 : W - LW / 2 - 4, y: spread(band.length, BAND_Y + LH / 2, H - BAND_Y - LH / 2, i) });
      });
    }
    return { paths, labels };
  }, [groups, focus, fit]);

  // Any side with no labels gets its band cropped out, so the map draws as large as the space allows.
  const has = (side: "t" | "b" | "l" | "r") => labels.some((l) => l.side === side);
  const x0v = has("l") ? 0 : BAND_X - 30, x1v = has("r") ? W : W - BAND_X + 30;
  const y0v = has("t") ? 0 : BAND_Y - 20, y1v = has("b") ? H : H - BAND_Y + 20;
  return (
    <div className="rmap">
      <svg viewBox={`${x0v} ${y0v} ${x1v - x0v} ${y1v - y0v}`} width="100%" role="img" aria-label="World map coloured by return on spend">
        {paths.map((p) => <path key={p.key} d={p.d} fill={p.fill} stroke="#fff" strokeWidth={0.7} className={p.market ? "rmk" : undefined}><title>{p.tip}</title></path>)}
        {labels.map((l) => {
          // Leader line ends on the label edge that faces the map.
          const ex = l.side === "l" ? l.x + LW / 2 : l.side === "r" ? l.x - LW / 2 : l.x;
          const ey = l.side === "t" ? l.y + LH / 2 : l.side === "b" ? l.y - LH / 2 : l.y;
          const x0 = l.x - LW / 2, y0 = l.y - LH / 2;
          return (
            <g key={l.key}>
              <line x1={l.cx} y1={l.cy} x2={ex} y2={ey} stroke="#d5dbe5" strokeWidth={1} />
              <circle cx={l.cx} cy={l.cy} r={3} fill="#5b6270" stroke="#fff" strokeWidth={1} />
              <rect x={x0} y={y0} width={LW} height={LH} rx={4} fill="#fff" stroke="#e6e9ee" strokeWidth={1} />
              <rect x={x0} y={y0} width={5} height={LH} rx={2} fill={l.fill} />
              {ISO[l.name] && <image href={`https://flagcdn.com/w80/${ISO[l.name]}.png`} x={x0 + 12} y={l.y - 7} width={20} height={14} preserveAspectRatio="none" />}
              <text x={x0 + 38} y={l.y + 5} className="rmn">{l.name}</text>
              <text x={x0 + LW - 10} y={l.y + 5} textAnchor="end" className="rmv"><tspan className="rmr">CPFA </tspan>{l.avg}</text>
            </g>
          );
        })}
      </svg>
      <div className="rmaplegend">
        <span>Low return</span>
        <i style={{ background: `linear-gradient(90deg, ${ramp(0)}, ${ramp(0.5)}, ${ramp(1)})` }} />
        <span>High return</span>
        <em><b style={{ background: "#d5dbe5" }} /> planned, no spend</em>
      </div>
    </div>
  );
}
