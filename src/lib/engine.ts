import { ALLCH, CHANNELS, CHANNEL_NAMES, COUNTRIES, PLAN, PLAN_CONV } from "./plan";
import { SNAPSHOT, type Row, type SheetMetrics } from "./snapshot";
import { SHEETS, SHEET_PERIODS, sheetTotal } from "./sheets";
import { fmt, money, signed, type Fmt } from "./format";

/* ---------------- types ---------------- */
export type BucketNums = {
  Spend: number; Impressions: number; Clicks: number; Leads: number; LiveAccounts: number; FundedAccounts: number;
  TotalDeposits: number; FTD: number; FTDAccounts: number;
};
/** `sheet` survives only while a bucket is exactly one workbook row; any merge drops it and the ratios are recomputed. */
export type Bucket = BucketNums & { sheet?: SheetMetrics; n?: number };
export type Derived = BucketNums & {
  CPC: number; CPL: number; CPA: number; CPFA: number; Ratio: number;
  AvgAccountSize: number; Redeposit: number; ROI: number; Conv: number;
  CTR: number; LeadToAcct: number; LeadToFunded: number;
  /** Share of the group total spend; filled in by buildGrid. */
  SpendPct: number;
};
export const PLAN_CTR = 0.08; // PPC plan CTR (14,286 clicks on 178,571 impressions in the August plan)
export type Agg = Record<string, Record<string, Bucket>>; // channel -> country -> bucket
export type Cadence = "Daily" | "Weekly" | "Monthly";
export type Period = {
  id: string; label: string; full: string; from: Date; to: Date; pace: number; cadence: Cadence;
};
export type Cal = {
  today: Date; yest: Date; wk: Date; curStart: Date; prevStart: Date; prevEnd: Date; mtdEnd: Date;
  periods: Period[];
};
export type Hist = { prev: Agg; mtd: Agg };
export type MonthData = Period & { agg: Agg };

export const emptyBucket = (): Bucket => ({
  Spend: 0, Impressions: 0, Clicks: 0, Leads: 0, LiveAccounts: 0, FundedAccounts: 0, TotalDeposits: 0, FTD: 0, FTDAccounts: 0,
});
const BUCKET_KEYS = Object.keys(emptyBucket()) as (keyof BucketNums)[];

/* ---------------- re-deposit switch ---------------- */
// Off means every deposit figure counts first deposits only: TotalDeposits = FTD, Redeposit = 0, ROI on first deposits. Plan follows the same rule.
let REDEP = true;
export const setRedeposits = (on: boolean) => { REDEP = on; };
export const redepositsOn = () => REDEP;
export function stripRedeposits(agg: Agg): Agg {
  const out: Agg = {};
  for (const [ch, byC] of Object.entries(agg)) {
    out[ch] = {};
    for (const [c, b] of Object.entries(byC))
      out[ch][c] = { ...b, TotalDeposits: b.FTD, sheet: b.sheet ? { ...b.sheet, Redeposit: 0, ROI: b.Spend > 0 ? b.FTD / b.Spend : 0 } : undefined };
  }
  return out;
}

/* ---------------- dates ---------------- */
export const mName = (d: Date) => d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
export const dLbl = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const dim = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
export const iso = (d: Date) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const cadenceFor = (n: number, id?: string): Cadence =>
  id === "day" ? "Daily" : id === "wk" ? "Weekly" : id ? "Monthly" : n <= 1 ? "Daily" : n <= 10 ? "Weekly" : "Monthly";

export function makeCal(now = new Date()): Cal {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const wk = new Date(today); wk.setDate(wk.getDate() - 7);
  const curStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const mtdEnd = yest >= curStart ? yest : curStart;
  const mk = (id: string, label: string, full: string, from: Date, to: Date): Period => ({
    id, label, full, from, to, pace: daysBetween(from, to) / dim(from), cadence: cadenceFor(0, id),
  });
  // Workbook periods first: the exports are the freshest numbers and the default view.
  const sheets = SHEET_PERIODS.map((sp) => {
    const f = new Date(sp.from + "T00:00:00"), t = new Date(sp.to + "T00:00:00");
    return mk(sp.id, sp.label, dLbl(f) + "-" + dLbl(t) + " " + t.getFullYear(), f, t);
  });
  const periods = [
    ...sheets,
    mk("mtd", mName(curStart) + " MTD", "1-" + dLbl(mtdEnd), curStart, mtdEnd),
    mk("prev", mName(prevStart), "full month", prevStart, prevEnd),
    mk("day", "Yesterday", dLbl(yest), yest, yest),
    mk("wk", "Last 7 days", dLbl(wk) + "-" + dLbl(yest), wk, yest),
  ];
  return { today, yest, wk, curStart, prevStart, prevEnd, mtdEnd, periods };
}

