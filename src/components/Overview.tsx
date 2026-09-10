"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ChartConfiguration } from "chart.js";
import { buildGrid, chanData, derive, statusOf, sumBuckets, type Agg, type Derived, type MonthData, type Period } from "@/lib/engine";
import { CHANNEL_NAMES, COUNTRIES } from "@/lib/plan";
import { fmt, money, type Fmt } from "@/lib/format";
import { ITEM } from "./motion";
import { ChartJS } from "./ChartJS";

type Kpi = { k: keyof Derived; l: string; f: Fmt; dir: "vol" | "cost" };
const KPIS: Kpi[] = [
  { k: "Spend", l: "Spend", f: "$0", dir: "vol" },
  { k: "Leads", l: "Leads", f: "n", dir: "vol" },
  { k: "LiveAccounts", l: "Accounts", f: "n", dir: "vol" },
  { k: "FundedAccounts", l: "Funded", f: "n", dir: "vol" },
  { k: "CPFA", l: "Cost per funded", f: "$2", dir: "cost" },
  { k: "TotalDeposits", l: "Deposits", f: "$0", dir: "vol" },
  { k: "AvgAccountSize", l: "Avg first deposit", f: "$0", dir: "vol" },
  { k: "ROI", l: "Return per $1", f: "r", dir: "vol" },
];
const TRENDS: Kpi[] = KPIS.filter((k) => ["Spend", "FundedAccounts", "TotalDeposits", "ROI"].includes(k.k));

// Trading-screen green and red; brand blues for shares.
const GREEN = "#16a34a", RED = "#dc2626", INK = "#1a1d23", GRID = "#eef1f5", PLAN = "#6b7585";
const PALETTE = ["#2f5d8a", "#467bff", "#75d9d9", "#9aa1ad", "#c9d3e2", "#e3b64b", "#e08a95", "#6fbf8e"];
const rgba = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const short = (v: number, f: Fmt) => {
  if (f === "n") return v >= 1000 ? (v / 1000).toFixed(1) + "k" : String(Math.round(v));
  if (f === "r") return v.toFixed(1);
  if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(1) + "m";
  if (v >= 1000) return "$" + Math.round(v / 1000) + "k";
  return "$" + Math.round(v);
};
const TIP = { backgroundColor: "#fff", borderColor: "#e6e9ee", borderWidth: 1, titleColor: INK, bodyColor: INK, padding: 10 };

/* ---------- chart configs ---------- */
type Pt = { name: string; actual: number; plan: number };

function trendConfig(pts: Pt[], f: Fmt, cost: boolean): ChartConfiguration {
  const above = cost ? RED : GREEN, below = cost ? GREEN : RED;
  return {
    type: "line",
    data: {
      labels: pts.map((p) => p.name),
      datasets: [
        { label: "Actual", data: pts.map((p) => p.actual), borderColor: INK, borderWidth: 1.8, tension: 0.4, pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: INK,
          fill: { target: 1, above: rgba(above, 0.25), below: rgba(below, 0.25) } },
        { label: "Plan", data: pts.map((p) => p.plan), borderColor: PLAN, borderWidth: 1.2, borderDash: [4, 4], tension: 0.4, pointRadius: 0, pointHoverRadius: 0, fill: false },
      ],
    },
    options: {
      animation: false, interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { ...TIP, displayColors: false, callbacks: {
          title: (items) => pts[items[0].dataIndex].name,
          label: (item) => `${item.dataset.label}: ${fmt(Number(item.parsed.y ?? 0), f)}`,
          afterBody: (items) => { const p = pts[items[0].dataIndex]; const d = p.actual - p.plan; return "vs plan: " + (d > 0 ? "+" : "") + fmt(d, f); },
        } },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6, font: { size: 10.5 } } },
        y: { grid: { color: GRID }, border: { display: false }, ticks: { callback: (v) => short(Number(v), f), font: { size: 10.5 }, maxTicksLimit: 5 } },
      },
    },
  };
}

function donutConfig(labels: string[], values: number[], colors: string[], f: Fmt): ChartConfiguration {
  const total = values.reduce((s, v) => s + v, 0) || 1;
  const cfg: ChartConfiguration<"doughnut"> = {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "#fff", borderWidth: 2, hoverOffset: 4 }] },
    options: {
      animation: false, cutout: "68%",
      plugins: {
        legend: { position: "right", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, font: { size: 11.5 }, color: "#5b6270" } },
        tooltip: { ...TIP, callbacks: { label: (item) => ` ${item.label}: ${fmt(Number(item.parsed), f)} (${Math.round((Number(item.parsed) / total) * 100)}%)` } },
      },
    },
  };
  return cfg as unknown as ChartConfiguration;
}

function countryConfig(rows: { name: string; Actual: number; Plan: number }[]): ChartConfiguration {
  return {
    type: "bar",
    data: {
      labels: rows.map((r) => r.name),
      datasets: [
        { label: "Plan", data: rows.map((r) => Math.round(r.Plan)), backgroundColor: "#c9d3e2", borderRadius: 4, borderSkipped: false },
        { label: "Actual", data: rows.map((r) => r.Actual), backgroundColor: rows.map((r) => (r.Actual >= r.Plan ? GREEN : RED)), borderRadius: 4, borderSkipped: false },
      ],
    },
    options: {
      animation: false, interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", align: "end", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, font: { size: 12 } } },
        tooltip: TIP,
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 30, minRotation: 30, autoSkip: false } },
        y: { grid: { color: GRID }, border: { display: false }, beginAtZero: true },
      },
    },
  };
}

/* ---------- component ---------- */
type Props = { agg: Agg; period: Period; chan: string; enabled: Set<string>; months: MonthData[] };

