// PPC / Google Search — Performance vs Plan, August 2026 (1–26 Aug)
// Expected = full-month allocated budget per country (Lead Distribution / Marketing Budget plan, 13 Aug 2026).
// Actual = 1–26 Aug 2026 from analytics_warehouse, Demo Competition excluded.
// Difference = Actual − Expected. For CPC, CPL, CPA, CPFA a negative difference is favourable.

export const sheetMeta = {
  title: "PPC / Google Search — Performance vs Plan",
  period: "1–26 Aug 2026",
  daysElapsed: 26,
  daysInMonth: 31,
  planDate: "13 Aug 2026",
  totalExpected: 1_000_000,
  totalActual: 204_296,
};

export type Region = "GCC" | "Levant" | "North Africa" | "Europe" | "CIS & Türkiye" | "Rest of world";

export const countries: { name: string; code: string; region: Region }[] = [
  { name: "UAE", code: "AE", region: "GCC" },
  { name: "KSA", code: "SA", region: "GCC" },
  { name: "Qatar", code: "QA", region: "GCC" },
  { name: "Oman", code: "OM", region: "GCC" },
  { name: "Lebanon", code: "LB", region: "Levant" },
  { name: "Jordan", code: "JO", region: "Levant" },
  { name: "Syria", code: "SY", region: "Levant" },
  { name: "Tunisia", code: "TN", region: "North Africa" },
  { name: "Morocco", code: "MA", region: "North Africa" },
  { name: "Switzerland", code: "CH", region: "Europe" },
  { name: "Spain", code: "ES", region: "Europe" },
  { name: "Germany", code: "DE", region: "Europe" },
  { name: "Greece", code: "GR", region: "Europe" },
  { name: "Norway", code: "NO", region: "Europe" },
  { name: "Sweden", code: "SE", region: "Europe" },
  { name: "Netherlands", code: "NL", region: "Europe" },
  { name: "Poland", code: "PL", region: "Europe" },
  { name: "Turkey", code: "TR", region: "CIS & Türkiye" },
  { name: "Kazakhstan", code: "KZ", region: "CIS & Türkiye" },
  { name: "Canada", code: "CA", region: "Rest of world" },
  { name: "Australia", code: "AU", region: "Rest of world" },
  { name: "India", code: "IN", region: "Rest of world" },
  { name: "Pakistan", code: "PK", region: "Rest of world" },
];

export type MetricFormat = "money0" | "money2" | "int" | "pct1" | "pct2";
export type MetricGroup = "Spend" | "Traffic" | "Leads" | "Accounts" | "Funding" | "Revenue";

export type Metric = {
  key: string;
  label: string;
  group: MetricGroup;
  format: MetricFormat;
  /** 1 = higher is better, -1 = lower is better, 0 = neutral (no RAG) */
  dir: 1 | -1 | 0;
  /** true when the value is a rate/average — not summed in totals */
  ratio?: boolean;
  expected: number[];
  actual: number[];
};

const rep = (v: number, n = 23) => Array<number>(n).fill(v);
/** same value for all countries except Lebanon, Jordan, Syria (idx 4–6) which get 0 */
const repNoLevant = (v: number) => rep(v).map((x, i) => (i >= 4 && i <= 6 ? 0 : x));

