// Chairman's instructions: each funnel stage that misses plan maps to one owning department,
// and every instruction quotes the number, the plan, a deadline and what to report back.
import { PLAN_CTR, dLbl, statusOf, type Cal, type GridGroup, type Period, type Status } from "./engine";
import { PLAN_CONV } from "./plan";
import { fmt, money } from "./format";

export const DEPTS = ["Performance Marketing", "Marketing", "Sales", "Customer Service"] as const;
export type Dept = (typeof DEPTS)[number];
export type Verb = "STOP" | "SCALE" | "FIX" | "CHECK" | "HOLD" | "PILOT";
export type Instruction = {
  dept: Dept; verb: Verb; market: string; avenue: string;
  /** Verb + noun headline, e.g. "STOP FUNDING". */
  title: string;
  /** WHY: one line of numbers against plan. */
  nums: string;
  /** WHAT: what the department must do, and what to report. */
  text: string;
  /** WHEN. */
  due: string;
  /** Money at stake, used to order the lane. */
  stake: number;
};

export type Stage = { key: string; label: string; actual: string; plan: string; sub: string; status: Status; ratio: number };
export type Funnel = { stages: Stage[]; worst: number; note: string };

const n = (v: number) => fmt(v, "n");
const pct = (v: number) => fmt(v, "pct");

/** Funnel strip for the total group: actual over plan per stage, worst stage flagged. */
export function funnelOf(tot: GridGroup): Funnel {
  const a = tot.act, p = tot.pl;
  const st = (e: number, v: number, cost = false): Status => statusOf({ dir: cost ? "cost" : "vol" }, e, v);
  const ratio = (v: number, e: number) => (e > 0 ? v / e : v > 0 ? 1 : 0);
  const stages: Stage[] = [
    { key: "spend", label: "Spend", actual: money(a.Spend), plan: money(p.Spend), sub: p.Spend ? pct(a.Spend / p.Spend) + " of plan" : "no plan", status: st(p.Spend, a.Spend), ratio: ratio(a.Spend, p.Spend) },
    { key: "clicks", label: "Clicks", actual: n(a.Clicks), plan: n(p.Clicks), sub: a.Impressions ? "CTR " + fmt(a.CTR, "pct2") + " vs " + fmt(PLAN_CTR, "pct") : "CPC " + fmt(a.CPC, "$2") + " vs " + fmt(p.CPC, "$2"), status: st(p.Clicks, a.Clicks), ratio: ratio(a.Clicks, p.Clicks) },
    { key: "leads", label: "Leads", actual: n(a.Leads), plan: n(p.Leads), sub: "CPL " + fmt(a.CPL, "$2") + " vs " + fmt(p.CPL, "$2"), status: st(p.Leads, a.Leads), ratio: ratio(a.Leads, p.Leads) },
    { key: "accounts", label: "Live accounts", actual: n(a.LiveAccounts), plan: n(p.LiveAccounts), sub: "leads to accounts " + pct(a.LeadToAcct) + " vs " + pct(p.LeadToAcct || 0.35), status: st(p.LiveAccounts, a.LiveAccounts), ratio: ratio(a.LiveAccounts, p.LiveAccounts) },
    { key: "funded", label: "Funded", actual: n(a.FundedAccounts), plan: n(p.FundedAccounts), sub: "accounts to funded " + pct(a.Conv) + " vs " + pct(PLAN_CONV), status: st(p.FundedAccounts, a.FundedAccounts), ratio: ratio(a.FundedAccounts, p.FundedAccounts) },
    { key: "deposits", label: "Deposits", actual: money(a.TotalDeposits), plan: money(p.TotalDeposits), sub: "return " + pct(a.ROI) + " vs " + pct(p.ROI), status: st(p.TotalDeposits, a.TotalDeposits), ratio: ratio(a.TotalDeposits, p.TotalDeposits) },
  ];
  // Worst stage = biggest drop in plan attainment from the stage before it (clicks onward).
  let worst = 1, drop = -Infinity;
  for (let i = 1; i < stages.length - 1; i++) {
    const d = stages[i - 1].ratio - stages[i].ratio;
    if (d > drop) { drop = d; worst = i; }
  }
  const w = stages[worst];
  // Plain-language verdict for the chairman: where the journey breaks, and what the company must focus on.
  const OVERALL: Record<string, [string, string]> = {
    clicks: ["traffic: ads are not turning into clicks at plan cost", "ad creative, keywords and bidding"],
    leads: ["lead capture: clicks arrive but do not leave their details", "landing pages, offers and local language"],
    accounts: ["sales follow-up: leads do not turn into open accounts", "calling every lead within minutes and same-day follow-up"],
    funded: ["what happens after sign-up: accounts open but do not fund", "onboarding, deposit methods and a guided first trade, jointly by Sales and Customer Service"],
    deposits: ["deposit size: funded clients deposit far less than planned", "client quality and higher-value segments"],
  };
  const [problem, focus] = OVERALL[w.key] ?? ["spend volume", "delivering the planned budget"];
  const note = drop > 0.1
    ? "The problem is in " + problem + ". " + w.label + " reached " + w.actual + " against " + w.plan + " planned (" + pct(w.ratio) + "), the sharpest drop in the journey. As a company we need to focus on " + focus + "."
    : "No single stage breaks away from plan. Spend reached " + stages[0].actual + " against " + stages[0].plan + " planned; as a company we need to focus on " + focus + ".";
  return { stages, worst, note };
}

