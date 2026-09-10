"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { buildGrid, derive, type Agg, type Cal, type Grid, type Hist, type MonthData, type Period } from "@/lib/engine";
import { instructionsOf } from "@/lib/instruct";
import { ALLCH, CHANNEL_NAMES, COUNTRIES, REGIONS } from "@/lib/plan";
import { fmt, money, signed } from "@/lib/format";
import { Logo } from "./Logo";
import { Flag } from "./Flag";
import { Marks as ChannelIcon } from "./ChannelPicker";
import { KpiBestWorst, KpiTiles } from "./ReportKpi";
import { WorldMap } from "./WorldMap";
import { PriorityBoard } from "./PriorityBoard";
import { BudgetShift } from "./BudgetShift";
import { Matrix } from "./Matrix";
import { AiDetail, AiPyramid, LEVELS } from "./AiPyramid";
import { Quadrant } from "./Quadrant";
import { AvenueCountryTable, CountryAvenueTable, usedAvenues } from "./AvenueCountry";

type Props = { agg: Agg; period: Period; chan: string; enabled: Set<string>; months: MonthData[]; cal: Cal; hist: Hist; redep?: boolean };

/** Report grids leave the ROI row out; the chairman reads deposits and cost per funded account instead. */
const gridNoRoi = (agg: Agg, p: Period, chan: string, enabled: Set<string>): Grid => { const g = buildGrid(agg, p, chan, enabled); return { ...g, rows: g.rows.filter((r) => r.m.k !== "ROI") }; };

// CSS px at 96 dpi: every page is A3 landscape, 420 x 297 mm.
const A3_W = 1587, A3_H = 1123;

/* ---------- scale a fixed-size page to its container on screen ---------- */
function useFit(pageW: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => setZoom(Math.min(1, el.clientWidth / pageW));
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [pageW]);
  return { ref, zoom };
}

function Page({ w, h = A3_H, wide, children }: { w: number; h?: number; wide?: boolean; children: React.ReactNode }) {
  const { ref, zoom } = useFit(w);
  return (
    <div ref={ref} className="rfit" style={{ height: h * zoom }}>
      <div className={"rpage" + (wide ? " wide" : "")} style={{ zoom }}>{children}</div>
    </div>
  );
}

