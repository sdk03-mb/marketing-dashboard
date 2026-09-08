"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  METRICS, chanData, hasLive, hasSnapshot, iso, loadPeriod, makeCal, monthPeriods, periodFor, planFor, syntheticAgg,
  type Agg, type Cal, type Hist, type MonthData, type Period,
} from "@/lib/engine";
import { ALLCH, CHANNEL_NAMES, COUNTRIES } from "@/lib/plan";
import { ChannelPicker } from "./ChannelPicker";
import { Flag } from "./Flag";
import { Logo } from "./Logo";
import { PANEL, POP, Pill } from "./motion";
import { Overview } from "./Overview";
import { PerfGrid } from "./PerfGrid";
import { Recs } from "./Recs";
import { Select } from "./Select";
import { FileDown } from "lucide-react";
import { downloadReport } from "@/lib/report";

type Tab = "kpi" | "perf" | "recs";
const TABS: [Tab, string][] = [["kpi", "Overview"], ["perf", "Performance"], ["recs", "Recommendations"]];
type Ctx = { agg: Agg; p: Period; hist: Hist; months: MonthData[] };

const KEY_PERIOD = "mkt_period3", KEY_CHAN = "mkt_chan3", KEY_TAB = "mkt_tab4", KEY_COUNTRIES = "mkt_countries4", KEY_METRICS = "mkt_metrics1";
const CHAN_OPTIONS = [ALLCH, ...CHANNEL_NAMES];
const PICKABLE: string[] = [...COUNTRIES, "Other"];
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

