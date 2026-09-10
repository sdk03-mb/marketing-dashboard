"use client";

import { useMemo } from "react";
import { buildGrid, type Agg, type Period } from "@/lib/engine";
import { ALLCH, CHANNEL_NAMES, COUNTRIES } from "@/lib/plan";
import { fmt, money } from "@/lib/format";
import { EChart, type Option } from "./EChart";
import { Flag } from "./Flag";
import { Marks as ChannelIcon } from "./ChannelPicker";

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
type Rank = { key: string; name: string; roi: number; funded: number; spend: number };

/** Everything the KPI pieces need: totals, top markets, tile values and best / worst rows. */
function useKpi(agg: Agg, period: Period, chan: string, enabled: Set<string>) {
  const G = useMemo(() => buildGrid(agg, period, chan, enabled), [agg, period, chan, enabled]);
  const tot = G.groups.find((g) => g.tot) ?? G.groups[0];
  const byC = useMemo(() => G.groups.filter((g) => !g.tot && g.name !== "Other" && (g.act.Spend > 0 || g.pl.Spend > 0)).sort((a, b) => b.act.Spend - a.act.Spend), [G]);
  const top = byC.slice(0, 16);
  const allOn = useMemo(() => new Set<string>(COUNTRIES), []);
  // Avenue totals over every country, for the best / worst avenue tiles.
  const avenues = useMemo(() => CHANNEL_NAMES.flatMap((ch) => {
    const g = buildGrid(agg, period, ch, allOn);
    const t = g.groups.find((x) => x.tot) ?? g.groups[0];
    return t && t.act.Spend > 0 ? [{ key: ch, name: ch.replace(" (combined)", ""), roi: t.act.ROI, funded: t.act.FundedAccounts, spend: t.act.Spend }] : [];
  }), [agg, period, allOn]);
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
  // Best / worst by return per $1 among markets and avenues with spend; funded accounts break ties.
  const rank = (xs: Rank[]) => [...xs].sort((a, b) => b.roi - a.roi || b.funded - a.funded);
  const cRank = rank(byC.filter((g) => g.act.Spend > 0).map((g) => ({ key: g.name, name: g.name, roi: g.act.ROI, funded: g.act.FundedAccounts, spend: g.act.Spend })));
  const aRank = rank(avenues.filter((a) => a.key !== ALLCH));
  const bw = (xs: Rank[]) => ({ best: xs[0], worst: xs.length > 1 ? xs[xs.length - 1] : undefined });
  const bwC = bw(cRank), bwA = bw(aRank);
  const bwRows = [
    { l: "Best country", x: bwC.best, flag: true }, { l: "Worst country", x: bwC.worst, flag: true },
    { l: "Best avenue", x: bwA.best, flag: false }, { l: "Worst avenue", x: bwA.worst, flag: false },
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

/** Best and worst market / avenue by return per $1 spent, same tile style as the KPI column. */
export function KpiBestWorst({ agg, period, chan, enabled }: Props) {
  const k = useKpi(agg, period, chan, enabled);
  if (!k) return null;
  return (
    <div className="rbw">
      {k.bwRows.map((row, i) => (
        <div key={row.l} className="rtile" style={{ background: BLUES[i] }}>
          {/* Avenue logos pinned to the top-right corner. */}
          {row.x && !row.flag && <div className="rcorner"><ChannelIcon chan={row.x.key} /></div>}
          <div className="rtl">{row.l}</div>
          {row.x ? (
            <>
              <div className="rbwn">{row.flag && <Flag country={row.x.name} />}<span>{row.x.name}</span></div>
              <div className="rbwv"><small>{money(row.x.spend)} spent</small></div>
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
