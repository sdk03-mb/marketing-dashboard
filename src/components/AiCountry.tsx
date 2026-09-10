import { buildGrid, type Agg, type Period } from "@/lib/engine";
import { COUNTRIES } from "@/lib/plan";
import { fmt } from "@/lib/format";
import { AI_COUNTRY, type Verdict } from "@/content/aiCountry";
import { Flag } from "./Flag";
import { Marks as ChannelIcon } from "./ChannelPicker";
import { WorldMap } from "./WorldMap";
import { SatMap, hasSatellite } from "./SatMap";

const AVENUES = ["PPC / Google Search", "Instagram + Facebook"] as const;
const short = (ch: string) => ch.replace(" / Google Search", "");
const TONE: Record<Verdict, string> = { "Test carefully": "good", "Improve first": "warn", "Check funding": "bad", "Check records": "mute" };
// Tags read ACTION METRIC.
const TAG: Record<Verdict, string> = { "Test carefully": "TEST CPFA", "Improve first": "IMPROVE CPFA", "Check funding": "CHECK DEPOSITS", "Check records": "CHECK RECORDS" };

/** Countries in the plan list that have a written recommendation, biggest spend first. */
export function aiCountries(agg: Agg, period: Period): string[] {
  const g = buildGrid(agg, period, "All Channels (combined)", new Set<string>([...COUNTRIES]));
  return g.groups.filter((x) => !x.tot && AI_COUNTRY[x.name]).sort((a, b) => b.act.Spend - a.act.Spend).map((x) => x.name);
}

/** Channel box: logo, the three figures for this country and avenue, and a rule-based line under them. Greyed out when the avenue carries no spend here. */
function ChannelBox({ agg, period, country, avenue }: { agg: Agg; period: Period; country: string; avenue: string }) {
  const g = buildGrid(agg, period, avenue, new Set([country]));
  const grp = g.groups.find((x) => x.name === country);
  const used = !!grp && grp.act.Spend > 0;
  if (!used) {
    return (
      <div className="aic-box off">
        <div className="aic-bh"><ChannelIcon chan={avenue} /><b>{short(avenue)}</b></div>
        <p className="aic-none">We do not run {short(avenue)} ads in {country}.</p>
      </div>
    );
  }
  const a = grp.act, pl = grp.pl;
  const funded = a.FundedAccounts > 0;
  // Verdict for the avenue from its own figures: no funded account = check funding; CPFA within plan = test a small increase; else improve first.
  const call = !funded ? { k: "bad", t: "CHECK DEPOSITS", s: "Money was spent, but nobody paid into an account. Check that sign-up and payment work before spending more." }
    : pl.CPFA > 0 && a.CPFA <= pl.CPFA ? { k: "good", t: "TEST CPFA", s: "Each paying customer cost less than planned. Try a small increase and watch how many pay in." }
    : { k: "warn", t: "IMPROVE CPFA", s: "Each paying customer cost more than planned. Fix the ads and the sign-up steps before spending more." };
  return (
    <div className={"aic-box " + call.k}>
      <div className="aic-bh"><ChannelIcon chan={avenue} /><b>{short(avenue)}</b><span className={"aic-tag " + call.k}>{call.t}</span></div>
      <div className="aic-figs">
        <div><small>Spend</small><b>{fmt(a.Spend, "$0")}</b></div>
        <div><small>Paying customers</small><b>{fmt(a.FundedAccounts, "n")}</b></div>
        <div><small>CPFA</small><b>{funded ? fmt(a.CPFA, "$0") : "N/A"}</b><i>{pl.CPFA > 0 ? "plan " + fmt(pl.CPFA, "$0") : ""}</i></div>
        <div><small>Avg paid in</small><b>{a.FTDAccounts > 0 ? fmt(a.AvgAccountSize, "$0") : "N/A"}</b><i>{pl.AvgAccountSize > 0 ? "plan " + fmt(pl.AvgAccountSize, "$0") : ""}</i></div>
        <div><small>CPL</small><b>{a.Leads > 0 ? fmt(a.CPL, "$0") : "N/A"}</b><i>{pl.CPL > 0 ? "plan " + fmt(pl.CPL, "$0") : ""}</i></div>
      </div>
      <p className="aic-line">{call.s}</p>
    </div>
  );
}