export function Dashboard() {
  // Rendered client-only (see page.tsx), so dates and saved preferences can be read on first render.
  const [cal] = useState<Cal>(() => makeCal());
  const [range, setRange] = useState(() => {
    const p = cal.periods.find((x) => x.id === ls.get(KEY_PERIOD)) ?? cal.periods[0];
    return { from: iso(p.from), to: iso(p.to) };
  });
  const [chan, setChan] = useState(() => { const v = ls.get(KEY_CHAN); return v && CHAN_OPTIONS.includes(v) ? v : "PPC / Google Search"; });
  // Always open on Performance; the tab choice is not remembered between visits.
  const [tab, setTab] = useState<Tab>("perf");
  const [enabled, setEnabled] = useState<Set<string>>(() => {
    try { const v = JSON.parse(ls.get(KEY_COUNTRIES) || "null"); return new Set<string>(Array.isArray(v) ? v : COUNTRIES); }
    catch { return new Set<string>(COUNTRIES); }
  });
  const [pickOpen, setPickOpen] = useState(false);
  // Which metric rows the table shows; remembered per browser.
  const [metrics, setMetrics] = useState<Set<string>>(() => {
    try { const v = JSON.parse(ls.get(KEY_METRICS) || "null"); return new Set<string>(Array.isArray(v) ? v : METRICS.map((m) => m.l)); }
    catch { return new Set<string>(METRICS.map((m) => m.l)); }
  });
  const [mOpen, setMOpen] = useState(false);
  const setRows = (next: Set<string>) => { setMetrics(next); ls.set(KEY_METRICS, JSON.stringify([...next])); };
  const toggleRow = (l: string, on: boolean) => { const next = new Set(metrics); if (on) next.add(l); else next.delete(l); setRows(next); };
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cache = useRef<Record<string, Agg>>({});

  const period = useMemo(() => periodFor(cal, range.from, range.to), [cal, range]);

  useEffect(() => {
    let live = true;
    if (!period.id.startsWith("c_")) ls.set(KEY_PERIOD, period.id);
    const prev = cal.periods.find((x) => x.id === "prev")!, mtd = cal.periods.find((x) => x.id === "mtd")!;
    const c = cache.current;
    const quick = (m: Period): Promise<Agg | null> =>
      hasSnapshot(m.id) || c[m.id] ? loadPeriod(m, c) : hasLive() ? loadPeriod(m, c).catch(() => null) : Promise.resolve(null);
    (async () => {
      const [agg, prevA, mtdA] = await Promise.all([loadPeriod(period, c), loadPeriod(prev, c), loadPeriod(mtd, c)]);
      // 12 months: snapshot or live where available, otherwise an illustrative placeholder (flagged).
      const mp = monthPeriods(cal, 12);
      const ms = await Promise.all(mp.map(quick));
      // Placeholder months follow the latest real month's spend as a share of plan.
      const realSpend = Object.values(chanData(prevA, ALLCH)).reduce((s, b) => s + b.Spend, 0);
      const planSpend = COUNTRIES.reduce((s, c) => s + planFor(ALLCH, c, prev.pace).Spend, 0);
      const level = planSpend > 0 ? Math.min(Math.max(realSpend / planSpend, 0.1), 1.5) : 1;
      const months: MonthData[] = mp.map((m, i) => (ms[i]
        ? { ...m, agg: ms[i]!, missing: false }
        : { ...m, agg: syntheticAgg(m, level), missing: true, illustrative: true }));
      if (!live) return;
      setErr(null);
      setCtx({ agg, p: period, hist: { prev: prevA, mtd: mtdA }, months });
    })().catch((e: unknown) => {
      if (!live) return;
      const msg = e instanceof Error ? e.message : String(e);
      setErr(period.id.startsWith("c_")
        ? "This range needs the live Power BI connection. The snapshot covers yesterday, last 7 days, this month and last month (use Quick range)."
        : "Power BI query failed: " + msg);
    });
    return () => { live = false; };
  }, [cal, period]);

  // Close the country and metric pickers on outside click.
  useEffect(() => {
    if (!pickOpen && !mOpen) return;
    const close = () => { setPickOpen(false); setMOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [pickOpen, mOpen]);

  const pickChan = useCallback((v: string) => { setChan(v); ls.set(KEY_CHAN, v); }, []);
  const pickTab = useCallback((v: Tab) => { setTab(v); ls.set(KEY_TAB, v); }, []);
  const pickQuick = (id: string) => { const p = cal.periods.find((x) => x.id === id); if (p) setRange({ from: iso(p.from), to: iso(p.to) }); };
  const onDate = (k: "from" | "to") => (v: string) => {
    const next = { ...range, [k]: v };
    if (next.from && next.to && next.from <= next.to) setRange(next);
  };
  const setCountries = (next: Set<string>) => { setEnabled(next); ls.set(KEY_COUNTRIES, JSON.stringify([...next])); };
  const toggleCountry = (c: string, on: boolean) => { const next = new Set(enabled); if (on) next.add(c); else next.delete(c); setCountries(next); };

  const maxDate = iso(cal.yest);
  const nOn = [...enabled].filter((c) => c !== "Other").length;

  return (
    <>
      <header>
        <div className="row">
          <div className="brand"><Logo /><span className="sep"></span><h1>Marketing Dashboard - Plan vs Reality</h1></div>
          <div className="hright">
          <motion.button type="button" className="btn report" disabled={!ctx} whileTap={{ scale: 0.98 }}
            onClick={() => ctx && downloadReport({ agg: ctx.agg, period: ctx.p, chan, enabled, cal, hist: ctx.hist, months: ctx.months })}>
            <FileDown size={15} aria-hidden="true" /> Report (PDF)
          </motion.button>
          <LayoutGroup id="maintabs">
            <div className="tabs">
              {TABS.map(([t, lbl]) => (
                <button type="button" key={t} className={tab === t ? "on" : ""} onClick={() => pickTab(t)}>
                  {tab === t && <Pill id="maintab" className="pill" />}
                  <span>{lbl}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>
          </div>
        </div>
        <div className="row filters">
          <div className="field">
            <label htmlFor="from">From</label>
            <input type="date" id="from" value={range.from} max={maxDate} onChange={(e) => onDate("from")(e.target.value)} />
            <label htmlFor="to">to</label>
            <input type="date" id="to" value={range.to} max={maxDate} onChange={(e) => onDate("to")(e.target.value)} />
            <Select
              ariaLabel="Quick range" placeholder="Custom range" width={210}
              value={period.id.startsWith("c_") ? null : period.id}
              options={cal.periods.map((p) => ({ value: p.id, label: p.label, hint: p.full }))}
              onChange={pickQuick}
            />
          </div>
          <div className="field">
            <label>Avenue</label>
            <ChannelPicker value={chan} onChange={pickChan} />
          </div>
          <div className="field pick" onClick={(e) => e.stopPropagation()}>
            <label htmlFor="cbtn">Countries</label>
            <motion.button type="button" id="cbtn" className="btn" aria-haspopup="true" aria-expanded={pickOpen} onClick={() => setPickOpen((o) => !o)} whileTap={{ scale: 0.98 }}>
              {nOn}/{COUNTRIES.length} selected
            </motion.button>
            <AnimatePresence>
              {pickOpen && (
                <motion.div id="cpop" className="pop" {...POP}>
                  <div className="pact">
                    <button type="button" onClick={() => setCountries(new Set(PICKABLE))}>All</button>
                    <button type="button" onClick={() => setCountries(new Set())}>None</button>
                  </div>
                  {PICKABLE.map((c) => (
                    <motion.label key={c} whileHover={{ x: 2 }}>
                      <input type="checkbox" value={c} checked={enabled.has(c)} onChange={(e) => toggleCountry(c, e.target.checked)} />
                      <Flag country={c} />{c}
                    </motion.label>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="field pick" onClick={(e) => e.stopPropagation()}>
            <label htmlFor="mbtn">Rows</label>
            <motion.button type="button" id="mbtn" className="btn" aria-haspopup="true" aria-expanded={mOpen} onClick={() => setMOpen((o) => !o)} whileTap={{ scale: 0.98 }}>
              {metrics.size}/{METRICS.length} metrics
            </motion.button>
            <AnimatePresence>
              {mOpen && (
                <motion.div className="pop mpop" {...POP}>
                  <div className="pact">
                    <button type="button" onClick={() => setRows(new Set(METRICS.map((m) => m.l)))}>All</button>
                    <button type="button" onClick={() => setRows(new Set())}>None</button>
                  </div>
                  {METRICS.map((m, i) => (
                    <Fragment key={m.l}>
                      {(i === 0 || METRICS[i - 1].group !== m.group) && <div className="pgrp">{m.group}</div>}
                      <motion.label whileHover={{ x: 2 }}>
                        <input type="checkbox" checked={metrics.has(m.l)} onChange={(e) => toggleRow(m.l, e.target.checked)} />
                        {m.l}
                      </motion.label>
                    </Fragment>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>
      <main>
        <AnimatePresence>{err && <motion.div id="errBox" {...PANEL}>{err}</motion.div>}</AnimatePresence>
        <AnimatePresence mode="wait" initial={false}>
          {ctx && tab === "kpi" && (
            <motion.div key={"kpi|" + ctx.p.id + "|" + chan} className="panel" {...PANEL}>
              <Overview agg={ctx.agg} period={ctx.p} chan={chan} enabled={enabled} months={ctx.months} />
            </motion.div>
          )}
          {ctx && tab === "perf" && (
            <motion.div key={"perf|" + ctx.p.id + "|" + chan} className="panel" {...PANEL}>
              <PerfGrid agg={ctx.agg} period={ctx.p} chan={chan} enabled={enabled} metrics={metrics} />
            </motion.div>
          )}
          {ctx && tab === "recs" && (
            <motion.div key={"recs|" + ctx.p.id} className="panel" {...PANEL}>
              <Recs agg={ctx.agg} period={ctx.p} cal={cal} hist={ctx.hist} months={ctx.months} enabled={enabled} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
