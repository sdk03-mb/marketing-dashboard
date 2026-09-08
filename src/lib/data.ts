export type Format = "money" | "int" | "pct" | "x" | "money2";

export type Kpi = {
  label: string;
  value: number;
  format: Format;
  delta: number; // % vs previous period
  goodWhen: "up" | "down";
  trend: number[];
};

export const period = {
  label: "Last 30 days",
  range: "9 Aug – 7 Sep 2026",
  compare: "vs prior 30 days",
};

export const kpis: Kpi[] = [
  { label: "Spend", value: 412_380, format: "money", delta: 6.2, goodWhen: "down", trend: [11, 12, 13, 12, 14, 13, 15, 14, 15, 16, 15, 17] },
  { label: "Impressions", value: 48_210_000, format: "int", delta: 11.4, goodWhen: "up", trend: [30, 32, 31, 35, 36, 38, 37, 40, 42, 41, 44, 46] },
  { label: "Clicks", value: 1_182_400, format: "int", delta: 8.9, goodWhen: "up", trend: [20, 21, 23, 22, 25, 24, 26, 28, 27, 29, 30, 31] },
  { label: "CTR", value: 2.45, format: "pct", delta: -2.3, goodWhen: "up", trend: [2.6, 2.5, 2.6, 2.4, 2.5, 2.4, 2.5, 2.4, 2.3, 2.5, 2.4, 2.45] },
  { label: "CPC", value: 0.35, format: "money2", delta: -2.5, goodWhen: "down", trend: [0.38, 0.37, 0.37, 0.36, 0.36, 0.35, 0.36, 0.35, 0.35, 0.34, 0.35, 0.35] },
  { label: "Leads", value: 18_640, format: "int", delta: 14.1, goodWhen: "up", trend: [12, 13, 12, 14, 15, 14, 16, 17, 16, 18, 19, 20] },
  { label: "CPL", value: 22.12, format: "money2", delta: -6.9, goodWhen: "down", trend: [25, 24, 25, 23, 23, 24, 22, 23, 22, 22, 21, 22] },
  { label: "FTDs", value: 3_412, format: "int", delta: 9.6, goodWhen: "up", trend: [22, 23, 25, 24, 26, 27, 26, 29, 30, 31, 33, 34] },
  { label: "CPA", value: 120.86, format: "money2", delta: -3.1, goodWhen: "down", trend: [130, 128, 127, 126, 125, 124, 124, 122, 123, 121, 121, 120.9] },
  { label: "ROAS", value: 3.8, format: "x", delta: 4.4, goodWhen: "up", trend: [3.4, 3.5, 3.5, 3.6, 3.6, 3.7, 3.6, 3.7, 3.8, 3.8, 3.9, 3.8] },
];

export type ChannelRow = {
  channel: string;
  spend: number;
  impr: number;
  clicks: number;
  leads: number;
  ftd: number;
  roas: number;
};

export const channels: ChannelRow[] = [
  { channel: "Google Search", spend: 142_900, impr: 6_120_000, clicks: 418_200, leads: 7_210, ftd: 1_402, roas: 4.6 },
  { channel: "Meta", spend: 98_400, impr: 18_400_000, clicks: 336_000, leads: 4_890, ftd: 812, roas: 3.5 },
  { channel: "Google Display", spend: 41_200, impr: 11_900_000, clicks: 142_500, leads: 1_640, ftd: 218, roas: 2.1 },
  { channel: "YouTube", spend: 37_600, impr: 5_800_000, clicks: 61_300, leads: 1_120, ftd: 190, roas: 2.4 },
  { channel: "LinkedIn", spend: 33_800, impr: 1_460_000, clicks: 38_900, leads: 1_380, ftd: 302, roas: 3.9 },
  { channel: "X", spend: 22_100, impr: 2_640_000, clicks: 84_700, leads: 940, ftd: 141, roas: 2.6 },
  { channel: "TikTok", spend: 19_300, impr: 1_540_000, clicks: 71_100, leads: 1_020, ftd: 208, roas: 3.3 },
  { channel: "Programmatic", spend: 17_080, impr: 350_000, clicks: 29_700, leads: 440, ftd: 139, roas: 3.1 },
];