export function periodFor(cal: Cal, from: string, to: string): Period {
  const hit = cal.periods.find((p) => iso(p.from) === from && iso(p.to) === to);
  if (hit) return hit;
  const f = new Date(from + "T00:00:00"), t = new Date(to + "T00:00:00"), n = daysBetween(f, t);
  return {
    id: "c_" + from + "_" + to,
    label: n === 1 ? dLbl(f) : dLbl(f) + " - " + dLbl(t),
    full: dLbl(f) + "-" + dLbl(t),
    from: f, to: t, pace: n / dim(f), cadence: cadenceFor(n),
  };
}

/** Last N calendar months including current MTD; reuses quick-range ids where they match. */
export function monthPeriods(cal: Cal, count = 3): Period[] {
  const out: Period[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const s = new Date(cal.today.getFullYear(), cal.today.getMonth() - i, 1);
    const e = i === 0 ? cal.mtdEnd : new Date(cal.today.getFullYear(), cal.today.getMonth() - i + 1, 0);
    const hit = cal.periods.find((p) => (p.id === "prev" || p.id === "mtd") && +p.from === +s);
    const base: Period = hit ?? { id: "m_" + iso(s), label: "", full: "", from: s, to: e, pace: daysBetween(s, e) / dim(s), cadence: "Monthly" };
    out.push({ ...base, label: s.toLocaleDateString("en-GB", { month: "short" }) + (base.id === "mtd" ? " MTD" : "") });
  }
  return out;
}

/* ---------------- data loading ---------------- */
const MODEL_B = "7785fb34-8f46-479c-8a6f-aed57c90b26c";
const TOOL = "mcp__6f82d968-caf4-4327-a8ab-503874be5619__execute_dax";

type McpResult = { isError?: boolean; structuredContent?: unknown; content: { text: string }[] };
declare global {
  interface Window { cowork?: { callMcpTool: (tool: string, args: Record<string, unknown>) => Promise<McpResult> } }
}
export const hasLive = () => typeof window !== "undefined" && !!window.cowork;
export const hasSnapshot = (id: string) => !!SNAPSHOT[id] || !!SHEETS[id];

async function dax(model: string, q: string, attempt = 0): Promise<Record<string, unknown>[]> {
  try {
    if (!window.cowork) throw new Error("No live Power BI connection in this environment");
    const r = await window.cowork.callMcpTool(TOOL, { semantic_model_id: model, dax_query: q, row_limit: 5000 });
    const p = (r.structuredContent ?? JSON.parse(r.content[0].text)) as { rows?: Record<string, unknown>[] } | string;
    if (r.isError) throw new Error((typeof p === "string" ? p : JSON.stringify(p)).slice(0, 200));
    return (typeof p === "object" && p.rows) || [];
  } catch (e) {
    if (!attempt) { await new Promise((res) => setTimeout(res, 1500)); return dax(model, q, 1); }
    throw e;
  }
}

function dateFilter(p: Period) {
  const f = p.from, t = p.to;
  return "FILTER(ALL('Date Table'[Date]), 'Date Table'[Date] >= DATE(" + f.getFullYear() + "," + (f.getMonth() + 1) + "," + f.getDate() +
    ") && 'Date Table'[Date] <= DATE(" + t.getFullYear() + "," + (t.getMonth() + 1) + "," + t.getDate() + "))";
}

// Filters validated 8 Sep 2026 against the PPC/Social Cohort and Non-Cohort exports from the Daily MW Report (exact match on Aug data).
const LEAD_FILTERS =
  "FILTER(ALL('Leads (Master)'[Source]), NOT CONTAINSSTRING('Leads (Master)'[Source], \"expo\")), " +
  "FILTER(ALL('Leads (Master)'[Business_Source]), 'Leads (Master)'[Business_Source] = \"Marketing\"), " +
  "FILTER(ALL('Leads (Master)'[Sales Desk]), 'Leads (Master)'[Sales Desk] <> \"BDT - BUISNESS DEVELOPMENT TEAM\"), " +
  "FILTER(ALL('UTM Campaigns'[Campaign]), NOT CONTAINSSTRING('UTM Campaigns'[Campaign], \"demo-competition\"))";

const PLATFORM_GROUPS = '{"Apple Search","Google App","Google DemandGen","Google Discovery","Google Display","Google Managed Placements","Google Others","Google Performance Max","Google Search","YouTube","Bing Search","Facebook & Instagram","LinkedIn","Snapchat","TikTok","Twitter"}';

function daxQuery(p: Period) {
  return "EVALUATE FILTER(SUMMARIZECOLUMNS('UTM Campaigns'[Actual_country], 'Marketing Platform'[Marketing_Platform], " + dateFilter(p) +
    ", TREATAS(" + PLATFORM_GROUPS + ", 'Marketing Platform'[Marketing_Platform (groups)]), " +
    "FILTER(ALL('UTM Campaigns'[Actual_country]), NOT ISBLANK('UTM Campaigns'[Actual_country])), " +
    "FILTER(ALL('UTM Campaigns'[Campaign Category]), 'UTM Campaigns'[Campaign Category] <> \"Remarketing\"), " + LEAD_FILTERS +
    ", \"Spend\", [Cost Total], \"Clicks\", [Total Clicks Adjust/Legacy], \"Leads\", [Leads Total No Filter], \"Accounts\", [Total Accounts], " +
    "\"FundedEvt\", [Total Funded (EventDate)], \"TotDep\", [Deposits Total by Transaction Date (Country Breakdown)], \"Redep\", [Redeposit], " +
    // TODO: confirm the impressions measure name in the semantic model; unverified against the Daily MW Report.
    "\"Impressions\", [Total Impressions]), " +
    "[Spend] > 0 || [Leads] > 0 || [TotDep] <> 0)";
}

