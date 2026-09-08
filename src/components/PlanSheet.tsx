"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TopBar } from "./TopBar";
import {
  countries, metrics, notes, sheetMeta, rag, fmtMetric, fmtShort,
  type Metric, type MetricGroup, type Rag, type Region,
} from "@/lib/plan";

type CellMode = "actual" | "expected" | "diff" | "all";
const cellModes: { id: CellMode; label: string }[] = [
  { id: "actual", label: "Actual + Δ" },
  { id: "all", label: "Plan · Actual · Δ" },
  { id: "diff", label: "Difference" },
  { id: "expected", label: "Plan" },
];

const regionOrder: Region[] = ["GCC", "Levant", "North Africa", "Europe", "CIS & Türkiye", "Rest of world"];
const groupOrder: MetricGroup[] = ["Spend", "Traffic", "Leads", "Accounts", "Funding", "Revenue"];

const ragClass: Record<Rag, string> = {
  good: "rag-good",
  warn: "rag-warn",
  bad: "rag-bad",
  none: "",
};

function sum(a: number[], idx: number[]) {
  return idx.reduce((s, i) => s + a[i], 0);
}

/** Derived totals for ratio rows across a set of countries; null when not derivable. */
function derivedTotal(m: Metric, idx: number[], side: "expected" | "actual"): number | null {
  const get = (k: string) => {
    const mm = metrics.find((x) => x.key === k)!;
    return sum(mm[side], idx);
  };
  const safe = (n: number, d: number) => (d ? n / d : 0);
  switch (m.key) {
    case "spendPct": return safe(get("spend"), sheetMeta.totalExpected) * 100;
    case "ctr": return safe(get("clicks"), get("impr")) * 100;
    case "cpc": return safe(get("spend"), get("clicks"));
    case "cpl": return safe(get("spend"), get("leads"));
    case "l2a": return safe(get("live"), get("leads")) * 100;
    case "cpa": return safe(get("spend"), get("live"));
    case "a2f":
    case "acc2f": return safe(get("funded"), get("live")) * 100;
    case "l2f": return safe(get("funded"), get("leads")) * 100;
    case "cpfa": return safe(get("spend"), get("funded"));
    case "avgSize": return safe(get("ftd"), get("ftdAcc"));
    case "roi": return safe(get("deposits"), get("spend")) * 100;
    default: return null;
  }
}

