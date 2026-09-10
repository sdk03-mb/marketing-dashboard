import { buildGrid, derive, type Agg, type Grid, type GridCell, type Period } from "@/lib/engine";
import { ALLCH, COUNTRIES } from "@/lib/plan";
import { fmt, type Fmt } from "@/lib/format";
import { Flag } from "./Flag";
import { Marks as ChannelIcon } from "./ChannelPicker";
import { Matrix } from "./Matrix";

const BLANK: GridCell = { a: 0, e: 0, diff: 0, status: "bad", na: false, nospend: true, nodata: true };
const short = (ch: string) => ch.replace(" (combined)", "");
// Short column labels for the one-page card grid, and the way back to the avenue for its icon.
const SHORT: Record<string, string> = { [ALLCH]: "All", "PPC / Google Search": "PPC", "Instagram + Facebook": "Insta + FB", "LinkedIn + Snapchat": "LI + Snap" };
const label = (ch: string) => SHORT[ch] ?? short(ch);
const chanOf = (lbl: string) => Object.entries(SHORT).find(([, v]) => v === lbl)?.[0] ?? lbl;

/** Avenues that carry spend anywhere this period, with All channels first. */
export function usedAvenues(agg: Agg, period: Period, names: string[]): string[] {
  const allOn = new Set<string>([...COUNTRIES, "Other"]);
  return [ALLCH, ...names].filter((ch) => {
    const g = buildGrid(agg, period, ch, allOn);
    const gi = g.groups.findIndex((x) => x.tot);
    return gi >= 0 && g.groups[gi].act.Spend > 0;
  });
}

/** One country's metrics with one column per avenue. */
function countryGrid(agg: Agg, period: Period, country: string, avenues: string[]): { grid: Grid; zero: Set<string> } {
  const cols = avenues.map((ch) => {
    const g = buildGrid(agg, period, ch, new Set([country]));
    const gi = g.groups.findIndex((x) => x.name === country);
    return { name: label(ch), g, gi, has: gi >= 0 };
  });
  const ref = cols.find((c) => c.has);
  return {
    grid: {
      groups: cols.map((c) => (c.has ? { ...c.g.groups[c.gi], name: c.name, tot: false } : { name: c.name, tot: false, act: derive(), pl: derive() })),
      rows: ref ? ref.g.rows.map((r, ri) => ({ m: r.m, cells: cols.map((c) => (c.has ? c.g.rows[ri].cells[c.gi] : BLANK)) })).filter((r) => r.m.k !== "ROI") : [],
    },
    zero: new Set(cols.filter((c) => !c.has || c.g.groups[c.gi].act.Spend <= 0).map((c) => c.name)),
  };
}

/** Performance by avenue and country: the scorecard layout, countries across and metrics down, plan under every actual, All countries pinned first. */
export function AvenueCountryTable({ agg, period, chan }: { agg: Agg; period: Period; chan: string }) {
  const g = buildGrid(agg, period, chan, new Set<string>([...COUNTRIES, "Other"]));
  const grid: Grid = { ...g, groups: g.groups.map((x) => (x.tot ? { ...x, name: "All countries" } : x)), rows: g.rows.filter((r) => r.m.k !== "ROI") };
  return <Matrix grid={grid} dense showPlan pin="All countries" perRow={12} />;
}

/** Tight money for 46px cells: $1.0m, $42k, $4,693, $237, $4.37. */
function tight(v: number, f: Fmt): string {
  if (f !== "$2" && f !== "$0") return fmt(v, f);
  const a = Math.abs(v), sign = v < 0 ? "-" : "";
  if (a >= 1_000_000) return sign + "$" + (a / 1_000_000).toFixed(1) + "m";
  if (a >= 10_000) return sign + "$" + Math.round(a / 1000) + "k";
  if (a >= 100) return fmt(v, "$0");
  return fmt(v, f);
}

/** Avenue and country scorecard as two wide tables: metric labels once on the left, a three-column group per country. */
export function CountryAvenueTable({ agg, period, countries, avenues, perTable = 10, wide }: { agg: Agg; period: Period; countries: string[]; avenues: string[]; perTable?: number; wide?: boolean }) {
  const per = perTable;
  const bands: string[][] = [];
  for (let i = 0; i < countries.length; i += per) bands.push(countries.slice(i, i + per));
  const live = (c: GridCell) => !(c.na || c.nospend || c.nodata);
  return (
    <div className={"cat" + (wide ? " wide" : "")}>
      {bands.map((band, bi) => {
        const grids = band.map((c) => ({ c, ...countryGrid(agg, period, c, avenues) }));
        // Keep the original row index: cells are looked up in the unfiltered grid.
        const rows = (grids[0]?.grid.rows ?? []).map((r, ri) => ({ r, ri })).filter(({ r }) => r.m.dir !== "none" && r.m.k !== "ROI");
        return (
          <table key={bi}>
            <thead>
              <tr>
                <th className="cat-lbl"></th>
                {band.map((c) => <th key={c} colSpan={avenues.length} className="cat-c"><Flag country={c} /><span>{c}</span></th>)}
              </tr>
              <tr>
                <th className="cat-lbl">Metric</th>
                {grids.map(({ c, grid, zero }) => grid.groups.map((g) => (
                  <th key={c + g.name} className={"cat-a" + (zero.has(g.name) ? " off" : "")} title={g.name}><ChannelIcon chan={chanOf(g.name)} /><span>{g.name}</span></th>
                )))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, ri }) => (
                <tr key={r.m.l}>
                  <th className="cat-lbl">{r.m.l.replace(" $", "")}</th>
                  {grids.map(({ c, grid, zero }) => grid.groups.map((g, gi) => {
                    if (zero.has(g.name)) return <td key={c + g.name}><span className="mx-cell none">0</span></td>;
                    const cell = grid.rows[ri].cells[gi];
                    return (
                      <td key={c + g.name}>
                        <span className={"mx-cell " + (live(cell) && cell.status ? cell.status : "none")} title={c + " " + g.name + " " + r.m.l + ": " + fmt(cell.a, r.m.f) + " vs " + fmt(cell.e, r.m.f) + " plan"}>
                          {live(cell) ? tight(cell.a, r.m.f) : "-"}
                        </span>
                      </td>
                    );
                  }))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
      <div className="mx-legend">
        <span>Per country: All channels, PPC / Google Search, Instagram + Facebook.</span>
        <em><b className="good" /> on plan</em><em><b className="warn" /> within reach</em><em><b className="bad" /> off plan</em><em><b className="none" /> no data</em>
      </div>
    </div>
  );
}