function rowsFromDax(raw: Record<string, unknown>[]): Row[] {
  const n = (v: unknown) => (typeof v === "number" ? v : 0);
  return raw.map((r) => ({
    country: String(r["UTM Campaigns[Actual_country]"] ?? ""),
    platform: String(r["Marketing Platform[Marketing_Platform]"] ?? ""),
    Spend: n(r["[Spend]"]), Clicks: n(r["[Clicks]"]), Leads: n(r["[Leads]"]), Accounts: n(r["[Accounts]"]),
    FundedEvt: n(r["[FundedEvt]"]), TotDep: n(r["[TotDep]"]), Redep: n(r["[Redep]"]),
    Impressions: n(r["[Impressions]"]),
  }));
}

const CHAN_OF: Record<string, string> = {};
for (const [chan, plats] of Object.entries(CHANNELS)) for (const pl of plats) CHAN_OF[pl] = chan;

export function aggregate(rows: Row[]): Agg {
  const agg: Agg = {};
  for (const chan of CHANNEL_NAMES) agg[chan] = {};
  for (const r of rows) {
    const ch = CHAN_OF[r.platform]; if (!ch) continue;
    const c = (COUNTRIES as readonly string[]).includes(r.country) ? r.country : "Other";
    const b = (agg[ch][c] ??= emptyBucket());
    b.Spend += r.Spend; b.Impressions += r.Impressions ?? 0; b.Clicks += r.Clicks; b.Leads += r.Leads;
    b.LiveAccounts += r.Accounts; b.FundedAccounts += r.FundedEvt;
    b.TotalDeposits += r.TotDep; b.FTD += r.TotDep - r.Redep; b.FTDAccounts += r.FTDAccounts ?? r.FundedEvt;
    b.n = (b.n ?? 0) + 1;
    b.sheet = b.n === 1 ? r.sheet : undefined;
  }
  return agg;
}

export async function loadPeriod(p: Period, cache: Record<string, Agg>): Promise<Agg> {
  if (cache[p.id]) return cache[p.id];
  const rows = SNAPSHOT[p.id] ?? SHEETS[p.id] ?? rowsFromDax(await dax(MODEL_B, daxQuery(p)));
  return (cache[p.id] = aggregate(rows));
}

/* ---------------- derived metrics ---------------- */
export function derive(b?: Bucket | null): Derived {
  if (b?.sheet) return withSheet(derive({ ...b, sheet: undefined }), b.sheet);
  const x = b ?? emptyBucket();
  const CPFA = x.FundedAccounts > 0 ? x.Spend / x.FundedAccounts : 0;
  const CPA = x.LiveAccounts > 0 ? x.Spend / x.LiveAccounts : 0;
  return {
    ...x,
    CPC: x.Clicks > 0 ? x.Spend / x.Clicks : 0,
    CPL: x.Leads > 0 ? x.Spend / x.Leads : 0,
    CPA, CPFA,
    Ratio: CPFA > 0 ? CPA / CPFA : 0,
    AvgAccountSize: x.FTDAccounts > 0 ? x.FTD / x.FTDAccounts : 0,
    Redeposit: x.TotalDeposits - x.FTD,
    ROI: x.Spend > 0 ? x.TotalDeposits / x.Spend : 0,
    Conv: x.LiveAccounts > 0 ? x.FundedAccounts / x.LiveAccounts : 0,
    CTR: x.Impressions > 0 ? x.Clicks / x.Impressions : 0,
    LeadToAcct: x.Leads > 0 ? x.LiveAccounts / x.Leads : 0,
    LeadToFunded: x.Leads > 0 ? x.FundedAccounts / x.Leads : 0,
    SpendPct: 0,
  };
}

/** Sheet figures win over recomputed ones: the workbook is the master where a bucket is one of its rows or its Total. */
export function withSheet(d: Derived, sh?: SheetMetrics): Derived {
  if (!sh) return d;
  return { ...d, CPC: sh.CPC, CPL: sh.CPL, CPA: sh.CPA, CPFA: sh.CPFA, Ratio: sh.CPFA > 0 ? sh.CPA / sh.CPFA : 0, AvgAccountSize: sh.AvgAccountSize, Redeposit: sh.Redeposit, ROI: sh.ROI };
}

export function sumBuckets(...bs: (Bucket | undefined | null)[]): Bucket {
  const o = emptyBucket();
  for (const b of bs) if (b) for (const k of BUCKET_KEYS) o[k] += b[k] || 0;
  return o;
}

