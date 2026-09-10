import marketing from "@/data/marketing-data.json";

export const COUNTRIES = [
  "UAE", "KSA", "Qatar", "Oman", "Lebanon", "Jordan", "Syria", "Tunisia", "Morocco",
  "Switzerland", "Spain", "Germany", "Greece", "Norway", "Sweden", "Netherlands", "Poland",
  "Turkey", "Kazakhstan", "Canada", "Australia", "India", "Pakistan",
] as const;

/** Continents for the annexure maps, one page each. `fit` lists world-atlas country names the map zooms to, so a continent with no market still draws. */
export const REGIONS: { name: string; countries: string[]; fit: string[] }[] = [
  { name: "Middle East", countries: ["UAE", "KSA", "Qatar", "Oman", "Lebanon", "Jordan", "Syria"], fit: ["United Arab Emirates", "Saudi Arabia", "Qatar", "Oman", "Lebanon", "Jordan", "Syria", "Iraq", "Kuwait", "Yemen"] },
  { name: "Africa", countries: ["Tunisia", "Morocco"], fit: ["Morocco", "Algeria", "Tunisia", "Libya", "Egypt", "Mauritania", "Mali", "Niger", "Chad", "Sudan"] },
  { name: "Europe", countries: ["Switzerland", "Spain", "Germany", "Greece", "Norway", "Sweden", "Netherlands", "Poland", "Turkey"], fit: ["Switzerland", "Spain", "Germany", "Greece", "Norway", "Sweden", "Netherlands", "Poland", "Turkey", "France", "Italy", "United Kingdom", "Portugal", "Finland"] },
  { name: "Asia", countries: ["Kazakhstan", "India", "Pakistan"], fit: ["Kazakhstan", "India", "Pakistan", "China", "Mongolia", "Iran", "Afghanistan", "Thailand", "Vietnam", "Japan", "Indonesia", "Malaysia"] },
  { name: "North America", countries: ["Canada"], fit: ["Canada", "United States of America", "Mexico"] },
  { name: "South America", countries: [], fit: ["Brazil", "Argentina", "Chile", "Colombia", "Peru", "Venezuela", "Bolivia", "Ecuador", "Paraguay", "Uruguay"] },
  { name: "Oceania", countries: ["Australia"], fit: ["Australia", "New Zealand", "Papua New Guinea"] },
];

export const CHANNELS: Record<string, string[]> = {
  "PPC / Google Search": [
    "Google Search", "Bing Search", "Google Display", "Google Performance Max", "Google DemandGen",
    "Google Discovery", "Google Managed Placements", "Google Others", "Apple Search", "Google App",
    "Google Ads", "Google Play",
  ],
  "Instagram + Facebook": ["Facebook & Instagram"],
  TikTok: ["TikTok"],
  YouTube: ["YouTube"],
  "LinkedIn + Snapchat": ["LinkedIn", "Snapchat"],
  Programmatic: ["Programmatic", "Programmatic Web", "Adroll", "RTB House"],
};

export const CHANNEL_NAMES = Object.keys(CHANNELS);
export const ALL_PLATFORMS = Object.values(CHANNELS).flat();
export const ALLCH = "All Channels (combined)";
export const PLAN_CONV = 0.3;

export const ISO: Record<string, string> = {
  UAE: "ae", KSA: "sa", Qatar: "qa", Oman: "om", Lebanon: "lb", Jordan: "jo", Syria: "sy",
  Tunisia: "tn", Morocco: "ma", Switzerland: "ch", Spain: "es", Germany: "de", Greece: "gr",
  Norway: "no", Sweden: "se", Netherlands: "nl", Poland: "pl", Turkey: "tr", Kazakhstan: "kz",
  Canada: "ca", Australia: "au", India: "in", Pakistan: "pk",
};

export type PlanRow = {
  Spend: number; Leads: number; CPL: number; LiveAccounts: number; CPA: number;
  FundedAccounts: number; CPFA: number; AvgAccountSize: number; FTD: number;
  Redeposit: number; TotalDeposits: number;
};

// The August plan per country and avenue, from the plan workbook via src/data/marketing-data.json (augustPlan.expected).
type Expected = Record<string, number | null>;
const planRow = (e: Expected): PlanRow => ({
  Spend: e["Spent $"] ?? 0, Leads: e["Leads"] ?? 0, CPL: e["CPL $"] ?? 0, LiveAccounts: e["Live Accounts"] ?? 0, CPA: e["CPA $"] ?? 0,
  FundedAccounts: e["Funded Accounts (Aug cohort)"] ?? 0, CPFA: e["CPFA $"] ?? 0, AvgAccountSize: e["Average Account Size $"] ?? 0,
  FTD: e["FTD $"] ?? 0, Redeposit: e["Re-Deposit $"] ?? 0, TotalDeposits: e["Total Deposits $"] ?? 0,
});
const EXPECTED = (marketing as { augustPlan: { expected: { PPC: Record<string, Expected>; Social: Record<string, Expected> } } }).augustPlan.expected;
const planTable = (t: Record<string, Expected>): Record<string, PlanRow> => Object.fromEntries(Object.entries(t).map(([c, e]) => [c, planRow(e)]));
export const PLAN: { PPC: Record<string, PlanRow>; Social: Record<string, PlanRow> } = { PPC: planTable(EXPECTED.PPC), Social: planTable(EXPECTED.Social) };
