"use client";

import { useMemo } from "react";
import { buildGrid, type Agg, type Period } from "@/lib/engine";
import { fmt, money } from "@/lib/format";
import { EChart, type Option } from "./EChart";
import { Flag } from "./Flag";

// Report palette: Office-style blues; KPI tiles in four shades, darkest first.
export const BLUE = "#2e75b6", BLUE2 = "#1f9dbf";
export const BLUES = ["#1f4e79", "#27649c", "#2e75b6", "#3d8fd6", "#4c9bdd", "#5ba7e5"];
const FONT = { fontFamily: "Inter, sans-serif" };
const short = (v: number) => (v >= 1_000_000 ? "$" + (v / 1_000_000).toFixed(1) + "m" : v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v));

export function hbar(names: string[], values: number[], color: string, isMoney: boolean): Option {
  return {
    animation: false, textStyle: FONT,
    grid: { left: 8, right: 56, top: 6, bottom: 6, containLabel: true },
    xAxis: { type: "value", axisLabel: { color: "#6e6e6e", fontSize: 10, formatter: (v: number) => (isMoney ? short(v) : fmt(v, "n")) }, splitLine: { lineStyle: { color: "#e6e6e6" } } },
    yAxis: { type: "category", data: names, inverse: true, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: "#6e6e6e", fontSize: 10 } },
    series: [{ type: "bar", data: values, barWidth: 16, itemStyle: { color }, label: { show: true, position: "right", color: BLUE, fontWeight: 600, fontSize: 12, formatter: (p: { value: number }) => (isMoney ? money(p.value) : fmt(p.value, "n")) } }],
  };
}

type Props = { agg: Agg; period: Period; chan: string; enabled: Set<string>; chartHeight?: number; svg?: boolean };
type Pick = { name: string; value: string } | undefined;

/** Everything the KPI pieces need: totals, top markets, tile values and best / worst rows. */
function useKpi(agg: Agg, period: Period, chan: string, enabled: Set<string>) {
  const G = useMemo(() => buildGrid(agg, period, chan, enabled), [agg, period, chan, enabled]);
  const tot = G.groups.find((g) => g.tot) ?? G.groups[0];
  const byC = useMemo(() => G.groups.filter((g) => !g.tot && g.name !== "Other" && (g.act.Spend > 0 || g.pl.Spend > 0)).sort((a, b) => b.act.Spend - a.act.Spend), [G]);
  const top = byC.slice(0, 16);
  if (!tot) return null;
  const a = tot.act;
  const tiles = [
    { l: "Spend", v: money(a.Spend), c: BLUES[0] },
    { l: "CPC", v: a.Clicks ? fmt(a.CPC, "$2") : "-", c: BLUES[1] },
    { l: "CPL", v: a.Leads ? fmt(a.CPL, "$2") : "-", c: BLUES[2] },
    { l: "CPA", v: a.LiveAccounts ? fmt(a.CPA, "$2") : "-", c: BLUES[3] },
    { l: "CPFA", v: a.FundedAccounts ? fmt(a.CPFA, "$2") : "-", c: BLUES[4] },
    { l: "Avg account size", v: a.FTDAccounts ? fmt(a.AvgAccountSize, "$2") : "-", c: BLUES[5] },
  ];
  // Four winners among countries with spend. "Meaningful volume" = at least 3 funded accounts, or the most funded any market reached if none has 3.
  const spent = byC.filter((g) => g.act.Spend > 0);
  const funded = spent.filter((g) => g.act.FundedAccounts > 0);
  const minF = Math.min(3, Math.max(1, ...funded.map((g) => g.act.FundedAccounts)));
  const winner = (xs: typeof spent, score: (g: (typeof spent)[number]) => number, value: (g: (typeof spent)[number]) => string): Pick => {
    const best = [...xs].filter((g) => isFinite(score(g)) && score(g) > 0).sort((a, b) => score(b) - score(a))[0];
    return best ? { name: best.name, value: value(best) } : undefined;
  };
  const bwRows: { l: string; sub: string; x: Pick }[] = [
    { l: "Best country", sub: "Lowest CPFA, 3+ funded accounts", x: winner(funded.filter((g) => g.act.FundedAccounts >= minF), (g) => 1 / g.act.CPFA, (g) => fmt(g.act.CPFA, "$0")) },
    { l: "Most valuable country", sub: "Highest avg account size", x: winner(funded, (g) => g.act.AvgAccountSize, (g) => fmt(g.act.AvgAccountSize, "$0")) },
    { l: "Best overall country", sub: "Avg account size ÷ CPFA", x: winner(funded, (g) => g.act.AvgAccountSize / g.act.CPFA, (g) => fmt(g.act.AvgAccountSize / g.act.CPFA, "r")) },
    { l: "Best-converting market", sub: "Funded accounts ÷ leads", x: winner(funded.filter((g) => g.act.Leads > 0), (g) => g.act.LeadToFunded, (g) => fmt(g.act.LeadToFunded, "pct1")) },
  ];
  return { tot, top, tiles, bwRows };
}