export function chanData(agg: Agg, chan: string): Record<string, Bucket> {
  if (chan !== ALLCH) return agg[chan] || {};
  const out: Record<string, Bucket> = {};
  for (const byC of Object.values(agg))
    for (const [c, b] of Object.entries(byC)) out[c] = sumBuckets(out[c], b);
  return out;
}

/* ---------------- plan ---------------- */
const VOL_KEYS: (keyof Derived)[] = ["Spend", "Impressions", "Clicks", "Leads", "LiveAccounts", "FundedAccounts", "FTD", "Redeposit", "TotalDeposits", "FTDAccounts"];

export function planRaw(chan: string, ctry: string): Derived {
  type Src = Partial<Derived> & { Spend: number };
  let src: Src | null = null;
  if (chan === ALLCH) {
    const a = PLAN.PPC[ctry], b = PLAN.Social[ctry];
    if (a || b) {
      const s: Src = { Spend: 0 };
      for (const k of ["Spend", "Leads", "LiveAccounts", "FundedAccounts", "FTD", "Redeposit", "TotalDeposits"] as const)
        s[k] = (a?.[k] || 0) + (b?.[k] || 0);
      s.Clicks = (a?.Spend || 0) / 7 + (b?.Spend || 0) / 1;
      s.CPL = s.Leads ? s.Spend / s.Leads : 0;
      s.CPA = s.LiveAccounts ? s.Spend / s.LiveAccounts : 0;
      s.CPFA = s.FundedAccounts ? s.Spend / s.FundedAccounts : 0;
      s.AvgAccountSize = s.FundedAccounts ? (s.FTD || 0) / s.FundedAccounts : 0;
      src = s;
    }
  } else if (chan === "PPC / Google Search") src = PLAN.PPC[ctry] ?? null;
  else if (chan === "Instagram + Facebook") src = PLAN.Social[ctry] ?? null;
  if (!src) return derive(null);
  const p: Derived = { ...derive(null), ...src };
  if (src.Clicks === undefined) p.Clicks = p.Spend / (chan === "Instagram + Facebook" ? 1 : 7);
  // Plan impressions exist for the PPC share only (plan CTR 8%); social has no impression target.
  const ppcSpend = chan === ALLCH ? (PLAN.PPC[ctry]?.Spend || 0) : chan === "PPC / Google Search" ? p.Spend : 0;
  p.Impressions = ppcSpend / 7 / PLAN_CTR;
  p.CPC = p.Clicks > 0 ? p.Spend / p.Clicks : 0;
  p.FTDAccounts = p.FundedAccounts;
  p.Ratio = p.CPFA > 0 ? p.CPA / p.CPFA : 0;
  if (!REDEP) { p.Redeposit = 0; p.TotalDeposits = p.FTD; }
  p.ROI = p.Spend > 0 ? p.TotalDeposits / p.Spend : 0;
  p.Conv = p.LiveAccounts > 0 ? p.FundedAccounts / p.LiveAccounts : 0;
  p.CTR = p.Impressions > 0 ? (ppcSpend / 7) / p.Impressions : 0; // PPC clicks over PPC impressions
  p.LeadToAcct = p.Leads > 0 ? p.LiveAccounts / p.Leads : 0;
  p.LeadToFunded = p.Leads > 0 ? p.FundedAccounts / p.Leads : 0;
  return p;
}

/** Plan prorated by `f` (share of the month covered by the window). */
export function planFor(chan: string, ctry: string, f?: number): Derived {
  const p = planRaw(chan, ctry);
  if (!f || f === 1) return p;
  const q = { ...p };
  for (const k of VOL_KEYS) if (q[k]) q[k] *= f;
  return q;
}

/* ---------------- performance grid ---------------- */
export type MetricDef = { k: keyof Derived; l: string; f: Fmt; dir: "vol" | "cost" | "none"; group: string };
// Same eight rows as the MB Marketing Dashboard (index.html), plus ROI.
export const METRICS: MetricDef[] = [
  { k: "Spend", l: "Spend $", f: "$2", dir: "vol", group: "" },
  { k: "CPC", l: "CPC $", f: "$2", dir: "cost", group: "" },
  { k: "CPL", l: "CPL $", f: "$2", dir: "cost", group: "" },
  { k: "CPA", l: "CPA $", f: "$2", dir: "cost", group: "" },
  { k: "CPFA", l: "CPFA $", f: "$2", dir: "cost", group: "" },
  { k: "Ratio", l: "CPA / CPFA", f: "r", dir: "none", group: "" },
  { k: "AvgAccountSize", l: "Avg Account Size $", f: "$2", dir: "vol", group: "" },
  { k: "Redeposit", l: "Redeposit Total $", f: "$2", dir: "vol", group: "" },
  { k: "ROI", l: "ROI % (NMI)", f: "pct", dir: "vol", group: "" },
];
/** Metrics that need impression data, which only the live query provides. */
const NEEDS_IMPRESSIONS = new Set<keyof Derived>(["Impressions", "CTR"]);

