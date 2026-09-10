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

export const PLAN: { PPC: Record<string, PlanRow>; Social: Record<string, PlanRow> } = {
  PPC: {
    UAE: { Spend: 100000, Leads: 857.14, CPL: 116.67, LiveAccounts: 300.0, CPA: 333.33, FundedAccounts: 90.0, CPFA: 1111.11, AvgAccountSize: 5100, FTD: 183600, Redeposit: 275400.0, TotalDeposits: 459000.0 },
    KSA: { Spend: 200000, Leads: 1714.29, CPL: 116.67, LiveAccounts: 600.0, CPA: 333.33, FundedAccounts: 180.0, CPFA: 1111.11, AvgAccountSize: 4150, FTD: 298800.0, Redeposit: 448200.0, TotalDeposits: 747000.0 },
    Qatar: { Spend: 50000, Leads: 428.57, CPL: 116.67, LiveAccounts: 150.0, CPA: 333.33, FundedAccounts: 45.0, CPFA: 1111.11, AvgAccountSize: 5650, FTD: 101700, Redeposit: 152550.0, TotalDeposits: 254250.0 },
    Oman: { Spend: 50000, Leads: 428.57, CPL: 116.67, LiveAccounts: 150.0, CPA: 333.33, FundedAccounts: 45.0, CPFA: 1111.11, AvgAccountSize: 4150, FTD: 74700.0, Redeposit: 112050.0, TotalDeposits: 186750.0 },
    Lebanon: { Spend: 0, Leads: 0, CPL: 0, LiveAccounts: 0, CPA: 0, FundedAccounts: 0, CPFA: 0, AvgAccountSize: 2250, FTD: 0, Redeposit: 0, TotalDeposits: 0 },
    Jordan: { Spend: 0, Leads: 0, CPL: 0, LiveAccounts: 0, CPA: 0, FundedAccounts: 0, CPFA: 0, AvgAccountSize: 2250, FTD: 0, Redeposit: 0, TotalDeposits: 0 },
    Syria: { Spend: 0, Leads: 0, CPL: 0, LiveAccounts: 0, CPA: 0, FundedAccounts: 0, CPFA: 0, AvgAccountSize: 1700, FTD: 0, Redeposit: 0, TotalDeposits: 0 },
    Tunisia: { Spend: 25000, Leads: 214.29, CPL: 116.67, LiveAccounts: 75.0, CPA: 333.33, FundedAccounts: 22.5, CPFA: 1111.11, AvgAccountSize: 2050, FTD: 18450.0, Redeposit: 27675.0, TotalDeposits: 46125.0 },
    Morocco: { Spend: 25000, Leads: 214.29, CPL: 116.67, LiveAccounts: 75.0, CPA: 333.33, FundedAccounts: 22.5, CPFA: 1111.11, AvgAccountSize: 2050, FTD: 18450.0, Redeposit: 27675.0, TotalDeposits: 46125.0 },
    Switzerland: { Spend: 37500, Leads: 321.43, CPL: 116.67, LiveAccounts: 112.5, CPA: 333.33, FundedAccounts: 33.75, CPFA: 1111.11, AvgAccountSize: 6750, FTD: 91125, Redeposit: 136687.5, TotalDeposits: 227812.5 },
    Spain: { Spend: 37500, Leads: 321.43, CPL: 116.67, LiveAccounts: 112.5, CPA: 333.33, FundedAccounts: 33.75, CPFA: 1111.11, AvgAccountSize: 4500, FTD: 60750, Redeposit: 91125, TotalDeposits: 151875 },
    Germany: { Spend: 37500, Leads: 321.43, CPL: 116.67, LiveAccounts: 112.5, CPA: 333.33, FundedAccounts: 33.75, CPFA: 1111.11, AvgAccountSize: 4150, FTD: 56025, Redeposit: 84037.5, TotalDeposits: 140062.5 },
    Greece: { Spend: 37500, Leads: 321.43, CPL: 116.67, LiveAccounts: 112.5, CPA: 333.33, FundedAccounts: 33.75, CPFA: 1111.11, AvgAccountSize: 4900, FTD: 66150, Redeposit: 99225, TotalDeposits: 165375 },
    Norway: { Spend: 37500, Leads: 321.43, CPL: 116.67, LiveAccounts: 112.5, CPA: 333.33, FundedAccounts: 33.75, CPFA: 1111.11, AvgAccountSize: 5650, FTD: 76275, Redeposit: 114412.5, TotalDeposits: 190687.5 },
    Sweden: { Spend: 37500, Leads: 321.43, CPL: 116.67, LiveAccounts: 112.5, CPA: 333.33, FundedAccounts: 33.75, CPFA: 1111.11, AvgAccountSize: 5250, FTD: 70875, Redeposit: 106312.5, TotalDeposits: 177187.5 },
    Netherlands: { Spend: 37500, Leads: 321.43, CPL: 116.67, LiveAccounts: 112.5, CPA: 333.33, FundedAccounts: 33.75, CPFA: 1111.11, AvgAccountSize: 4500, FTD: 60750, Redeposit: 91125, TotalDeposits: 151875 },
    Poland: { Spend: 37500, Leads: 321.43, CPL: 116.67, LiveAccounts: 112.5, CPA: 333.33, FundedAccounts: 33.75, CPFA: 1111.11, AvgAccountSize: 4900, FTD: 66150, Redeposit: 99225, TotalDeposits: 165375 },
    Turkey: { Spend: 50000, Leads: 428.57, CPL: 116.67, LiveAccounts: 150.0, CPA: 333.33, FundedAccounts: 45.0, CPFA: 1111.11, AvgAccountSize: 3000, FTD: 54000.0, Redeposit: 81000.0, TotalDeposits: 135000.0 },
    Kazakhstan: { Spend: 50000, Leads: 428.57, CPL: 116.67, LiveAccounts: 150.0, CPA: 333.33, FundedAccounts: 45.0, CPFA: 1111.11, AvgAccountSize: 3000, FTD: 54000.0, Redeposit: 81000.0, TotalDeposits: 135000.0 },
    Canada: { Spend: 50000, Leads: 428.57, CPL: 116.67, LiveAccounts: 150.0, CPA: 333.33, FundedAccounts: 45.0, CPFA: 1111.11, AvgAccountSize: 4900, FTD: 88200, Redeposit: 132300.0, TotalDeposits: 220500.0 },
    Australia: { Spend: 50000, Leads: 428.57, CPL: 116.67, LiveAccounts: 150.0, CPA: 333.33, FundedAccounts: 45.0, CPFA: 1111.11, AvgAccountSize: 5450, FTD: 98100, Redeposit: 147150.0, TotalDeposits: 245250.0 },
    India: { Spend: 37500, Leads: 321.43, CPL: 116.67, LiveAccounts: 112.5, CPA: 333.33, FundedAccounts: 33.75, CPFA: 1111.11, AvgAccountSize: 2250, FTD: 30375, Redeposit: 45562.5, TotalDeposits: 75937.5 },
    Pakistan: { Spend: 12500, Leads: 107.14, CPL: 116.67, LiveAccounts: 37.5, CPA: 333.33, FundedAccounts: 11.25, CPFA: 1111.11, AvgAccountSize: 1700, FTD: 7650.0, Redeposit: 11475.0, TotalDeposits: 19125.0 },
  },
  Social: {
    UAE: { Spend: 50000, Leads: 3000, CPL: 16.67, LiveAccounts: 1050, CPA: 47.62, FundedAccounts: 262.5, CPFA: 190.48, AvgAccountSize: 5100, FTD: 535500, Redeposit: 803250, TotalDeposits: 1338750 },
    KSA: { Spend: 100000, Leads: 6000, CPL: 16.67, LiveAccounts: 2100, CPA: 47.62, FundedAccounts: 525, CPFA: 190.48, AvgAccountSize: 4150, FTD: 871500, Redeposit: 1307250, TotalDeposits: 2178750 },
    Qatar: { Spend: 5000, Leads: 300, CPL: 16.67, LiveAccounts: 105, CPA: 47.62, FundedAccounts: 26.25, CPFA: 190.48, AvgAccountSize: 5650, FTD: 59325, Redeposit: 88987.5, TotalDeposits: 148312.5 },
    Oman: { Spend: 5000, Leads: 300, CPL: 16.67, LiveAccounts: 105, CPA: 47.62, FundedAccounts: 26.25, CPFA: 190.48, AvgAccountSize: 4150, FTD: 43575, Redeposit: 65362.5, TotalDeposits: 108937.5 },
    Lebanon: { Spend: 5000, Leads: 300, CPL: 16.67, LiveAccounts: 105, CPA: 47.62, FundedAccounts: 26.25, CPFA: 190.48, AvgAccountSize: 2250, FTD: 23625, Redeposit: 35437.5, TotalDeposits: 59062.5 },
    Jordan: { Spend: 5000, Leads: 300, CPL: 16.67, LiveAccounts: 105, CPA: 47.62, FundedAccounts: 26.25, CPFA: 190.48, AvgAccountSize: 2250, FTD: 23625, Redeposit: 35437.5, TotalDeposits: 59062.5 },
    Syria: { Spend: 5000, Leads: 300, CPL: 16.67, LiveAccounts: 105, CPA: 47.62, FundedAccounts: 26.25, CPFA: 190.48, AvgAccountSize: 1700, FTD: 17850, Redeposit: 26775, TotalDeposits: 44625 },
    Tunisia: { Spend: 12500, Leads: 750, CPL: 16.67, LiveAccounts: 262.5, CPA: 47.62, FundedAccounts: 65.62, CPFA: 190.48, AvgAccountSize: 2050, FTD: 53812.5, Redeposit: 80718.75, TotalDeposits: 134531.25 },
    Morocco: { Spend: 12500, Leads: 750, CPL: 16.67, LiveAccounts: 262.5, CPA: 47.62, FundedAccounts: 65.62, CPFA: 190.48, AvgAccountSize: 2050, FTD: 53812.5, Redeposit: 80718.75, TotalDeposits: 134531.25 },
    Switzerland: { Spend: 12500, Leads: 750, CPL: 16.67, LiveAccounts: 262.5, CPA: 47.62, FundedAccounts: 65.62, CPFA: 190.48, AvgAccountSize: 6750, FTD: 177187.5, Redeposit: 265781.25, TotalDeposits: 442968.75 },
    Spain: { Spend: 12500, Leads: 750, CPL: 16.67, LiveAccounts: 262.5, CPA: 47.62, FundedAccounts: 65.62, CPFA: 190.48, AvgAccountSize: 4500, FTD: 118125, Redeposit: 177187.5, TotalDeposits: 295312.5 },
    Germany: { Spend: 12500, Leads: 750, CPL: 16.67, LiveAccounts: 262.5, CPA: 47.62, FundedAccounts: 65.62, CPFA: 190.48, AvgAccountSize: 4150, FTD: 108937.5, Redeposit: 163406.25, TotalDeposits: 272343.75 },
    Greece: { Spend: 12500, Leads: 750, CPL: 16.67, LiveAccounts: 262.5, CPA: 47.62, FundedAccounts: 65.62, CPFA: 190.48, AvgAccountSize: 4900, FTD: 128625, Redeposit: 192937.5, TotalDeposits: 321562.5 },
    Norway: { Spend: 12500, Leads: 750, CPL: 16.67, LiveAccounts: 262.5, CPA: 47.62, FundedAccounts: 65.62, CPFA: 190.48, AvgAccountSize: 5650, FTD: 148312.5, Redeposit: 222468.75, TotalDeposits: 370781.25 },
    Sweden: { Spend: 12500, Leads: 750, CPL: 16.67, LiveAccounts: 262.5, CPA: 47.62, FundedAccounts: 65.62, CPFA: 190.48, AvgAccountSize: 5250, FTD: 137812.5, Redeposit: 206718.75, TotalDeposits: 344531.25 },
    Netherlands: { Spend: 12500, Leads: 750, CPL: 16.67, LiveAccounts: 262.5, CPA: 47.62, FundedAccounts: 65.62, CPFA: 190.48, AvgAccountSize: 4500, FTD: 118125, Redeposit: 177187.5, TotalDeposits: 295312.5 },
    Poland: { Spend: 12500, Leads: 750, CPL: 16.67, LiveAccounts: 262.5, CPA: 47.62, FundedAccounts: 65.62, CPFA: 190.48, AvgAccountSize: 4900, FTD: 128625, Redeposit: 192937.5, TotalDeposits: 321562.5 },
    Turkey: { Spend: 25000, Leads: 1500, CPL: 16.67, LiveAccounts: 525, CPA: 47.62, FundedAccounts: 131.25, CPFA: 190.48, AvgAccountSize: 3000, FTD: 157500, Redeposit: 236250, TotalDeposits: 393750 },
    Kazakhstan: { Spend: 25000, Leads: 1500, CPL: 16.67, LiveAccounts: 525, CPA: 47.62, FundedAccounts: 131.25, CPFA: 190.48, AvgAccountSize: 3000, FTD: 157500, Redeposit: 236250, TotalDeposits: 393750 },
    Canada: { Spend: 25000, Leads: 1500, CPL: 16.67, LiveAccounts: 525, CPA: 47.62, FundedAccounts: 131.25, CPFA: 190.48, AvgAccountSize: 4900, FTD: 257250, Redeposit: 385875, TotalDeposits: 643125 },
    Australia: { Spend: 0, Leads: 0, CPL: 0, LiveAccounts: 0, CPA: 0, FundedAccounts: 0, CPFA: 0, AvgAccountSize: 5450, FTD: 0, Redeposit: 0, TotalDeposits: 0 },
    India: { Spend: 93750, Leads: 5625, CPL: 16.67, LiveAccounts: 1968.75, CPA: 47.62, FundedAccounts: 492.19, CPFA: 190.48, AvgAccountSize: 2250, FTD: 442968.75, Redeposit: 664453.12, TotalDeposits: 1107421.87 },
    Pakistan: { Spend: 31250, Leads: 1875, CPL: 16.67, LiveAccounts: 656.25, CPA: 47.62, FundedAccounts: 164.06, CPFA: 190.48, AvgAccountSize: 1700, FTD: 111562.5, Redeposit: 167343.75, TotalDeposits: 278906.25 },
  },
};
