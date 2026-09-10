"use client";

import { Fragment, useMemo } from "react";
import { FileCode2 } from "lucide-react";
import { METRICS, buildGrid, type Agg, type Cal, type GridCell, type Hist, type MonthData, type Period } from "@/lib/engine";
import { instructionsOf } from "@/lib/instruct";
import { ALLCH, CHANNEL_NAMES, COUNTRIES } from "@/lib/plan";
import { fmt, signed } from "@/lib/format";
import { Logo } from "./Logo";
import { Marks as ChannelIcon } from "./ChannelPicker";
import { PerfGrid } from "./PerfGrid";
import { KpiBlock } from "./ReportKpi";
import { WorldMap } from "./WorldMap";
import { PriorityBoard } from "./PriorityBoard";
import { BudgetShift } from "./BudgetShift";
import { Matrix } from "./Matrix";
import { Quadrant } from "./Quadrant";

type Props = { agg: Agg; period: Period; chan: string; enabled: Set<string>; months: MonthData[]; cal: Cal; hist: Hist; redep?: boolean };

const cellText = (c: GridCell, f: (typeof METRICS)[number]["f"]) => ({
  e: c.nodata && !c.e ? "-" : fmt(c.e, f),
  a: c.na || c.nospend || c.nodata ? "-" : fmt(c.a, f),
  d: c.na || c.nospend || c.nodata || !c.e ? "-" : signed(c.diff, f),
  st: c.na ? "bad" : c.nospend || c.nodata ? "" : c.status,
});