export type CampaignRow = {
  name: string;
  channel: string;
  status: "live" | "learning" | "paused";
  spend: number;
  cpa: number;
  ftd: number;
  roas: number;
  budgetUsed: number; // 0–1
};

export const campaigns: CampaignRow[] = [
  { name: "UAE · Brand · Search", channel: "Google", status: "live", spend: 38_400, cpa: 61.2, ftd: 627, roas: 6.1, budgetUsed: 0.92 },
  { name: "UK · Gold CFD · Search", channel: "Google", status: "live", spend: 31_900, cpa: 98.4, ftd: 324, roas: 4.2, budgetUsed: 0.81 },
  { name: "EU · FX Pairs · Retarget", channel: "Meta", status: "live", spend: 27_200, cpa: 84.7, ftd: 321, roas: 4.0, budgetUsed: 0.77 },
  { name: "APAC · Crypto CFD · Video", channel: "YouTube", status: "learning", spend: 22_600, cpa: 142.0, ftd: 159, roas: 2.2, budgetUsed: 0.64 },
  { name: "GCC · Indices · Lookalike", channel: "Meta", status: "live", spend: 21_100, cpa: 110.3, ftd: 191, roas: 3.1, budgetUsed: 0.88 },
  { name: "UK · Copy Trading · Prospecting", channel: "LinkedIn", status: "live", spend: 18_700, cpa: 96.9, ftd: 193, roas: 3.8, budgetUsed: 0.73 },
  { name: "LATAM · MT5 · App Install", channel: "TikTok", status: "learning", spend: 12_900, cpa: 74.1, ftd: 174, roas: 3.4, budgetUsed: 0.55 },
  { name: "Global · Webinar · Awareness", channel: "X", status: "paused", spend: 9_400, cpa: 188.0, ftd: 50, roas: 1.4, budgetUsed: 0.31 },
];

export const regions = [
  { region: "UAE", spend: 121_400, ftd: 1_210, cpa: 100.3, share: 0.29 },
  { region: "United Kingdom", spend: 94_200, ftd: 786, cpa: 119.8, share: 0.23 },
  { region: "EU", spend: 71_800, ftd: 548, cpa: 131.0, share: 0.17 },
  { region: "GCC ex-UAE", spend: 52_300, ftd: 412, cpa: 126.9, share: 0.13 },
  { region: "APAC", spend: 44_100, ftd: 279, cpa: 158.1, share: 0.11 },
  { region: "LATAM", spend: 28_580, ftd: 177, cpa: 161.5, share: 0.07 },
];

// daily spend & FTDs, 30 points
export const daily = Array.from({ length: 30 }, (_, i) => {
  const wk = Math.sin((i / 30) * Math.PI * 4) * 0.12;
  const spend = 12_000 + i * 90 + wk * 12_000 + ((i * 37) % 11) * 140;
  const ftd = 95 + i * 1.1 + wk * 90 + ((i * 53) % 7) * 4;
  return { day: i + 1, spend: Math.round(spend), ftd: Math.round(ftd) };
});

export const alerts = [
  { level: "warn", text: "APAC · Crypto CFD · Video: CPA 17% above target for 4 days" },
  { level: "warn", text: "GCC · Indices: Meta learning phase reset after budget change" },
  { level: "info", text: "UAE · Brand · Search at 92% of monthly budget, 23 days elapsed" },
  { level: "info", text: "/gold-cfd-uk landing page conversion up to 4.1% (+0.6pt)" },
] as const;

export const topKeywords = [
  { kw: "multibank", clicks: 61_200, cpc: 0.18, ftd: 402 },
  { kw: "gold trading uae", clicks: 24_800, cpc: 0.92, ftd: 138 },
  { kw: "forex broker uk", clicks: 19_300, cpc: 1.41, ftd: 96 },
  { kw: "mt5 broker", clicks: 17_100, cpc: 0.77, ftd: 84 },
  { kw: "cfd trading", clicks: 14_600, cpc: 1.12, ftd: 61 },
  { kw: "copy trading app", clicks: 11_900, cpc: 0.66, ftd: 57 },
];

export const funnel = [
  { stage: "Impressions", value: 48_210_000 },
  { stage: "Clicks", value: 1_182_400 },
  { stage: "Registrations", value: 41_300 },
  { stage: "Leads (KYC)", value: 18_640 },
  { stage: "FTDs", value: 3_412 },
];
