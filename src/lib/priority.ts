// Priority tiers for the AI recommendation visuals: most urgent first. Shared by every candidate layout.
import { DEPTS, type Instruction, type Verb } from "./instruct";
import { money } from "./format";

export type Lanes = Record<(typeof DEPTS)[number], Instruction[]>;
export type Tier = { key: string; verbs: Verb[]; head: string; tag: string; empty: string; color: string; pastel: string; ink: string };
export type TierItems = Tier & { items: Instruction[]; stake: number };

export const TIERS: Tier[] = [
  { key: "stop", verbs: ["STOP"], head: "Stop", tag: "money in, nothing out: stop and move the budget", empty: "no market needs stopping", color: "#dc2626", pastel: "#fbd5d8", ink: "#9f1d28" },
  { key: "scale", verbs: ["SCALE"], head: "Scale", tag: "markets that pay back: raise budget", empty: "no market pays back yet", color: "#16a34a", pastel: "#cfeedd", ink: "#14532d" },
  { key: "fix", verbs: ["FIX"], head: "Fix", tag: "delivery, click cost, lead cost, follow-up, funding", empty: "nothing to fix", color: "#d97706", pastel: "#fdf0c2", ink: "#7a4f00" },
  { key: "check", verbs: ["CHECK"], head: "Check", tag: "onboarding, payments, retention", empty: "nothing to check", color: "#2e75b6", pastel: "#dbe8f6", ink: "#1f4e79" },
  { key: "hold", verbs: ["HOLD", "PILOT"], head: "Watch & test", tag: "too early to judge, or a pilot worth a capped budget", empty: "nothing to watch", color: "#6b7280", pastel: "#e5e7eb", ink: "#374151" },
];

/** Every instruction grouped by tier, biggest money first inside each tier. */
export function tierItems(lanes: Lanes): TierItems[] {
  const all = DEPTS.flatMap((d) => lanes[d]);
  return TIERS.map((t) => {
    const items = all.filter((x) => t.verbs.includes(x.verb)).sort((a, b) => b.stake - a.stake);
    return { ...t, items, stake: items.reduce((s, x) => s + x.stake, 0) };
  });
}

/** Plain words for each instruction: what to do, and why, in the language a chairman uses. */
export function plain(x: Instruction): { do: string; why: string } {
  const m = x.market;
  const DO: Record<string, string> = {
    "STOP FUNDING": "Stop the ads in " + m + " from tomorrow and move the leftover budget to markets that pay.",
    "SCALE FUNDING": "Give " + m + " 30% more budget each week while the cost per funded account holds.",
    "UNBLOCK DELIVERY": "Get " + m + " spending at the planned pace: clear the caps, disapprovals and bids.",
    "FIX CLICK COST": "Bring the click price in " + m + " back to plan: lower bids, drop placements with no leads.",
    "FIX AD CREATIVE": "Refresh the ads in " + m + ": new headlines and new creatives.",
    "FIX LEAD COST": "Make " + m + " leads cheaper: local landing page and a local offer.",
    "FIX CLIENT QUALITY": "Aim " + m + " ads at people who deposit more; drop the promo angles.",
    "FIX LEAD FOLLOW-UP": "Call every " + m + " lead within 15 minutes and follow up the same day.",
    "FIX ACCOUNT FUNDING": "Call every open " + m + " account within 48 hours and walk them through a first trade.",
    "CHECK ONBOARDING": "Check where " + m + " clients drop out after sign-up: KYC, payment methods, local language.",
    "PROTECT RETENTION": "Keep the " + m + " retention programme running and judge new ads on first deposits only.",
    "HOLD BUDGET": "Hold " + m + " at today's budget and look again once spend is big enough to judge.",
    "PILOT MARKET": "Run a small, capped pilot in " + m + ".",
  };
  const WHY: Record<string, string> = {
    "STOP FUNDING": "the money went in and nothing came back",
    "SCALE FUNDING": "every dollar here comes back with more",
    "UNBLOCK DELIVERY": "the budget is sitting unspent",
    "FIX CLICK COST": "each click costs more than planned",
    "FIX AD CREATIVE": "people see the ads but do not click",
    "FIX LEAD COST": "each lead costs more than planned",
    "FIX CLIENT QUALITY": "the clients we win deposit very little",
    "FIX LEAD FOLLOW-UP": "too few leads turn into accounts",
    "FIX ACCOUNT FUNDING": "accounts open but no money goes in",
    "CHECK ONBOARDING": "something after sign-up is losing clients",
    "PROTECT RETENTION": "the deposits come from existing clients, not from new ads",
    "HOLD BUDGET": "there is too little spend to judge yet",
    "PILOT MARKET": "leads are arriving with no budget behind them",
  };
  return { do: DO[x.title] ?? x.text, why: "We need to do this because " + (WHY[x.title] ?? "the numbers are off plan") + ": " + x.nums + "." };
}

/** One line per instruction, the "do" part only, market first. */
export const oneLiner = (x: Instruction) => plain(x).do;
export const stakeLabel = (t: TierItems) => (t.items.length ? t.items.length + (t.items.length === 1 ? " action · " : " actions · ") + money(t.stake) + " at stake" : "no action");