export type Status = "" | "good" | "warn" | "bad";
export function statusOf(m: { dir: "vol" | "cost" | "none" }, exp: number, act: number): Status {
  if (!exp || m.dir === "none") return "";
  if (m.dir === "cost") { if (!act) return ""; return act <= exp ? "good" : act <= exp * 1.5 ? "warn" : "bad"; }
  const pct = act / exp;
  return pct >= 0.9 ? "good" : pct >= 0.6 ? "warn" : "bad";
}

export type GridGroup = { name: string; tot: boolean; act: Derived; pl: Derived };
export type GridCell = { a: number; e: number; diff: number; status: Status; na: boolean; nospend: boolean; nodata: boolean };
export type Grid = { groups: GridGroup[]; rows: { m: MetricDef; cells: GridCell[] }[] };

export function buildGrid(agg: Agg, p: Period, chan: string, enabled: Set<string>): Grid {
  const data = chanData(agg, chan);
  const hasAct = (c: string) => { const b = data[c]; return !!b && (b.Spend > 0 || b.Leads > 0 || b.TotalDeposits !== 0); };
  const cols: string[] = COUNTRIES.filter((c) => enabled.has(c) && (hasAct(c) || planFor(chan, c).Spend > 0));
  if ("Other" in data && enabled.has("Other")) cols.push("Other");
  let tot = emptyBucket(), totP = emptyBucket();
  for (const c of cols) { tot = sumBuckets(tot, data[c]); totP = sumBuckets(totP, planFor(chan, c, p.pace)); }
  const allOn = COUNTRIES.every((c) => enabled.has(c));
  const groups: GridGroup[] = cols.map((c) => ({ name: c, tot: false, act: derive(data[c]), pl: planFor(chan, c, p.pace) }));
  // Total group only when it adds information (two or more countries).
  const plats = CHANNELS[chan] ?? [];
  const totSheet = allOn && plats.length === 1 ? sheetTotal(p.id, plats[0]) : undefined;
  if (cols.length > 1) groups.unshift({ name: allOn ? "All countries" : "Selected countries", tot: true, act: withSheet(derive(tot), totSheet), pl: derive(totP) });
  // Spent % = share of the group total (total row is 100% by definition).
  for (const g of groups) {
    g.act.SpendPct = tot.Spend > 0 ? g.act.Spend / tot.Spend : 0;
    g.pl.SpendPct = totP.Spend > 0 ? g.pl.Spend / totP.Spend : 0;
  }
  const rows = METRICS.map((m) => ({
    m,
    cells: groups.map((g): GridCell => {
      const a = g.act[m.k] || 0, e = g.pl[m.k] || 0;
      const na = m.dir === "cost" && g.act.Spend > 0 && !(a > 0);
      const nodata = NEEDS_IMPRESSIONS.has(m.k) && g.act.Impressions === 0;
      return { a, e, diff: a - e, status: na ? "bad" : nodata ? "" : statusOf(m, e, a), na, nospend: m.dir === "cost" && !g.act.Spend, nodata };
    }),
  }));
  return { groups, rows };
}

/* ---------------- recommendations ---------------- */
export type RecRow = Derived & { chan: string; chanS: string; c: string; kind: "stop" | "grow" };

const bucketOf = (agg: Agg | undefined, chan: string, c: string) => agg?.[chan]?.[c];
const histOf = (hist: Hist, chan: string, c: string) => derive(sumBuckets(bucketOf(hist.prev, chan, c), bucketOf(hist.mtd, chan, c)));
const mtdSpend = (hist: Hist, chan: string, c: string) => bucketOf(hist.mtd, chan, c)?.Spend ?? 0;

export function recRows(agg: Agg, p: Period, hist: Hist, enabled: Set<string>): RecRow[] {
  const rows: RecRow[] = [];
  const minSpend = p.cadence === "Daily" ? 300 : 1500;
  for (const [chan, byC] of Object.entries(agg)) for (const [c, b] of Object.entries(byC)) {
    if (c === "Other" || !enabled.has(c)) continue;
    const d = derive(b); if (d.Spend < minSpend) continue;
    let stop = d.FundedAccounts === 0 || d.ROI < 0.3, grow = d.FundedAccounts > 0 && d.ROI >= 1;
    if (p.cadence === "Daily") { const H = histOf(hist, chan, c); stop = stop && (H.FundedAccounts === 0 || H.ROI < 0.5); grow = grow && H.ROI >= 1; }
    if (stop || grow) rows.push({ chan, chanS: chan.replace(" / Google Search", ""), c, ...d, kind: stop ? "stop" : "grow" });
  }
  return rows;
}

export type GivenRow = { label: string; e: number; a: number | null; f: Fmt; status: Status; diff: string };
export type Cta = { verb: string; text: string }; // text uses **bold** markers
export type FixNode = { name: string; tone?: "bad" | "warn" | "good" | "dept"; children?: FixNode[] };
export type ChartPoint = { label: string; actual: number; plan: number };
export type CardModel = {
  why: string; given: GivenRow[]; reasoning: string[]; actions: Cta[];
  /** Mindmap: market at the root, one branch per department with short tasks. */
  fixTree: FixNode;
  /** Mermaid flowchart source: funnel from spend to deposits with plan values and a verdict. */
  mermaid: string;
  spend: ChartPoint[]; funded: ChartPoint[]; monthsMissing: boolean;
};