export const metrics: Metric[] = [
  {
    key: "spend", label: "Spent $", group: "Spend", format: "money0", dir: 1,
    expected: [100000, 200000, 50000, 50000, 0, 0, 0, 25000, 25000, 37500, 37500, 37500, 37500, 37500, 37500, 37500, 37500, 50000, 50000, 50000, 50000, 37500, 12500],
    actual:   [42332, 25626, 8330, 4630, 0, 0, 0, 9239, 9580, 7491, 10365, 17085, 4632, 4627, 4558, 4673, 4770, 3386, 2782, 16940, 13902, 4693, 4657],
  },
  {
    key: "spendPct", label: "Spent %", group: "Spend", format: "pct1", dir: 0, ratio: true,
    expected: [10, 20, 5, 5, 0, 0, 0, 2.5, 2.5, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 3.8, 5, 5, 5, 5, 3.8, 1.3],
    actual:   [20.7, 12.5, 4.1, 2.3, 0, 0, 0, 4.5, 4.7, 3.7, 5.1, 8.4, 2.3, 2.3, 2.2, 2.3, 2.3, 1.7, 1.4, 8.3, 6.8, 2.3, 2.3],
  },
  {
    key: "impr", label: "Impressions", group: "Traffic", format: "int", dir: 1,
    expected: [178571, 357143, 89286, 89286, 0, 0, 0, 44643, 44643, 66964, 66964, 66964, 66964, 66964, 66964, 66964, 66964, 89286, 89286, 89286, 89286, 66964, 22321],
    actual:   [153609, 68257, 22897, 7616, 0, 0, 0, 6668, 13703, 15962, 52080, 81335, 20837, 5200, 11110, 10603, 22798, 54594, 3036, 24820, 41271, 13139, 18639],
  },
  {
    key: "clicks", label: "Clicks", group: "Traffic", format: "int", dir: 1,
    expected: [14286, 28571, 7143, 7143, 0, 0, 0, 3571, 3571, 5357, 5357, 5357, 5357, 5357, 5357, 5357, 5357, 7143, 7143, 7143, 7143, 5357, 1786],
    actual:   [4809, 4917, 1423, 646, 0, 0, 0, 745, 1604, 708, 1634, 2103, 863, 227, 515, 509, 785, 1959, 236, 851, 933, 1073, 3247],
  },
  {
    key: "ctr", label: "CTR %", group: "Traffic", format: "pct2", dir: 1, ratio: true,
    expected: rep(8),
    actual:   [3.13, 7.2, 6.21, 8.48, 0, 0, 0, 11.17, 11.71, 4.44, 3.14, 2.59, 4.14, 4.37, 4.64, 4.8, 3.44, 3.59, 7.77, 3.43, 2.26, 8.17, 17.42],
  },
  {
    key: "cpc", label: "CPC $", group: "Traffic", format: "money2", dir: -1, ratio: true,
    expected: rep(7),
    actual:   [8.8, 5.21, 5.85, 7.17, 0, 0, 0, 12.4, 5.97, 10.58, 6.34, 8.12, 5.37, 20.38, 8.85, 9.18, 6.08, 1.73, 11.79, 19.91, 14.9, 4.37, 1.43],
  },
  {
    key: "leads", label: "Leads", group: "Leads", format: "int", dir: 1,
    expected: [857, 1714, 429, 429, 0, 0, 0, 214, 214, 321, 321, 321, 321, 321, 321, 321, 321, 429, 429, 429, 429, 321, 107],
    actual:   [159, 184, 81, 36, 1, 1, 4, 37, 162, 19, 139, 92, 32, 11, 22, 17, 16, 6, 25, 53, 49, 84, 401],
  },
  {
    key: "cpl", label: "CPL $", group: "Leads", format: "money2", dir: -1, ratio: true,
    expected: repNoLevant(116.67),
    actual:   [266.24, 139.27, 102.84, 128.6, 0, 0, 0, 249.7, 59.13, 394.24, 74.57, 185.7, 144.77, 420.67, 207.19, 274.87, 298.12, 564.37, 111.26, 319.62, 283.72, 55.87, 11.61],
  },
  {
    key: "l2a", label: "Leads → Accounts %", group: "Accounts", format: "pct1", dir: 1, ratio: true,
    expected: rep(35),
    actual:   [42.8, 33.7, 28.4, 25, 0, 0, 50, 29.7, 30.2, 15.8, 30.2, 29.3, 46.9, 27.3, 22.7, 52.9, 18.8, 16.7, 24, 47.2, 42.9, 25, 29.9],
  },
  {
    key: "live", label: "Live Accounts", group: "Accounts", format: "int", dir: 1,
    expected: [300, 600, 150, 150, 0, 0, 0, 75, 75, 113, 113, 113, 113, 113, 113, 113, 113, 150, 150, 150, 150, 113, 38],
    actual:   [68, 62, 23, 9, 0, 0, 2, 11, 49, 3, 42, 27, 15, 3, 5, 9, 3, 1, 6, 25, 21, 21, 120],
  },
  {
    key: "cpa", label: "CPA $", group: "Accounts", format: "money2", dir: -1, ratio: true,
    expected: repNoLevant(333.33),
    actual:   [622.52, 413.32, 362.19, 514.4, 0, 0, 0, 839.9, 195.5, 2496.87, 246.78, 632.77, 308.83, 1542.44, 911.65, 519.19, 1589.98, 3386.23, 463.6, 677.58, 662, 223.49, 38.81],
  },
  {
    key: "a2f", label: "Live → Funded %", group: "Funding", format: "pct1", dir: 1, ratio: true,
    expected: rep(30),
    actual:   [11.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7.1, 14.8, 0, 0, 0, 11.1, 0, 0, 0, 20, 33.3, 4.8, 0],
  },
  {
    key: "l2f", label: "Leads → Funded %", group: "Funding", format: "pct1", dir: 1, ratio: true,
    expected: repNoLevant(10.5),
    actual:   [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2.2, 4.3, 0, 0, 0, 5.9, 0, 0, 0, 9.4, 14.3, 1.2, 0],
  },
  {
    key: "funded", label: "Funded Accounts (Aug cohort)", group: "Funding", format: "int", dir: 1,
    expected: [90, 180, 45, 45, 0, 0, 0, 23, 23, 34, 34, 34, 34, 34, 34, 34, 34, 45, 45, 45, 45, 34, 11],
    actual:   [8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 0, 0, 0, 1, 0, 0, 0, 5, 7, 1, 0],
  },
  {
    key: "cpfa", label: "CPFA $", group: "Funding", format: "money2", dir: -1, ratio: true,
    expected: repNoLevant(1111.11),
    actual:   [5291.45, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3454.9, 4271.21, 0, 0, 0, 4672.74, 0, 0, 0, 3387.92, 1986.01, 4693.3, 0],
  },
  {
    key: "acc2f", label: "Accounts → Funded %", group: "Funding", format: "pct1", dir: 1, ratio: true,
    expected: repNoLevant(30),
    actual:   [11.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7.1, 14.8, 0, 0, 0, 11.1, 0, 0, 0, 20, 33.3, 4.8, 0],
  },
  {
    key: "ftdAcc", label: "FTD Accounts (all, non-cohorted)", group: "Revenue", format: "int", dir: 1,
    expected: [90, 180, 45, 45, 0, 0, 0, 23, 23, 34, 34, 34, 34, 34, 34, 34, 34, 45, 45, 45, 45, 34, 11],
    actual:   [16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 5, 0, 0, 0, 1, 0, 1, 0, 6, 9, 1, 0],
  },
  {
    key: "avgSize", label: "Average Account Size $", group: "Revenue", format: "money0", dir: 1, ratio: true,
    expected: [5100, 4150, 5650, 4150, 2250, 2250, 1700, 2050, 2050, 6750, 4500, 4150, 4900, 5650, 5250, 4500, 4900, 3000, 3000, 4900, 5450, 2250, 1700],
    actual:   [1004, 0, 0, 0, 0, 0, 0, 0, 0, 0, 164, 227, 0, 0, 0, 350, 0, 4022, 0, 77, 100, 100, 0],
  },
  {
    key: "ftd", label: "FTD $", group: "Revenue", format: "money0", dir: 1,
    expected: [183600, 298800, 101700, 74700, 0, 0, 0, 18450, 18450, 91125, 60750, 56025, 66150, 76275, 70875, 60750, 66150, 54000, 54000, 88200, 98100, 30375, 7650],
    actual:   [16066, 0, 0, 0, 0, 0, 0, 0, 0, 0, 491, 1133, 0, 0, 0, 350, 0, 4022, 0, 460, 896, 100, 0],
  },
  {
    key: "redep", label: "Re-Deposit $", group: "Revenue", format: "money0", dir: 1,
    expected: [275400, 448200, 152550, 112050, 0, 0, 0, 27675, 27675, 136688, 91125, 84038, 99225, 114413, 106313, 91125, 99225, 81000, 81000, 132300, 147150, 45563, 11475],
    actual:   [1041834, 21250, 50, 0, 0, 0, 100, 0, 350, 3366, 30436, 12682, 50, 0, 0, 0, 0, 7665, 0, 38102, 54066, 8769, 0],
  },
  {
    key: "deposits", label: "Total Deposits $", group: "Revenue", format: "money0", dir: 1,
    expected: [459000, 747000, 254250, 186750, 0, 0, 0, 46125, 46125, 227813, 151875, 140063, 165375, 190688, 177188, 151875, 165375, 135000, 135000, 220500, 245250, 75938, 19125],
    actual:   [1057900, 21250, 50, 0, 0, 0, 100, 0, 350, 3366, 30927, 13815, 50, 0, 0, 350, 0, 11687, 0, 38562, 54962, 8869, 0],
  },
  {
    key: "roi", label: "ROI (NMI) %", group: "Revenue", format: "pct1", dir: 1, ratio: true,
    expected: [459, 373.5, 508.5, 373.5, 0, 0, 0, 184.5, 184.5, 607.5, 405, 373.5, 441, 508.5, 472.5, 405, 441, 270, 270, 441, 490.5, 202.5, 153],
    actual:   [2499.1, 82.9, 0.6, 0, 0, 0, 0, 0, 3.7, 44.9, 298.4, 80.9, 1.1, 0, 0, 7.5, 0, 345.1, 0, 227.6, 395.4, 189, 0],
  },
];