/** Instructions for every market in the grid, grouped by owning department, biggest money first. */
export function instructionsOf(groups: GridGroup[], p: Period, cal: Cal, avenue: string, perLane = 5): Record<Dept, Instruction[]> {
  const out: Record<Dept, Instruction[]> = { "Performance Marketing": [], Marketing: [], Sales: [], "Customer Service": [] };
  const minSpend = p.cadence === "Daily" ? 300 : 1500;
  const due = (days: number) => { const d = new Date(cal.yest); d.setDate(d.getDate() + days); return dLbl(d); };
  const soon = due(7), later = due(21);
  const push = (i: Instruction) => out[i.dept].push(i);

  for (const g of groups) {
    if (g.tot || g.name === "Other") continue;
    const a = g.act, pl = g.pl, m = g.name;
    const base = { market: m, avenue, stake: Math.max(a.Spend, pl.Spend) };
    const headroom = Math.max(pl.Spend - a.Spend, 0);

    // Unplanned market that still produces leads: pilot, not silence.
    if (pl.Spend === 0) {
      if (a.Leads >= 3) push({ ...base, dept: "Performance Marketing", verb: "PILOT", title: "PILOT MARKET", nums: n(a.Leads) + " leads with no budget", text: "Approve a capped pilot of " + money(2000) + " for " + m + " and report cost per funded account by " + later + ".", due: later });
      continue;
    }
    if (a.Spend < minSpend) {
      if (a.Spend > 0) push({ ...base, dept: "Performance Marketing", verb: "HOLD", title: "HOLD BUDGET", nums: money(a.Spend) + " spent of " + money(pl.Spend) + " plan", text: "Too little spend to judge. Hold at current level; review on " + soon + " once spend passes " + money(minSpend) + ".", due: soon });
      continue;
    }

    // Money decisions (Performance Marketing).
    if (a.FundedAccounts === 0 && a.ROI < 0.3) {
      push({ ...base, dept: "Performance Marketing", verb: "STOP", title: "STOP FUNDING", nums: money(a.Spend) + " spent, 0 funded accounts, " + n(a.Leads) + " leads", text: "Stop " + m + " " + avenue + " from tomorrow. Move the remaining " + money(headroom) + " to the SCALE markets. Re-enter only with a written test plan.", due: soon });
    } else if (a.FundedAccounts > 0 && a.ROI >= 1) {
      push({ ...base, dept: "Performance Marketing", verb: "SCALE", title: "SCALE FUNDING", nums: "return " + pct(a.ROI) + ", " + n(a.FundedAccounts) + " funded at " + fmt(a.CPFA, "$2") + " each", text: "Raise " + m + " budget 30% per week while cost per funded account stays under " + fmt(pl.CPFA, "$2") + ". Headroom to plan " + money(headroom) + ".", due: soon });
    } else if (pl.Spend > 0 && a.Spend < pl.Spend * 0.6 && a.ROI >= 0.5) {
      push({ ...base, dept: "Performance Marketing", verb: "FIX", title: "UNBLOCK DELIVERY", nums: money(a.Spend) + " spent of " + money(pl.Spend) + " plan (" + pct(a.Spend / pl.Spend) + ")", text: "Under-delivering, not over-spending. Unblock " + m + " delivery (caps, disapprovals, bids) and reach plan pace by " + soon + ".", due: soon });
    } else if (a.Clicks > 0 && pl.CPC > 0 && a.CPC > pl.CPC * 1.3) {
      push({ ...base, dept: "Performance Marketing", verb: "FIX", title: "FIX CLICK COST", nums: "CPC " + fmt(a.CPC, "$2") + " vs " + fmt(pl.CPC, "$2") + " plan", text: "Bring " + m + " cost per click to plan: bid down, drop the placements with no leads in 30 days. Report CPC weekly.", due: later });
    } else if (a.Impressions > 0 && a.CTR < PLAN_CTR * 0.6) {
      push({ ...base, dept: "Performance Marketing", verb: "FIX", title: "FIX AD CREATIVE", nums: "CTR " + fmt(a.CTR, "pct2") + " vs " + pct(PLAN_CTR) + " plan", text: "Ads in " + m + " are not getting clicked. Refresh headlines and creatives; report CTR by " + later + ".", due: later });
    }

    // Lead cost and client quality (Marketing).
    if (a.Leads > 0 && pl.CPL > 0 && a.CPL > pl.CPL * 1.5) {
      push({ ...base, dept: "Marketing", verb: "FIX", title: "FIX LEAD COST", nums: "CPL " + fmt(a.CPL, "$2") + " vs " + fmt(pl.CPL, "$2") + " plan", text: "Leads in " + m + " cost " + fmt(a.CPL / pl.CPL, "x") + " plan. Localise the landing page and offer for " + m + "; target CPL " + fmt(pl.CPL, "$2") + " by " + later + ".", due: later });
    }
    if (a.FTDAccounts > 0 && pl.AvgAccountSize > 0 && a.AvgAccountSize < pl.AvgAccountSize * 0.7) {
      push({ ...base, dept: "Marketing", verb: "FIX", title: "FIX CLIENT QUALITY", nums: "avg first deposit " + money(a.AvgAccountSize) + " vs " + money(pl.AvgAccountSize) + " plan", text: "Clients in " + m + " deposit small. Drop promo angles, target professional and higher-income segments; report average first deposit by " + later + ".", due: later });
    }

    // Conversion after the lead (Sales, Customer Service).
    const planL2A = pl.LeadToAcct || 0.35;
    if (a.Leads >= 20 && a.LeadToAcct < planL2A * 0.7) {
      push({ ...base, dept: "Sales", verb: "FIX", title: "FIX LEAD FOLLOW-UP", nums: n(a.Leads) + " leads became " + n(a.LiveAccounts) + " accounts (" + pct(a.LeadToAcct) + " vs " + pct(planL2A) + ")", text: "Call every " + m + " lead within 15 minutes and follow up on WhatsApp the same day. Report lead-to-account rate by " + soon + ".", due: soon });
    }
    if (a.LiveAccounts >= 10 && a.Conv < PLAN_CONV * 0.7) {
      push({ ...base, dept: "Sales", verb: "FIX", title: "FIX ACCOUNT FUNDING", nums: n(a.LiveAccounts) + " accounts gave " + n(a.FundedAccounts) + " deposits (" + pct(a.Conv) + " vs " + pct(PLAN_CONV) + ")", text: "Explain why " + m + " accounts do not fund: call every open account within 48 hours with a guided first trade. Report root cause and funded count by " + soon + ".", due: soon });
      push({ ...base, dept: "Customer Service", verb: "CHECK", title: "CHECK ONBOARDING", nums: n(a.LiveAccounts) + " accounts, " + n(a.FundedAccounts) + " funded", text: "Check KYC drop-off and deposit methods for " + m + " clients; confirm local payment rails and local-language support work. Report by " + soon + ".", due: soon });
    }
    if (a.Redeposit > 10000 && a.Redeposit > a.FTD * 5) {
      push({ ...base, dept: "Customer Service", verb: "CHECK", title: "PROTECT RETENTION", nums: "re-deposits " + money(a.Redeposit) + " vs first deposits " + money(a.FTD), text: "Deposits in " + m + " come from existing clients, not this period's ads. Protect the retention programme; judge acquisition on first deposits only.", due: later });
    }
  }
  for (const d of DEPTS) out[d] = out[d].sort((x, y) => y.stake - x.stake).slice(0, perLane);
  return out;
}