/** One country per page: the country alone on the map, the written call, then the two channel boxes. */
export function AiCountryCard({ agg, period, country }: { agg: Agg; period: Period; country: string }) {
  const rec = AI_COUNTRY[country];
  const g = buildGrid(agg, period, "All Channels (combined)", new Set<string>([...COUNTRIES]));
  return (
    <div className="aic">
      <div className="aic-head">
        <Flag country={country} /><h2>{country}</h2>
        <span className={"aic-tag big " + TONE[rec.verdict]}>{TAG[rec.verdict]}</span>
      </div>
      <div className="aic-body">
        <div className={"aic-map" + (hasSatellite() ? " sat" : "")}>{hasSatellite() ? <SatMap country={country} /> : <WorldMap groups={g.groups} focus={[country]} only pad={140} labels={false} />}</div>
        <div className="aic-side">
          <div className="aic-text">
            <p><b>What happened</b>{rec.happened}</p>
            <p><b>What to do</b>{rec.action}</p>
          </div>
          {AVENUES.map((av) => <ChannelBox key={av} agg={agg} period={period} country={country} avenue={av} />)}
        </div>
      </div>
    </div>
  );
}

/** Overview board: one column per call (ACTION METRIC), one card per shared "how", listing the countries that need it. */
export function AiBoard({ countries }: { countries: string[] }) {
  const order: Verdict[] = ["Test carefully", "Improve first", "Check funding", "Check records"];
  const cols = order.map((v) => {
    const cs = countries.filter((c) => AI_COUNTRY[c]?.verdict === v);
    const cards = new Map<string, string[]>();
    for (const c of cs) { const h = AI_COUNTRY[c].how; cards.set(h, [...(cards.get(h) ?? []), c]); }
    return { v, tag: TAG[v], tone: TONE[v], cs, cards: [...cards.entries()].sort((a, b) => b[1].length - a[1].length) };
  }).filter((col) => col.cs.length > 0);
  return (
    <div className="aib" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
      {cols.map((col) => (
        <div key={col.v} className={"aib-col " + col.tone}>
          <div className="aib-head"><b>{col.tag}</b><small>{col.cs.length} {col.cs.length === 1 ? "country" : "countries"}</small></div>
          <div className="aib-cards">
            {col.cards.map(([how, cs]) => (
              <div key={how} className="aib-card">
                <ul className="aib-flags">{cs.map((c) => <li key={c}><Flag country={c} />{c}</li>)}</ul>
                <div className="aib-need">We need to <b>{col.tag}</b> by:</div>
                <ul className="aib-how"><li>{how}</li></ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Per-avenue board from the figures. Columns by CPFA: Excellent (within plan), Average (up to 3x plan), Poor (dearer, or nobody paid in).
 *  Inside each column, one card per action: the CPFA call, then one card per other figure that is off plan (CPC, CPL, CPA, average paid in). */
export function AiAvenueBoard({ agg, period, avenue }: { agg: Agg; period: Period; avenue: string }) {
  const g = buildGrid(agg, period, avenue, new Set<string>([...COUNTRIES]));
  const mk = g.groups.filter((x) => !x.tot && x.act.Spend > 0).sort((a, b) => b.act.Spend - a.act.Spend);
  type Chip = { name: string; v: string };
  type Card = { tag: string; how: string; cs: Chip[] };
  const band = (x: (typeof mk)[number]) => {
    const a = x.act, B = x.pl.CPFA;
    if (a.FundedAccounts === 0) return 2;
    if (B > 0 && a.CPFA <= B) return 0;
    if (B > 0 && a.CPFA <= B * 3) return 1;
    return 2;
  };
  // Other figures, checked against plan with a 10% allowance. Cost figures want low; average paid in wants high.
  const METRIC_CARDS: { k: "CPC" | "CPL" | "CPA" | "AvgAccountSize"; tag: string; how: string; cost: boolean; f: "$0" | "$2"; ready: (x: (typeof mk)[number]) => boolean }[] = [
    { k: "CPC", tag: "IMPROVE CPC", how: "Clicks cost more than planned. Lower the bids and drop the search terms or placements that bring no leads.", cost: true, f: "$2", ready: (x) => x.act.Clicks > 0 },
    { k: "CPL", tag: "IMPROVE CPL", how: "Leads cost more than planned. Make the landing page local and the sign-up form shorter.", cost: true, f: "$0", ready: (x) => x.act.Leads > 0 },
    { k: "CPA", tag: "IMPROVE CPA", how: "Accounts cost more than planned. Call every lead within 15 minutes and follow up the same day.", cost: true, f: "$0", ready: (x) => x.act.LiveAccounts > 0 },
    { k: "AvgAccountSize", tag: "RAISE AVG PAID IN", how: "Customers pay in less than planned. Aim the ads at professional traders and drop bonus offers.", cost: false, f: "$0", ready: (x) => x.act.FTDAccounts > 0 },
  ];
  const cols = [
    { head: "Excellent performers", tone: "good", cpfa: { tag: "TEST CPFA", how: "Each paying customer cost less than planned. Give these ads a little more money and watch how many customers pay in." } },
    { head: "Average performers", tone: "warn", cpfa: { tag: "IMPROVE CPFA", how: "Each paying customer cost more than planned, but not wildly. Fix the weak ads and the sign-up steps before spending more." } },
    { head: "Poor performers", tone: "bad", cpfa: { tag: "CUT CPFA", how: "Each paying customer cost more than three times the plan. Cut the weak ads and keep only a small test." } },
  ].map((col, i) => {
    const xs = mk.filter((x) => band(x) === i);
    const cards: Card[] = [];
    const chip = (x: (typeof mk)[number]) => ({ name: x.name, v: x.act.FundedAccounts > 0 ? fmt(x.act.CPFA, "$0") : "N/A" });
    if (i === 2) {
      const none = xs.filter((x) => x.act.FundedAccounts === 0), dear = xs.filter((x) => x.act.FundedAccounts > 0);
      if (none.length) cards.push({ tag: "CHECK DEPOSITS", how: "Money was spent, but nobody paid into an account. Check the records, sign-up and payment before spending more.", cs: none.map(chip) });
      if (dear.length) cards.push({ tag: col.cpfa.tag, how: col.cpfa.how, cs: dear.map(chip) });
    } else if (xs.length) cards.push({ tag: col.cpfa.tag, how: col.cpfa.how, cs: xs.map(chip) });
    for (const m of METRIC_CARDS) {
      const off = xs.filter((x) => m.ready(x) && x.pl[m.k] > 0 && (m.cost ? x.act[m.k] > x.pl[m.k] * 1.1 : x.act[m.k] < x.pl[m.k] * 0.9));
      if (off.length) cards.push({ tag: m.tag, how: m.how, cs: off.map((x) => ({ name: x.name, v: fmt(x.act[m.k], m.f) + " vs " + fmt(x.pl[m.k], m.f) })) });
    }
    return { ...col, n: xs.length, cards };
  });
  const bench = g.groups.find((x) => x.tot)?.pl.CPFA ?? 0;
  return (
    <div className="aib withfoot dense" style={{ gridTemplateColumns: cols.map((c) => `minmax(240px, ${Math.max(1, c.cards.length)}fr)`).join(" ") }}>
      {cols.map((col) => (
        <div key={col.head} className={"aib-col " + col.tone}>
          <div className="aib-head"><b>{col.head}</b><small>{col.n} {col.n === 1 ? "country" : "countries"}</small></div>
          <div className={"aib-cards" + (col.cards.length > 4 ? " two" : "")}>
            {col.cards.map((c) => (
              <div key={c.tag} className="aib-card">
                <div className="aib-need">We need to <b>{c.tag}</b> in:</div>
                <ul className="aib-flags">{c.cs.map((x) => <li key={x.name}><Flag country={x.name} />{x.name} <span>({x.v})</span></li>)}</ul>
                <ul className="aib-how"><li>{c.how}</li></ul>
              </div>
            ))}
            {col.n === 0 && <p className="aib-empty">No country here this period.</p>}
          </div>
        </div>
      ))}
      <div className="aib-foot">Columns by CPFA against the {short(avenue)} plan of {bench > 0 ? fmt(bench, "$0") : "n/a"}: Excellent at or under plan, Average up to three times plan, Poor dearer than that or nobody paid in. Brackets show the figure, or the figure against its plan.</div>
    </div>
  );
}