/** KPI tile column: spend and the unit costs. */
export function KpiTiles({ agg, period, chan, enabled }: Props) {
  const k0 = useKpi(agg, period, chan, enabled);
  // No market in scope (a continent we do not advertise in): tiles show zero rather than vanish.
  const k = k0 ?? { tiles: ["Spend", "CPC", "CPL", "CPA", "CPFA", "Avg account size"].map((l, i) => ({ l, v: i === 0 ? money(0) : "-", c: BLUES[i] })) };
  return (
    <div className="rtiles">
      {k.tiles.map((t) => <div key={t.l} className="rtile" style={{ background: t.c }}><div className="rtl">{t.l}</div><div className="rtv">{t.v}</div></div>)}
    </div>
  );
}

/** Two bar charts: funded accounts and cost per funded account by market. */
export function KpiCharts({ agg, period, chan, enabled, chartHeight = 600, svg = false }: Props) {
  const k = useKpi(agg, period, chan, enabled);
  if (!k) return null;
  return (
    <>
      <div className="rchart">
        <h3>Funded accounts by country</h3>
        <EChart option={hbar(k.top.map((g) => g.name), k.top.map((g) => g.act.FundedAccounts), BLUE2, false)} height={chartHeight} svg={svg} />
      </div>
      <div className="rchart">
        <h3>Cost per funded account</h3>
        <EChart option={hbar(k.top.map((g) => g.name), k.top.map((g) => Math.round(g.act.CPFA)), BLUE, true)} height={chartHeight} svg={svg} />
      </div>
    </>
  );
}

/** Four winning countries: cheapest funded account, biggest accounts, best value for money, best conversion. Same tile style as the KPI column. */
export function KpiBestWorst({ agg, period, chan, enabled }: Props) {
  const k = useKpi(agg, period, chan, enabled);
  if (!k) return null;
  return (
    <div className="rbw">
      {k.bwRows.map((row, i) => (
        <div key={row.l} className="rtile" style={{ background: BLUES[i] }}>
          <div className="rtl">{row.l}</div>
          <div className="rbws">{row.sub}</div>
          {row.x ? (
            <>
              <div className="rbwn"><Flag country={row.x.name} /><span>{row.x.name}</span></div>
              <div className="rbwv"><small>{row.x.value}</small></div>
            </>
          ) : <div className="rbwv"><span>-</span></div>}
        </div>
      ))}
    </div>
  );
}

/** KPI page body for the HTML report: tile column with summary, two bar charts, best / worst tiles. */
export function KpiBlock(props: Props) {
  return (
    <>
      <div className="rrow1">
        <KpiTiles {...props} />
        <KpiCharts {...props} />
      </div>
      <div className="rrow2"><KpiBestWorst {...props} /></div>
    </>
  );
}