export const notes = [
  "FTD $, Re-Deposit $, Total Deposits $ and FTD Accounts are non-cohorted: every deposit landing 1–26 Aug 2026 from a marketing-acquired account of any vintage. Leads, Live Accounts and Funded Accounts remain the August cohort, so the conversion rates stay meaningful.",
  "Difference = Actual − Expected on every row. For CPC, CPL, CPA and CPFA a negative difference is favourable; the colour coding already accounts for that.",
];

export type Rag = "good" | "warn" | "bad" | "none";

/** RAG status of a cell. Favourable → good; unfavourable within 25% of plan → warn; worse → bad. */
export function rag(m: Metric, expected: number, actual: number): Rag {
  if (m.dir === 0 || expected === 0) return "none";
  const diff = (actual - expected) * m.dir;
  if (diff >= 0) return "good";
  return Math.abs(actual - expected) / expected <= 0.25 ? "warn" : "bad";
}

export function fmtMetric(v: number, f: MetricFormat, signed = false): string {
  const sign = signed && v > 0 ? "+" : "";
  switch (f) {
    case "money0": return sign + (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
    case "money2": return sign + (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "int": return sign + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
    case "pct1": return sign + v.toFixed(1) + "%";
    case "pct2": return sign + v.toFixed(2) + "%";
  }
}

/** Compact number for KPI tiles */
export function fmtShort(v: number, f: MetricFormat): string {
  if (f === "pct1" || f === "pct2") return fmtMetric(v, f);
  const abs = Math.abs(v);
  const s = abs >= 1e6 ? (abs / 1e6).toFixed(2) + "M" : abs >= 1e4 ? (abs / 1e3).toFixed(0) + "K" : abs >= 1e3 ? (abs / 1e3).toFixed(1) + "K" : abs.toFixed(f === "money2" ? 2 : 0);
  return (v < 0 ? "-" : "") + (f.startsWith("money") ? "$" : "") + s;
}
