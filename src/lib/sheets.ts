// Periods from src/data/marketing-data.json (built by scripts/build_marketing_data.py from the three workbooks).
// The workbooks state spend and rates per country and platform, not volumes, so the volumes the app needs are backed out:
//   clicks = spend / CPC, leads = spend / CPL, accounts = spend / CPA, funded = spend / CPFA (rounded)
//   first deposits = average account size x funded; total deposits = first deposits + re-deposits (the workbook has no NMI column)
// The workbook's own rates ride along in `sheet` and win wherever the app shows one row or a platform Total, so CPC, CPL, CPA, CPFA,
// average account size and re-deposits read exactly as the workbook states them.
import data from "@/data/marketing-data.json";
import type { Row, SheetMetrics } from "./snapshot";

type MRow = { country: string; platform: string; Spend: number | null; CPC: number | null; CPL: number | null; CPA: number | null; CPFA: number | null; CPAtoCPFA?: number | null; AvgAccountSize: number | null; Redeposit: number | null; TotalNMI: number | null; ROI: number | null };
type MTotal = Omit<MRow, "country" | "platform">;
type MPeriod = { id: string; label: string; from: string; to: string; source: string | string[]; rows: MRow[]; totals: Record<string, MTotal> };

export type SheetPeriod = { id: string; label: string; from: string; to: string; source: string[]; rows: Row[]; totals: Record<string, SheetMetrics> };

const n = (v: number | null | undefined) => v ?? 0;
const r2 = (v: number) => Math.round(v * 100) / 100;

function toRow(r: MRow): Row {
  const spend = n(r.Spend), cpc = n(r.CPC), cpl = n(r.CPL), cpa = n(r.CPA), cpfa = n(r.CPFA), avg = n(r.AvgAccountSize), redep = n(r.Redeposit);
  const funded = cpfa > 0 ? Math.round(spend / cpfa) : 0;
  const ftd = avg * funded;
  const totdep = r.TotalNMI ?? ftd + redep;
  return {
    country: r.country, platform: r.platform, Spend: r2(spend),
    Clicks: cpc > 0 ? Math.round(spend / cpc) : 0, Leads: cpl > 0 ? Math.round(spend / cpl) : 0, Accounts: cpa > 0 ? Math.round(spend / cpa) : 0,
    FundedEvt: funded, FTDAccounts: funded, TotDep: r2(totdep), Redep: r2(totdep - ftd),
    sheet: { CPC: cpc, CPL: cpl, CPA: cpa, CPFA: cpfa, AvgAccountSize: avg, Redeposit: redep, ROI: r.ROI ?? (spend > 0 ? totdep / spend : 0) },
  };
}

/** Platform Total row: the workbook's rates verbatim; ROI from the rows when the workbook has none. */
function toTotal(platform: string, t: MTotal, rows: Row[]): SheetMetrics {
  const mine = rows.filter((x) => x.platform === platform);
  const spend = mine.reduce((s, x) => s + x.Spend, 0), dep = mine.reduce((s, x) => s + x.TotDep, 0);
  return { CPC: n(t.CPC), CPL: n(t.CPL), CPA: n(t.CPA), CPFA: n(t.CPFA), AvgAccountSize: n(t.AvgAccountSize), Redeposit: n(t.Redeposit), ROI: t.ROI ?? (spend > 0 ? dep / spend : 0) };
}

export const SHEET_PERIODS: SheetPeriod[] = ((data as unknown as { actuals: MPeriod[] }).actuals).map((p) => {
  const rows = p.rows.map(toRow);
  const totals: Record<string, SheetMetrics> = {};
  for (const [platform, t] of Object.entries(p.totals ?? {})) totals[platform] = toTotal(platform, t, rows);
  return { id: p.id, label: p.label, from: p.from, to: p.to, source: Array.isArray(p.source) ? p.source : [p.source], rows, totals };
});
export const SHEETS: Record<string, Row[]> = Object.fromEntries(SHEET_PERIODS.map((p) => [p.id, p.rows]));

/** The workbook Total row for a platform, used for the All countries column when every country is in scope. */
export const sheetTotal = (periodId: string, platform: string, from?: string, to?: string): SheetMetrics | undefined =>
  (SHEET_PERIODS.find((p) => p.id === periodId) ?? (from && to ? SHEET_PERIODS.find((p) => p.from === from && p.to === to) : undefined))?.totals[platform];

/** Rows of the workbook period that covers exactly this range, so a quick range (last month) reads the JSON rather than the snapshot. */
export const sheetRowsFor = (from: string, to: string): Row[] | undefined => SHEET_PERIODS.find((p) => p.from === from && p.to === to)?.rows;
