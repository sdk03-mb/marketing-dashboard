import type { Grid, GridCell } from "@/lib/engine";
import { fmt, type Fmt } from "@/lib/format";
import type { ReactNode } from "react";
import { Flag } from "./Flag";

// Rank by ROI. Rank badge colour follows the stop / fix / scale thresholds: 100%+ green, 30% to 100% amber, under 30% red.
const tone = (roi: number) => (roi >= 1 ? "good" : roi >= 0.3 ? "warn" : "bad");

/** Short money for narrow cells: $1.0m, $42k, $4,693, $4.37. Percentages and ratios unchanged. */
function compact(v: number, f: Fmt): string {
  if (f !== "$2" && f !== "$0") return fmt(v, f);
  const a = Math.abs(v);
  if (a >= 1_000_000) return (v < 0 ? "-" : "") + "$" + (a / 1_000_000).toFixed(1) + "m";
  if (a >= 10_000) return (v < 0 ? "-" : "") + "$" + Math.round(a / 1000) + "k";
  if (a >= 1000) return fmt(v, "$0");
  return fmt(v, f);
}

/** Market scorecard, markets across and metrics down: every market ranked by ROI, one coloured cell per metric. */
/** `zero`: columns shown greyed with 0 in every cell (avenues we do not use). `note`: line under the legend. */
/** `showPlan`: the plan value under each actual. `pin`: a column kept first regardless of rank (the All countries total). */
export function Matrix({ grid, dense, mini, keepOrder, showPlan, pin, perRow = 10, icon, zero, note }: { grid: Grid; dense?: boolean; mini?: boolean; keepOrder?: boolean; showPlan?: boolean; pin?: string; perRow?: number; icon?: (name: string) => ReactNode; zero?: Set<string>; note?: ReactNode }) {
  const idx = grid.groups.map((g, i) => i).filter((i) => (!grid.groups[i].tot || grid.groups[i].name === pin) && (grid.groups[i].act.Spend > 0 || grid.groups[i].pl.Spend > 0 || zero?.has(grid.groups[i].name)));
  const live = (c: GridCell) => !(c.na || c.nospend || c.nodata);
  // Metrics with no direction against plan carry no colour and are left out; so are metrics with no data for any market.
  // Mini cards keep every metric row so all cards share one height; the big scorecards drop rows nobody has data for.
  const rows = grid.rows.filter((r) => r.m.dir !== "none" && (mini || idx.some((gi) => live(r.cells[gi]))));
  const mk = idx.map((gi) => ({ name: grid.groups[gi].name, cells: rows.map((r) => r.cells[gi]), roi: grid.groups[gi].act.ROI, spend: grid.groups[gi].act.Spend }))
    .sort((a, b) => (keepOrder ? 0 : Number(b.name === pin) - Number(a.name === pin) || Number(!!zero?.has(a.name)) - Number(!!zero?.has(b.name)) || b.roi - a.roi || b.spend - a.spend));
  // At most two tables: up to `perRow` markets in one, otherwise split evenly so nothing spills into a third row.
  const per = mk.length > perRow ? Math.ceil(mk.length / 2) : perRow;
  const chunks: typeof mk[] = [];
  for (let i = 0; i < mk.length; i += per) chunks.push(mk.slice(i, i + per));
  return (
    <div className={"mx" + (dense ? " dense" : "") + (mini ? " mini" : "") + (showPlan ? " two" : "")}>
      {chunks.map((xs, ci) => (
        <table key={ci} style={{ width: (xs.length / per) * 100 + "%" }}>
          <thead>
            {!mini && (
              <tr>
                <th className="mx-lbl">Rank</th>
                {xs.map((m) => <th key={m.name}><i className={"mx-rank " + (zero?.has(m.name) || m.name === pin ? "none" : tone(m.roi))}>{zero?.has(m.name) ? "-" : m.name === pin ? "all" : mk.indexOf(m) - (pin ? 1 : 0) + 1}</i></th>)}
              </tr>
            )}
            <tr>
              <th className="mx-lbl">Market</th>
              {xs.map((m) => <th key={m.name} className={"mx-name" + (zero?.has(m.name) ? " mx-off" : "") + (m.name === pin ? " mx-pinh" : "")}>{icon ? <div className="mx-ic">{icon(m.name)}</div> : m.name === pin || m.name === "Other" ? <div className="mx-ic mx-all" /> : <Flag country={m.name} />}<span>{m.name}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.m.l}>
                <th className="mx-lbl">{r.m.l.replace(" $", "")}</th>
                {xs.map((m) => {
                  const c = m.cells[ri];
                  if (zero?.has(m.name)) return <td key={m.name}><span className="mx-cell none">0</span></td>;
                  return (
                    <td key={m.name}>
                      <span className={"mx-cell " + (live(c) && c.status ? c.status : "none") + (m.name === pin ? " mx-pin" : "")} title={live(c) ? m.name + " " + r.m.l + ": " + fmt(c.a, r.m.f) + " vs " + fmt(c.e, r.m.f) + " plan" : "no data"}>
                        {showPlan ? <><b>{live(c) ? compact(c.a, r.m.f) : "-"}</b><small>{c.e ? "plan " + compact(c.e, r.m.f) : "no plan"}</small></> : (live(c) ? compact(c.a, r.m.f) : "-")}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      {!mini && (
        <div className="mx-legend">
          <span>Ranked by return on spend, best to worst, left to right.</span>
          <em><b className="good" /> on plan</em><em><b className="warn" /> within reach</em><em><b className="bad" /> off plan</em><em><b className="none" /> no data</em>
        </div>
      )}
      {note && <p className="mx-note">{note}</p>}
    </div>
  );
}