export function PlanSheet() {
  const [mode, setMode] = useState<CellMode>("actual");
  const [regions, setRegions] = useState<Set<Region>>(new Set(regionOrder));
  const [groups, setGroups] = useState<Set<MetricGroup>>(new Set(groupOrder));
  const [heat, setHeat] = useState(true);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [pinned, setPinned] = useState<number | null>(null);

  const colIdx = useMemo(() => {
    const spend = metrics[0];
    return countries
      .map((c, i) => i)
      .filter((i) => regions.has(countries[i].region))
      .filter((i) => !hideEmpty || spend.expected[i] > 0 || spend.actual[i] > 0);
  }, [regions, hideEmpty]);

  const rows = useMemo(() => metrics.filter((m) => groups.has(m.group)), [groups]);

  // Region spans for the header, in display order
  const regionSpans = useMemo(() => {
    const out: { region: Region; n: number }[] = [];
    for (const i of colIdx) {
      const r = countries[i].region;
      const last = out[out.length - 1];
      if (last && last.region === r) last.n++;
      else out.push({ region: r, n: 1 });
    }
    return out;
  }, [colIdx]);

  const allIdx = countries.map((_, i) => i);
  const kpi = (key: string) => {
    const m = metrics.find((x) => x.key === key)!;
    return { m, e: sum(m.expected, allIdx), a: sum(m.actual, allIdx) };
  };
  const summary = [kpi("spend"), kpi("leads"), kpi("live"), kpi("funded"), kpi("ftd"), kpi("deposits")];
  const pace = sheetMeta.daysElapsed / sheetMeta.daysInMonth;

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v); else n.add(v);
    setter(n);
  };

  return (
    <div className="h-dvh flex flex-col gap-2 px-3 py-2 max-w-[1800px] mx-auto">
      <TopBar
        active="plan"
        right={<span className="text-muted text-[11px]">Google Search · {sheetMeta.period} · plan of {sheetMeta.planDate}</span>}
      />

      {/* Summary strip */}
      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="grid grid-cols-[1.6fr_repeat(5,1fr)] gap-1.5"
      >
        <div className="panel px-2.5 py-1.5 flex flex-col gap-1">
          <div className="flex justify-between items-baseline">
            <span className="text-[10.5px] text-muted">Total spend, all countries</span>
            <span className="num text-[11px] text-muted">{Math.round((sheetMeta.totalActual / sheetMeta.totalExpected) * 100)}% of plan</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="num text-[18px] font-semibold leading-none">{fmtMetric(sheetMeta.totalActual, "money0")}</span>
            <span className="num text-muted text-[11px]">of {fmtMetric(sheetMeta.totalExpected, "money0")}</span>
            <span className="num text-down text-[11px] ml-auto">{fmtMetric(sheetMeta.totalActual - sheetMeta.totalExpected, "money0", true)}</span>
          </div>
          <div className="relative h-[6px] rounded-sm bg-surface-2 overflow-hidden mt-0.5">
            <motion.div className="h-full bg-blue" initial={{ width: 0 }} animate={{ width: `${(sheetMeta.totalActual / sheetMeta.totalExpected) * 100}%` }} transition={{ duration: 0.7 }} />
            <div className="absolute top-0 bottom-0 w-px bg-warn" style={{ left: `${pace * 100}%` }} title={`${sheetMeta.daysElapsed}/${sheetMeta.daysInMonth} days elapsed`} />
          </div>
          <div className="flex justify-between text-[10px] text-muted num">
            <span>spent</span>
            <span>day {sheetMeta.daysElapsed} of {sheetMeta.daysInMonth} · {Math.round(pace * 100)}% of month elapsed</span>
          </div>
        </div>
        {summary.slice(1).map(({ m, e, a }) => {
          const r = rag(m, e, a);
          return (
            <div key={m.key} className={`panel px-2.5 py-1.5 flex flex-col gap-0.5 ${heat ? ragClass[r] : ""}`}>
              <div className="flex justify-between items-baseline">
                <span className="text-[10.5px] text-muted">{m.label}</span>
                <span className="num text-[11px] text-muted">{e ? Math.round((a / e) * 100) : 0}%</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="num text-[18px] font-semibold leading-none">{fmtShort(a, m.format)}</span>
                <span className="num text-muted text-[11px]">of {fmtShort(e, m.format)}</span>
              </div>
              <span className={`num text-[11px] ${a - e >= 0 ? "text-up" : "text-down"}`}>{fmtShort(a - e, m.format).replace(/^(-?)/, (s) => (s ? s : "+"))}</span>
            </div>
          );
        })}
      </motion.div>

      {/* Controls */}
      <div className="flex items-center gap-2 text-[11px] flex-wrap">
        <div className="flex rounded border border-line overflow-hidden">
          {cellModes.map((c) => (
            <button key={c.id} onClick={() => setMode(c.id)} aria-pressed={mode === c.id}
              className={`px-2 py-0.5 ${mode === c.id ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <span className="text-line">|</span>
        {regionOrder.map((r) => (
          <button key={r} onClick={() => toggle(regions, r, setRegions)} aria-pressed={regions.has(r)}
            className={`px-1.5 py-0.5 rounded border ${regions.has(r) ? "border-blue/60 text-text bg-blue/10" : "border-line text-muted"}`}>
            {r}
          </button>
        ))}
        <span className="text-line">|</span>
        {groupOrder.map((g) => (
          <button key={g} onClick={() => toggle(groups, g, setGroups)} aria-pressed={groups.has(g)}
            className={`px-1.5 py-0.5 rounded border ${groups.has(g) ? "border-teal/60 text-text bg-teal/10" : "border-line text-muted"}`}>
            {g}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-3 text-muted">
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />Hide unfunded</label>
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={heat} onChange={(e) => setHeat(e.target.checked)} />RAG colour</label>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-[2px] rag-good inline-block border border-line" />on / ahead
            <i className="w-2.5 h-2.5 rounded-[2px] rag-warn inline-block border border-line" />within 25%
            <i className="w-2.5 h-2.5 rounded-[2px] rag-bad inline-block border border-line" />behind
          </span>
        </span>
      </div>

      {/* Matrix */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }}
        className="panel min-h-0 flex-1 overflow-auto relative"
      >
        <table className="sheet num border-separate border-spacing-0 w-max min-w-full">
          <thead>
            <tr>
              <th className="sh sticky-corner" rowSpan={2}>
                <div className="flex flex-col items-start leading-tight">
                  <span className="font-semibold text-text">Metric</span>
                  <span className="text-[10px] text-muted font-normal">{rows.length} rows × {colIdx.length} countries</span>
                </div>
              </th>
              {regionSpans.map((s, i) => (
                <th key={i} colSpan={s.n} className="sh region text-muted font-medium text-[10px] text-left">{s.region}</th>
              ))}
              <th className="sh region text-muted font-medium text-[10px] text-left" rowSpan={1}>Σ</th>
            </tr>
            <tr>
              {colIdx.map((i) => (
                <th key={i}
                  onClick={() => setPinned(pinned === i ? null : i)}
                  className={`sh country cursor-pointer select-none ${pinned === i ? "pinned" : ""}`}
                  title="Click to highlight column">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-[10px] text-muted">{countries[i].code}</span>
                    <span>{countries[i].name}</span>
                  </div>
                </th>
              ))}
              <th className="sh country total">Total</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {rows.map((m, ri) => {
                const groupStart = ri === 0 || rows[ri - 1].group !== m.group;
                const totE = m.ratio ? derivedTotal(m, colIdx, "expected") : sum(m.expected, colIdx);
                const totA = m.ratio ? derivedTotal(m, colIdx, "actual") : sum(m.actual, colIdx);
                return (
                  <motion.tr key={m.key} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    className={groupStart ? "group-start" : ""}>
                    <td className="sd sticky-col">
                      <div className="flex items-center gap-1.5">
                        {groupStart && <span className="text-[9px] text-muted w-12 shrink-0">{m.group}</span>}
                        {!groupStart && <span className="w-12 shrink-0" />}
                        <span className="text-text">{m.label}</span>
                        <span className="ml-auto text-[9px] text-muted pl-2">{m.dir === -1 ? "↓ better" : m.dir === 1 ? "↑ better" : ""}</span>
                      </div>
                    </td>
                    {colIdx.map((i) => {
                      const e = m.expected[i], a = m.actual[i], d = a - e;
                      const r = rag(m, e, a);
                      return (
                        <td key={i}
                          className={`sd cell ${heat ? ragClass[r] : ""} ${pinned === i ? "pinned" : ""} ${e === 0 && a === 0 ? "empty" : ""}`}
                          title={`${countries[i].name} · ${m.label}\nPlan ${fmtMetric(e, m.format)}\nActual ${fmtMetric(a, m.format)}\nDifference ${fmtMetric(d, m.format, true)}`}>
                          <Cell mode={mode} m={m} e={e} a={a} d={d} />
                        </td>
                      );
                    })}
                    <td className={`sd cell total ${heat && totE !== null && totA !== null ? ragClass[rag(m, totE, totA)] : ""}`}>
                      {totE === null || totA === null ? <span className="text-muted">—</span> : <Cell mode={mode} m={m} e={totE} a={totA} d={totA - totE} />}
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </motion.div>

      <div className="text-[10px] text-muted leading-snug grid grid-cols-2 gap-x-4">
        {notes.map((n) => <p key={n}>{n}</p>)}
      </div>
    </div>
  );
}

function Cell({ mode, m, e, a, d }: { mode: CellMode; m: Metric; e: number; a: number; d: number }) {
  const dCls = m.dir === 0 ? "text-muted" : d * m.dir >= 0 ? "text-up" : "text-down";
  if (mode === "expected") return <span>{fmtMetric(e, m.format)}</span>;
  if (mode === "diff") return <span className={dCls}>{fmtMetric(d, m.format, true)}</span>;
  if (mode === "all")
    return (
      <div className="flex flex-col items-end leading-[1.15]">
        <span className="text-muted text-[10px]">{fmtMetric(e, m.format)}</span>
        <span className="font-medium">{fmtMetric(a, m.format)}</span>
        <span className={`text-[10px] ${dCls}`}>{fmtMetric(d, m.format, true)}</span>
      </div>
    );
  return (
    <div className="flex flex-col items-end leading-[1.15]">
      <span className="font-medium">{fmtMetric(a, m.format)}</span>
      <span className={`text-[10px] ${dCls}`}>{e ? `${d >= 0 ? "+" : ""}${Math.round((d / e) * 100)}%` : "—"}</span>
    </div>
  );
}