export function Overview({ agg, period, chan, enabled, months }: Props) {
  const G = useMemo(() => buildGrid(agg, period, chan, enabled), [agg, period, chan, enabled]);
  const g = G.groups.find((x) => x.tot) ?? G.groups[0];

  // Donut 1: budget used this period (actual vs remaining plan).
  const budget = useMemo(() => {
    const a = g?.act.Spend ?? 0, e = g?.pl.Spend ?? 0;
    return donutConfig(["Spent", "Left in plan"], [a, Math.max(e - a, 0)], [a > e ? RED : "#2f5d8a", "#e6e9ee"], "$0");
  }, [g]);

  // Donut 2: spend by avenue across selected countries.
  const byAvenue = useMemo(() => {
    const rows = CHANNEL_NAMES.map((ch) => ({ name: ch.replace(" / Google Search", ""), v: sumBuckets(...COUNTRIES.filter((c) => enabled.has(c)).map((c) => agg[ch]?.[c])).Spend }))
      .filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
    return donutConfig(rows.map((r) => r.name), rows.map((r) => r.v), PALETTE, "$0");
  }, [agg, enabled]);

  // Donut 3: funded accounts by country, top 5 + other.
  const byCountryShare = useMemo(() => {
    const d = chanData(agg, chan);
    const rows = COUNTRIES.filter((c) => enabled.has(c)).map((c) => ({ name: c as string, v: d[c]?.FundedAccounts ?? 0 })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
    const top = rows.slice(0, 5), rest = rows.slice(5).reduce((s, r) => s + r.v, 0);
    const labels: string[] = top.map((r) => r.name), values: number[] = top.map((r) => r.v);
    if (rest) { labels.push("Other"); values.push(rest); }
    return donutConfig(labels, values, PALETTE, "n");
  }, [agg, chan, enabled]);

  const byCountry = useMemo(() => G.groups.filter((x) => !x.tot && x.name !== "Other")
    .map((x) => ({ name: x.name, Actual: x.act.FundedAccounts, Plan: x.pl.FundedAccounts })).sort((a, b) => b.Plan - a.Plan), [G]);
  const countryCfg = useMemo(() => countryConfig(byCountry), [byCountry]);

  const series = useMemo(() => months.map((mo) => {
    const mg = buildGrid(mo.agg, mo, chan, enabled);
    const t = mg.groups.find((x) => x.tot) ?? mg.groups[0];
    return { name: mo.label.replace(" MTD", "*"), act: t?.act, pl: t?.pl };
  }), [months, chan, enabled]);
  const trends = useMemo(() => TRENDS.map((m) => ({
    m, config: trendConfig(series.map((s) => ({ name: s.name, actual: s.act?.[m.k] || 0, plan: s.pl?.[m.k] || 0 })), m.f, m.dir === "cost"),
  })), [series]);

  if (!g) return <p className="empty nocountry">No country selected. Pick at least one country to see the overview.</p>;
  const scope = g.name + " · " + chan.replace(" (combined)", "");
  const fundedTotal = derive(sumBuckets(...Object.values(chanData(agg, chan)))).FundedAccounts;

  return (
    <div className="kpis">
      <div className="kpihead">
        <div className="kpititle">{period.label}</div>
        <div className="kpisub">{scope}</div>
      </div>

      {/* Row 1: KPI tiles */}
      <div className="tiles">
        {KPIS.map((m, i) => {
          const e = g.pl[m.k] || 0, a = g.act[m.k] || 0;
          const nospend = m.dir === "cost" && !g.act.Spend;
          const st = nospend ? "" : statusOf(m, e, a);
          const diff = a - e, pct = e ? diff / e : 0;
          const Arrow = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
          return (
            <motion.div key={m.k} className={"tile " + st} {...ITEM(i)}>
              <div className="tl">{m.l}</div>
              <div className="tv">{nospend ? "-" : fmt(a, m.f)}</div>
              <div className="tp">Expected <b>{e ? fmt(e, m.f) : "-"}</b></div>
              <div className={"td " + st}>{e && !nospend ? <><Arrow size={12} aria-hidden="true" />{(diff > 0 ? "+" : "") + fmt(diff, m.f)} ({(pct > 0 ? "+" : "") + Math.round(pct * 100)}%)</> : "-"}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Row 2: donuts */}
      <div className="donuts">
        <div className="ccard">
          <h4>Budget used <span>{money(g.act.Spend)} of {money(g.pl.Spend)}</span></h4>
          <ChartJS config={budget} height={190} />
        </div>
        <div className="ccard">
          <h4>Spend by avenue <span>selected countries</span></h4>
          <ChartJS config={byAvenue} height={190} />
        </div>
        <div className="ccard">
          <h4>Funded accounts by country <span>{fmt(fundedTotal, "n")} total</span></h4>
          <ChartJS config={byCountryShare} height={190} />
        </div>
      </div>

      {/* Row 3: country bars */}
      <div className="ccard">
        <h4>Funded accounts by country <span>{period.label}, actual against plan</span></h4>
        <ChartJS config={countryCfg} height={280} />
      </div>

      {/* Row 4: 12-month trends */}
      <div className="kpigrid trends">
        {trends.map(({ m, config }) => (
          <div key={m.k} className="ccard">
            <h4>{m.l} <span>by month, actual vs plan</span></h4>
            <ChartJS config={config} height={150} />
            <div className="klegend"><span className="ln act" />Actual <span className="ln plan" />Plan <span className="sw g" />Beat plan <span className="sw r" />Missed plan</div>
          </div>
        ))}
      </div>
    </div>
  );
}