export function buildCard(r: RecRow, p: Period, cal: Cal, hist: Hist, months: MonthData[]): CardModel {
  const plan = planRaw(r.chan, r.c), pp = planFor(r.chan, r.c, p.pace), H = histOf(hist, r.chan, r.c);
  const winDays = daysBetween(p.from, p.to), histFrom = dLbl(cal.prevStart);
  const daily = r.Spend / winDays, headroom = Math.max(plan.Spend - mtdSpend(hist, r.chan, r.c), 0);
  const review = new Date(cal.yest);
  review.setDate(review.getDate() + (p.cadence === "Daily" ? 3 : p.cadence === "Weekly" ? 7 : 14));
  const rev = dLbl(review);
  const win = p.cadence === "Daily" ? "yesterday" : "over " + winDays + " days (" + p.full + ")";
  const name = r.c + " " + r.chanS;
  const n = (v: number) => fmt(v, "n");

  // Quote-style headline: "We spent X but only achieved Y accounts with average funding Z."
  const avgFund = r.FundedAccounts > 0 ? r.TotalDeposits / r.FundedAccounts : 0;
  let why: string;
  if (r.kind === "stop" && r.FundedAccounts === 0) why = "We spent " + money(r.Spend) + " " + win + " but achieved no funded accounts.";
  else if (r.kind === "stop") why = "We spent " + money(r.Spend) + " " + win + " but only achieved " + n(r.FundedAccounts) + " funded account" + (r.FundedAccounts > 1 ? "s" : "") + " with average funding of " + money(avgFund) + ".";
  else why = "We spent " + money(r.Spend) + " " + win + " and achieved " + n(r.FundedAccounts) + " funded account" + (r.FundedAccounts > 1 ? "s" : "") + " with average funding of " + money(avgFund) + ", returning $" + r.ROI.toFixed(2) + " per $1.";

  const raw: [string, number, number | null, Fmt][] = [
    ["Spend", pp.Spend, r.Spend, "$0"],
    ["Leads", pp.Leads, r.Leads, "n"],
    ["Live accounts", pp.LiveAccounts, r.LiveAccounts, "n"],
    ["Funded accounts", pp.FundedAccounts, r.FundedAccounts, "n"],
    ["Cost per funded account", plan.CPFA, r.FundedAccounts ? r.CPFA : null, "$2"],
    ["Account → funded", PLAN_CONV, r.Conv, "pct"],
    ["Deposits", pp.TotalDeposits, r.TotalDeposits, "$0"],
    ["ROI (deposits ÷ spend)", plan.Spend ? pp.TotalDeposits / pp.Spend : 0, r.ROI, "r"],
  ];
  const given: GivenRow[] = raw.map(([label, e, a, f]) => {
    const dir = label.startsWith("Cost") ? "cost" : "vol";
    const status: Status = a === null ? "bad" : statusOf({ dir }, e, a);
    // diff is actual - expected: "+" means above plan
    return { label, e, a, f, status, diff: a === null ? "-" : e ? signed(a - e, f) : "-" };
  });

  // One idea per bullet.
  const R: string[] = [];
  // **markers** bold the key figures when rendered.
  if (plan.Spend) {
    R.push("Expected " + win + ": **" + money(pp.Spend) + "** spend for about **" + n(pp.FundedAccounts) + " funded accounts** at " + money(plan.CPFA) + " each.");
  } else R.push(name + " has **no budget in the plan**, so every dollar here is unplanned spend.");
  R.push("Actual spend: **" + money(r.Spend) + "**" + (plan.Spend ? " (**" + fmt(r.Spend / pp.Spend, "pct") + "** of the expected pace)." : "."));
  R.push("**" + n(r.Leads) + "** people left their details and **" + n(r.LiveAccounts) + "** opened accounts.");
  R.push(r.FundedAccounts ? "**" + n(r.FundedAccounts) + "** of those accounts deposited." : "**None** of those accounts deposited.");
  if (r.LiveAccounts) {
    R.push("At the planned 30% conversion, " + n(r.LiveAccounts) + " accounts should have given about **" + n(Math.round(r.LiveAccounts * PLAN_CONV)) + " funded**.");
    R.push("Actual conversion: **" + n(r.FundedAccounts) + " funded (" + fmt(r.Conv, "pct") + ")**.");
    R.push(r.Conv < PLAN_CONV * 0.7 ? "The problem is **conversion after sign-up**, not traffic." : "Conversion is close to plan; the question is **deposit size and cost**.");
  }
  if (r.FundedAccounts) {
    R.push("Each funded account cost **" + money(r.CPFA) + "**, **" + fmt(plan.CPFA ? r.CPFA / plan.CPFA : 0, "x") + "** the target" + (plan.CPFA ? " of " + money(plan.CPFA) : "") + ".");
    R.push("They deposited **" + money(r.TotalDeposits) + "**, so every $1 spent returned **$" + r.ROI.toFixed(2) + "**" + (r.ROI >= 1 ? ", above breakeven." : ", below the $1 breakeven."));
  } else {
    R.push("With **no funded account** the cost per funded account is undefined.");
    R.push("The return on **" + money(r.Spend) + "** is **zero**.");
  }
  R.push(r.kind === "grow" ? "Verdict: this market **pays back**, so it earns more budget." : r.FundedAccounts === 0 ? "Verdict: money in, **nothing out**, so spending **stops**." : "Verdict: money in is far more than money out, so spending **shrinks**.");

  const A: Cta[] = [];
  const cta = (verb: string, text: string) => A.push({ verb, text });
  // Each action is a complete sentence; the verb is only a label.
  if (r.kind === "stop" && r.FundedAccounts === 0 && H.FundedAccounts === 0) {
    cta("PAUSE", "Pause " + name + " from tomorrow, taking the daily budget from **" + money(daily) + "** to **$0**.");
    cta("REALLOCATE", "Move the remaining **" + money(headroom) + "** of this month's " + name + " budget to the markets on the Spend more list.");
    cta("RESEARCH", "Before any re-entry, check whether a CFD audience exists for " + r.c + " on " + r.chanS + ": search demand, competitor ads, payment methods and landing-page language.");
    cta("RE-TEST", "Re-enter only with a capped pilot of **" + money(Math.max(Math.round(plan.Spend * 0.1 / 100) * 100, 500)) + "** and a target of at least " + Math.max(1, Math.round(plan.FundedAccounts * 0.1)) + " funded account" + (Math.max(1, Math.round(plan.FundedAccounts * 0.1)) > 1 ? "s" : "") + " within 30 days.");
  } else if (r.kind === "stop" && r.FundedAccounts === 0) {
    cta("REDUCE", "Cut " + name + " from **" + money(daily) + "** per day to **" + money(daily * 0.25) + "** per day.");
    cta("KEEP", "Keep only the campaigns that produced the " + n(H.FundedAccounts) + " funded account" + (H.FundedAccounts > 1 ? "s" : "") + " since " + histFrom + ", and pause everything else.");
    cta("REALLOCATE", "Move the freed **" + money(daily * 0.75) + "** per day to the markets on the Spend more list.");
  } else if (r.kind === "stop") {
    cta("REDUCE", "Cut " + name + " from **" + money(daily) + "** per day to **" + money(daily * 0.5) + "** per day.");
    cta("KEEP", "Keep only the campaigns behind the " + n(r.FundedAccounts) + " funded accounts, and pause everything else.");
    cta("CHECK", "Check deposit size: the average first deposit was **" + money(r.AvgAccountSize) + "** against **" + money(plan.AvgAccountSize) + "** planned. Small deposits point to the wrong audience, not the wrong channel.");
  } else {
    const daysLeft = Math.max(dim(cal.today) - cal.mtdEnd.getDate(), 1);
    const up = Math.min(daily * 1.3, headroom > 0 ? headroom / daysLeft : daily * 1.3);
    const oneBig = r.FundedAccounts > 0 && r.TotalDeposits / r.FundedAccounts > 50000;
    cta("INCREASE", "Raise " + name + " from **" + money(daily) + "** per day to **" + money(up) + "** per day.");
    cta("FUND", "Fund the increase from the Stop spending list. Headroom to this month's plan is **" + money(headroom) + "**.");
    cta("WATCH", oneBig
      ? "Judge the scale-up on account-to-funded conversion (" + fmt(r.Conv, "pct") + " against 30% planned), not on deposits, because one client makes up most of the " + money(r.TotalDeposits) + "."
      : "As spend rises, watch account-to-funded conversion (" + fmt(r.Conv, "pct") + " against 30% planned) and cost per funded account (" + money(r.CPFA) + " against " + money(plan.CPFA) + ").");
  }
  cta("REVIEW", "Review the result on **" + rev + "**.");

  const spend: ChartPoint[] = [], funded: ChartPoint[] = [];
  for (const m of months) {
    const d = derive(sumBuckets(bucketOf(m.agg, r.chan, r.c))), pl = planFor(r.chan, r.c, m.pace);
    spend.push({ label: m.label, actual: d.Spend, plan: pl.Spend });
    funded.push({ label: m.label, actual: d.FundedAccounts, plan: pl.FundedAccounts });
  }
  // Funnel flowchart: each node shows actual over plan; red where below plan, green where at/above.
  const tone = (a: number, e: number, cost = false) => {
    const s = statusOf({ dir: cost ? "cost" : "vol" }, e, a);
    return s === "good" ? "good" : s === "warn" ? "warn" : s === "bad" ? "bad" : "flat";
  };
  const node = (id: string, title: string, actual: string, plan: string) => id + '["&nbsp;<b>' + title + '</b>&nbsp;<br/>' + actual + '<br/><span class=plan>plan ' + plan + '</span>"]';
  // Verdict uses the same three-line rectangle as every other node.
  const verdictNode = r.kind === "grow"
    ? node("V", "Verdict", "Spend more", "$" + r.ROI.toFixed(2) + " back per $1")
    : r.FundedAccounts === 0 ? node("V", "Verdict", "Stop", "nothing funded") : node("V", "Verdict", "Stop", "$" + r.ROI.toFixed(2) + " back per $1");
  const mermaid = [
    "flowchart LR",
    node("S", "Spend", money(r.Spend), money(pp.Spend)) + " --> " + node("L", "Leads", n(r.Leads), n(pp.Leads)),
    "L --> " + node("A", "Accounts", n(r.LiveAccounts), n(pp.LiveAccounts)),
    "A --> " + node("F", "Funded", n(r.FundedAccounts), n(pp.FundedAccounts)),
    "F --> " + node("D", "Deposits", money(r.TotalDeposits), money(pp.TotalDeposits)),
    "D --> " + node("R", "ROI", "$" + r.ROI.toFixed(2) + " per $1", "$1.00 breakeven"),
    "R --> " + verdictNode.replace("plan ", ""),
    "classDef good fill:#e4f4ea,stroke:#1d6b3c,color:#1d6b3c",
    "classDef warn fill:#fdf1cf,stroke:#8a6100,color:#8a6100",
    "classDef bad fill:#fbe4e7,stroke:#a63a45,color:#a63a45",
    "classDef flat fill:#f3f5f8,stroke:#9aa1ad,color:#1a1d23",
    "class S " + tone(r.Spend, pp.Spend),
    "class L " + tone(r.Leads, pp.Leads),
    "class A " + tone(r.LiveAccounts, pp.LiveAccounts),
    "class F " + tone(r.FundedAccounts, pp.FundedAccounts),
    "class D " + tone(r.TotalDeposits, pp.TotalDeposits),
    "class R " + (r.ROI >= 1 ? "good" : r.ROI >= 0.5 ? "warn" : "bad"),
    "class V " + (r.kind === "grow" ? "good" : "bad"),
  ].join("\n");
  // What to fix: one branch per department, tasks chosen by which funnel stage is furthest below plan.
  const ratio = (a: number, e: number) => (e > 0 ? a / e : 1);
  const leadsWeak = r.Leads > 0 && plan.CPL > 0 && r.CPL > plan.CPL * 1.5;      // leads too expensive
  const openWeak = r.Leads > 0 && ratio(r.LeadToAcct, plan.LeadToAcct || 0.35) < 0.7;
  const fundWeak = r.LiveAccounts > 0 && ratio(r.Conv, PLAN_CONV) < 0.7;         // sign up, no deposit
  const sizeWeak = r.FundedAccounts > 0 && ratio(r.AvgAccountSize, plan.AvgAccountSize) < 0.7;
  const dept = (nm: string, tasks: string[], tone: FixNode["tone"] = "dept"): FixNode => ({ name: nm, tone, children: tasks.map((t) => ({ name: t })) });
  const mk: FixNode[] = [];
  if (r.kind === "grow") {
    mk.push(dept("Performance Marketing", ["Raise budget 30% per week", "Clone top 2 campaigns to new audiences", "Hold CPFA under " + money(plan.CPFA)], "good"));
    mk.push(dept("Marketing", ["Localise creatives for " + r.c, "Add trust content: regulation, awards"]));
    mk.push(dept("Sales", ["Call every new account in 24h", "Upsell second deposit in 30 days"]));
    mk.push(dept("Customer Service", ["Fast KYC for " + r.c + " documents", "Local-language support hours"]));
  } else {
    mk.push(dept("Performance Marketing", leadsWeak
      ? ["Cut placements with no lead in 30 days", "Target CPL at " + money(plan.CPL), "Test a deposit-offer landing page"]
      : ["Shift budget to funded-account campaigns", "Exclude audiences that never deposit", "Retarget accounts that did not fund"], leadsWeak ? "bad" : "dept"));
    mk.push(dept("Marketing", sizeWeak
      ? ["Target higher-income segments in " + r.c, "Message professional traders", "Drop low-value promo angles"]
      : ["Localise landing page for " + r.c, "Add trust content: regulation, awards", "Check offer matches local demand"], sizeWeak ? "warn" : "dept"));
    mk.push(dept("Sales", fundWeak
      ? ["Call every " + r.c + " account within 48h", "Guided first trade on the call", "Report why clients do not deposit"]
      : openWeak ? ["Call every lead within 15 minutes", "Same-day WhatsApp with sign-up steps"] : ["Prioritise " + r.c + " leads in the queue", "Second-deposit follow-up at day 7"], fundWeak ? "bad" : openWeak ? "warn" : "dept"));
    mk.push(dept("Customer Service", openWeak || fundWeak
      ? ["Fix KYC drop-off for " + r.c + " documents", "Confirm local deposit methods work", "Live chat in local language"]
      : ["Onboarding email in local language", "Deposit how-to for " + r.c + " methods"], openWeak ? "warn" : "dept"));
  }
  const fixTree: FixNode = { name: r.c + " · " + r.chanS, tone: r.kind === "grow" ? "good" : "bad", children: mk };
  return { why, given, reasoning: R, actions: A, fixTree, mermaid, spend, funded, monthsMissing: months.length < 12 };
}