/** Wide table like the Performance tab, but one column group per avenue (totals over every country). */
function AvenueGrid({ agg, period }: { agg: Agg; period: Period }) {
  const allOn = useMemo(() => new Set<string>([...COUNTRIES, "Other"]), []);
  const cols = useMemo(() => [ALLCH, ...CHANNEL_NAMES].map((ch) => {
    const g = buildGrid(agg, period, ch, allOn);
    const gi = Math.max(0, g.groups.findIndex((x) => x.tot));
    const used = g.groups.length > 0 && g.groups[gi].act.Spend > 0;
    return { ch, name: ch.replace(" (combined)", ""), grid: used ? g : null, gi };
  }), [agg, period, allOn]);
  const nCols = 1 + cols.length * 3 + 1;
  return (
    <div id="perf" className="hscroll">
      <table className="xl compact">
        <thead>
          <tr>
            <th className="corner" rowSpan={2}></th>
            {cols.map((c, i) => (
              <th key={c.ch} className={"ghead" + (c.ch === ALLCH ? " totc last" : "") + (i % 2 === 1 ? " alt" : "")} colSpan={3}>
                <span className="gicon"><ChannelIcon chan={c.ch} /></span><span>{c.name}</span>
              </th>
            ))}
            <th className="fill" rowSpan={2}></th>
          </tr>
          <tr>
            {cols.map((c, i) => (
              <Fragment key={c.ch}>
                <th className={"sub gs exph" + (c.ch === ALLCH ? " totc" : "") + (i % 2 === 1 ? " alt" : "")}>Expected</th>
                <th className={"sub" + (c.ch === ALLCH ? " totc" : "") + (i % 2 === 1 ? " alt" : "")}>Actual</th>
                <th className={"sub" + (c.ch === ALLCH ? " totc last" : "") + (i % 2 === 1 ? " alt" : "")}>Diff</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m, ri) => (
            <tr key={m.l}>
              <th className="rowh">{m.l}</th>
              {cols.map((c, i) => {
                const t = (c.ch === ALLCH ? " totc" : "") + (i % 2 === 1 ? " alt" : "");
                if (!c.grid) {
                  return (
                    <Fragment key={c.ch}>
                      <td className={"gs exp" + t}>{fmt(0, m.f)}</td>
                      <td className={"mute" + t} title={"We are currently not using " + c.name}>{ri === 0 ? "not in use" : "-"}</td>
                      <td className={"mute" + t + (c.ch === ALLCH ? " last" : "")}>-</td>
                    </Fragment>
                  );
                }
                const cell = c.grid.rows.find((r) => r.m.l === m.l)!.cells[c.gi];
                const x = cellText(cell, m.f);
                return (
                  <Fragment key={c.ch}>
                    <td className={"gs exp" + t}>{x.e}</td>
                    <td className={t.trim()}>{x.a}</td>
                    <td className={(x.st + t + (c.ch === ALLCH ? " last" : "")).trim()}>{x.d}</td>
                  </Fragment>
                );
              })}
              <td className="fill"></td>
            </tr>
          ))}
          {METRICS.length === 0 && <tr><td colSpan={nCols}>No metrics</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/** Collects every same-origin stylesheet rule on the page so the export looks like the app. */
function pageCss(): string {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try { for (const r of Array.from(sheet.cssRules)) out.push(r.cssText); } catch { /* cross-origin sheet, skip */ }
  }
  return out.join("\n");
}

export function ReportHtml({ agg, period, chan, enabled: picked, cal, redep = true }: Props) {
  // Same as the PDF: "Other" always counts so totals match the source dashboard.
  const enabled = useMemo(() => new Set([...picked, "Other"]), [picked]);
  const G = useMemo(() => buildGrid(agg, period, chan, enabled), [agg, period, chan, enabled]);
  const tot = G.groups.find((g) => g.tot) ?? G.groups[0];
  const allOn = useMemo(() => new Set<string>([...COUNTRIES, "Other"]), []);
  const lanes = useMemo(() => instructionsOf(G.groups, period, cal, chan.replace(" / Google Search", "").replace(" (combined)", ""), 8), [G, period, cal, chan]);
  const avenue = chan.replace(" (combined)", "");
  const stamp = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  // Header badge: the selected period with full month names, e.g. "1 August 2026 to 26 August 2026".
  const longDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const range = longDate(period.from) + " to " + longDate(period.to);

  const exportHtml = () => {
    const root = document.getElementById("reporthtml"); if (!root) return;
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-noexport]").forEach((el) => el.remove());
    const html = "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
      + "<title>Marketing - Expected vs Reality · " + stamp + "</title><style>" + pageCss()
      + "\nbody{font-family:Inter,-apple-system,'Segoe UI',Roboto,sans-serif;background:#f7f8fa;margin:0;padding:24px 28px;display:block}#reporthtml{max-width:1800px;margin:0 auto}</style></head><body>"
      + clone.outerHTML + "</body></html>";
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "marketing-kpi-report-" + new Date().toISOString().slice(0, 10) + ".html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  if (!tot) return <p className="empty nocountry">No country selected. Pick at least one country to build the report.</p>;

  return (
    <div id="reporthtml">
      <div className="rbar" data-noexport>
        <div><b>Report HTML</b> · {period.label} · {avenue}</div>
        <button type="button" className="btn report" onClick={exportHtml}><FileCode2 size={15} aria-hidden="true" /> Export HTML</button>
        <span className="fnote">Single self-contained file: tables scroll, map shows details on hover.</span>
      </div>

      <section className="hsec">
        <div className="rhead"><Logo />{redep === false && <span className="rflag">First deposits only · re-deposits excluded</span>}<span className="rdate">{range}</span></div>
        <h1 className="rtitle">Marketing - Expected vs Reality</h1>
        <div className="rsub">{period.label} ({period.full}) · {avenue}</div>
      </section>

      <section className="hsec">
        <h2 className="hh">Top Performers &amp; Worst Performers</h2>
        <WorldMap groups={G.groups} />
      </section>

      <section className="hsec hkpi">
        <h2 className="hh">Key figures</h2>
        <KpiBlock agg={agg} period={period} chan={chan} enabled={enabled} chartHeight={520} svg />
      </section>

      <section className="hsec">
        <h2 className="hh">Performance by country <small>{avenue} · all countries</small></h2>
        <PerfGrid agg={agg} period={period} chan={chan} enabled={allOn} />
      </section>

      <section className="hsec">
        <h2 className="hh">Performance by avenue <small>all countries · scroll sideways for more</small></h2>
        <AvenueGrid agg={agg} period={period} />
      </section>

      <section className="hsec">
        <h2 className="hh">AI Recommendations <small>where the money should move, and why</small></h2>
        <BudgetShift groups={G.groups} lanes={lanes} />
        <h3 className="hh3">Priority <small>most urgent on the left</small></h3>
        <PriorityBoard lanes={lanes} max={6} />
        <h3 className="hh3">Market scorecard <small>{avenue} · ranked by share of metrics on plan</small></h3>
        <div className="hscroll"><Matrix grid={G} /></div>
        <h3 className="hh3">By market <small>spend vs return: every market in its stop, fix or scale zone</small></h3>
        <Quadrant groups={G.groups} period={period} height={620} />
      </section>

    </div>
  );
}