export function Report({ agg, period, chan, enabled: picked, cal, redep = true }: Props) {
  // The report always counts "Other" (spend outside the plan list) so its totals match the source dashboard.
  const enabled = useMemo(() => new Set([...picked, "Other"]), [picked]);
  // Instructions per market grouped by owning department feed the priority pyramid.
  const scope = useMemo(() => gridNoRoi(agg, period, chan, enabled), [agg, period, chan, enabled]);
  const lanes = useMemo(() => instructionsOf(scope.groups, period, cal, chan.replace(" / Google Search", "").replace(" (combined)", ""), 8), [scope, period, cal, chan]);
  const G = useMemo(() => gridNoRoi(agg, period, chan, enabled), [agg, period, chan, enabled]);
  const tot = G.groups.find((g) => g.tot) ?? G.groups[0];
  const byC = useMemo(() => G.groups.filter((g) => !g.tot && g.name !== "Other" && (g.act.Spend > 0 || g.pl.Spend > 0)).sort((a, b) => b.act.Spend - a.act.Spend), [G]);
  const allOn = useMemo(() => new Set<string>([...COUNTRIES, "Other"]), []);
  const avenue = chan.replace(" (combined)", "");
  // Report covers the current day only: the stamp carries the weekday and is highlighted on every page.
  const stamp = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  // Header badge: the selected period with full month names, e.g. "1 August 2026 to 26 August 2026".
  const longDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const range = longDate(period.from) + " to " + longDate(period.to);

  // Card = one Expected / Actual / Diff table. Two sections, 9 cards per A3 page:
  //  - Performance by country: selected avenue, every country, "All countries" first.
  //  - Performance by avenue: one card per avenue from the avenue filter (All channels first), totals over all countries.
  const sections = useMemo(() => {
    type Card = { key: string; name: string; flag: boolean; grid: Grid | null; gi: number };
    const cGrid = gridNoRoi(agg, period, chan, allOn);
    const countries: Card[] = cGrid.groups.map((g, gi) => ({ key: g.name, name: g.name, flag: true, grid: cGrid, gi }));
    const avenues: Card[] = [];
    // Every avenue from the filter gets a card; an avenue with no spend shows a "not using" note instead of a table.
    for (const ch of [ALLCH, ...CHANNEL_NAMES]) {
      const g = gridNoRoi(agg, period, ch, allOn);
      const gi = Math.max(0, g.groups.findIndex((x) => x.tot));
      const used = g.groups.length > 0 && g.groups[gi].act.Spend > 0;
      avenues.push({ key: ch, name: ch.replace(" (combined)", ""), flag: false, grid: used ? g : null, gi });
    }
    return [
      { title: "Performance by country", sub: chan.replace(" (combined)", ""), cards: countries },
      { title: "Performance by avenue", sub: "All countries", cards: avenues },
    ];
  }, [agg, period, chan, allOn]);
  // Avenue scorecard: one column per avenue, the totals over every country, same metric rows as the country grid.
  const avenueGrid = useMemo(() => {
    // Every avenue gets a column; one with no rows at all gets an empty group so it still shows, greyed.
    const cols = CHANNEL_NAMES.map((ch) => {
      const g = gridNoRoi(agg, period, ch, allOn);
      const gi = Math.max(0, g.groups.findIndex((x) => x.tot));
      const has = g.groups.length > 0;
      return { name: ch.replace(" (combined)", ""), g, gi, has, used: has && g.groups[gi].act.Spend > 0 };
    });
    const ref = cols.find((c) => c.has) ?? cols[0];
    const blank = { a: 0, e: 0, diff: 0, status: "bad" as const, na: false, nospend: true, nodata: true };
    return {
      grid: {
        groups: cols.map((c) => (c.has ? { ...c.g.groups[c.gi], name: c.name, tot: false } : { name: c.name, tot: false, act: derive(), pl: derive() })),
        rows: ref.has ? ref.g.rows.map((r, ri) => ({ m: r.m, cells: cols.map((c) => (c.has ? c.g.rows[ri].cells[c.gi] : blank)) })) : [],
      } as Grid,
      unused: cols.filter((c) => !c.used).map((c) => c.name),
    };
  }, [agg, period, allOn]);
  const pages = useMemo(() => {
    const out: { sec: (typeof sections)[number]; cards: (typeof sections)[number]["cards"]; n: number; of: number }[] = [];
    for (const sec of sections) {
      const of = Math.ceil(sec.cards.length / 9);
      for (let i = 0; i < sec.cards.length; i += 9) out.push({ sec, cards: sec.cards.slice(i, i + 9), n: i / 9 + 1, of });
    }
    return out;
  }, [sections]);

  // Avenues with spend this period (All channels first): they drive the avenue-by-country pages.
  const used = useMemo(() => usedAvenues(agg, period, CHANNEL_NAMES), [agg, period]);
  const countryList = useMemo(() => G.groups.filter((g) => !g.tot && (g.act.Spend > 0 || g.pl.Spend > 0)).sort((a, b) => b.act.Spend - a.act.Spend).map((g) => g.name), [G]);

  if (!tot) return <p className="empty nocountry">No country selected. Pick at least one country to build the report.</p>;

  // Every page in order. Page numbers and annex letters come from the position in this list.
  type Sheet = { key: string; title: ReactNode; body: ReactNode; sub?: string; annex?: boolean; divider?: boolean };
  const sheets: Sheet[] = [];
  const add = (x: Sheet) => sheets.push(x);

  add({ key: "map", title: <>Top Performers &amp; Worst Performers</>, body: (
    <>
      <div className="rp1">
        <KpiTiles agg={agg} period={period} chan={chan} enabled={enabled} />
        <WorldMap groups={G.groups} />
      </div>
      <KpiBestWorst agg={agg} period={period} chan={chan} enabled={enabled} />
    </>
  ) });
  add({ key: "score-c", title: <>Country Scorecard <small className="rtsub">{avenue}</small></>, body: <Matrix grid={G} dense /> });
  add({ key: "score-a", title: <>Avenue Scorecard <small className="rtsub">all countries</small></>, body: (
    <Matrix grid={avenueGrid.grid} dense perRow={CHANNEL_NAMES.length} icon={(name) => <ChannelIcon chan={name} />} zero={new Set(avenueGrid.unused)}
      note={avenueGrid.unused.length ? <>We do not use {avenueGrid.unused.map((n, i) => <span key={n}>{i > 0 && (i === avenueGrid.unused.length - 1 ? " and " : ", ")}<b>{n}</b></span>)}.</> : null} />
  ) });
  add({ key: "quad", title: "AI Recommendations by market", body: <Quadrant groups={G.groups} period={period} height={760} /> });
  // AI recommendations: one pyramid page, what / why / how per level (text in src/components/AiPyramid.tsx).
  add({ key: "pyramid", sub: "All Channels", title: "AI Recommendations", body: <AiPyramid rowH={176} /> });
  // One deep-dive page per level, read from the base up: stop, fix, hold, scale, attack.
  for (const l of [...LEVELS].reverse()) {
    add({ key: "ai-" + l.key, sub: "All Channels", title: <>{l.head} <small className="rtsub">{l.tag}</small></>, body: <AiDetail level={l.key} /> });
  }

  // Avenue and country scorecard: two pages, ten countries each as two bands of five, three columns per country.
  for (let i = 0; i < countryList.length; i += 12) {
    const n = i / 12 + 1, of = Math.ceil(countryList.length / 12);
    add({ key: "score-ac" + n, title: <>Avenue &amp; Country Scorecard{of > 1 ? " (" + n + "/" + of + ")" : ""} <small className="rtsub">all avenues in use</small></>,
      body: <CountryAvenueTable agg={agg} period={period} countries={countryList.slice(i, i + 12)} avenues={used} perTable={6} wide /> });
  }

  // Annexure.
  const annexToc: string[] = [
    ...REGIONS.map((r) => r.name + ": return by market"),
    ...used.filter((ch) => ch !== ALLCH).map((ch) => "Performance by avenue and country: " + ch.replace(" (combined)", "")),
    "Budget shift: where the money moves and why",
    "Priority board: every action by urgency",
    "Performance by country: expected, actual, difference",
    "Performance by avenue: expected, actual, difference",
  ];
  add({ key: "divider", divider: true, title: "Supporting detail", body: (
    <ol className="rdiv-toc">{annexToc.map((t, i) => <li key={i}><b>A{i + 1}</b> {t}</li>)}</ol>
  ) });
  for (const r of REGIONS) {
    const on = new Set(r.countries.filter((c) => enabled.has(c)));
    const rg = gridNoRoi(agg, period, chan, on);
    add({ key: "region-" + r.name, annex: true, title: <>{r.name} <small className="rtsub">{avenue}</small></>, body: (
      <div className="rp1">
        <KpiTiles agg={agg} period={period} chan={chan} enabled={on} />
        <WorldMap groups={rg.groups} focus={r.countries} fit={r.fit} />
      </div>
    ) });
  }
  // All channels is skipped here: the country tables at the end already cover the combined view.
  for (const ch of used.filter((c) => c !== ALLCH)) {
    add({ key: "act-" + ch, annex: true, sub: ch.replace(" (combined)", ""), title: <>Performance by avenue &amp; country <small className="rtsub">{ch.replace(" (combined)", "")}</small><span className="rtlogo"><ChannelIcon chan={ch} /></span></>,
      body: <AvenueCountryTable agg={agg} period={period} chan={ch} /> });
  }
  add({ key: "budget", annex: true, title: "Budget shift", body: <BudgetShift groups={G.groups} lanes={lanes} rowH={104} dense /> });
  add({ key: "board", annex: true, title: "Priority board", body: <PriorityBoard lanes={lanes} max={4} /> });
  for (const pg of pages) {
    add({ key: "tbl-" + pg.sec.title + pg.n, annex: true, sub: pg.sec.sub, title: <>{pg.sec.title}{pg.of > 1 ? " (" + pg.n + "/" + pg.of + ")" : ""}</>, body: (
      <div className="rcards">
        {pg.cards.map((card) => {
          const icon = card.flag ? <Flag country={card.name} /> : <ChannelIcon chan={card.key} />;
          if (!card.grid) {
            return (
              <div key={card.key} className="rcard off">
                <div className="rch">{icon}<span>{card.name}</span></div>
                <p className="rnouse">We are currently not using {card.name}.</p>
              </div>
            );
          }
          const g = card.grid.groups[card.gi], gi = card.gi;
          const first = card.flag ? g.tot : card.key === ALLCH;
          return (
            <div key={card.key} className={"rcard" + (first ? " tot" : "")}>
              <div className="rch">{icon}<span>{card.name}</span><small>{money(g.act.Spend)} spent · {fmt(g.act.FundedAccounts, "n")} funded</small></div>
              <table className="rct">
                <thead><tr><th>Metric</th><th>Expected</th><th>Actual</th><th>Diff</th></tr></thead>
                <tbody>
                  {card.grid.rows.map((r) => {
                    const c = r.cells[gi], f = r.m.f;
                    const dash = c.na || c.nospend || c.nodata;
                    const st = c.na ? "bad" : c.nospend || c.nodata ? "" : c.status;
                    return (
                      <tr key={r.m.l}>
                        <th>{r.m.l}</th>
                        <td className="exp">{c.nodata && !c.e ? "-" : fmt(c.e, f)}</td>
                        <td>{dash ? "-" : fmt(c.a, f)}</td>
                        <td className={st}>{dash || !c.e ? "-" : signed(c.diff, f)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    ) });
  }

  // Annex letters: the same label for every page of a multi-page section (the "1/2" suffix tells them apart).
  const annexLetter = new Map<string, string>();
  let a = 0, last = "";
  for (const sh of sheets) {
    if (!sh.annex) continue;
    const base = sh.key.replace(/\d+$/, "");
    if (base !== last) { a++; last = base; }
    annexLetter.set(sh.key, "A" + a);
  }

  return (
    <div id="report">
      <div className="rbar">
        <div><b>Marketing - Expected vs Reality</b> · {period.label} · {avenue} · {byC.length} countries</div>
        <button type="button" className="btn report" onClick={() => window.print()}><Printer size={15} aria-hidden="true" /> Export PDF</button>
        <span className="fnote">Opens the print dialog: choose Save as PDF. Every page is A3 landscape.</span>
      </div>
      {sheets.map((sh, i) => (
        <Page key={sh.key} w={A3_W} wide>
          <div className="rhead"><Logo />{redep === false && <span className="rflag">First deposits only · re-deposits excluded</span>}<span className="rdate">{range}</span></div>
          {sh.divider ? (
            <div className="rdiv">
              <div className="rdiv-k">Annexure</div>
              <h1 className="rtitle">{sh.title}</h1>
              {sh.body}
            </div>
          ) : (
            <>
              <h1 className="rtitle sm">{sh.annex && <small className="rtsub">{annexLetter.get(sh.key)}</small>}{sh.title}</h1>
              {sh.body}
            </>
          )}
          <div className="rfoot"><span>Page {i + 1} · {sh.sub ?? avenue}</span><span>{stamp}</span></div>
        </Page>
      ))}
    </div>
  );
}
