import type { GridGroup } from "@/lib/engine";
import { DEPTS, type Instruction } from "@/lib/instruct";
import { fmt, money } from "@/lib/format";
import { Flag } from "./Flag";

type Lanes = Record<(typeof DEPTS)[number], Instruction[]>;
type Row = { name: string; from: number; to: number; move: number; line: string };

const MID = 220;

/** Budget shift board: money leaves the markets on the left, arrives at the markets on the right; one line per market says what to do and why. */
export function BudgetShift({ groups, lanes, max = 5, rowH: ROW = 64, dense }: { groups: GridGroup[]; lanes: Lanes; max?: number; rowH?: number; dense?: boolean }) {
  const all = DEPTS.flatMap((d) => lanes[d]);
  const byName = new Map(groups.filter((g) => !g.tot).map((g) => [g.name, g]));
  const pick = (verb: Instruction["verb"]) => all.filter((x) => x.verb === verb).sort((a, b) => b.stake - a.stake).slice(0, max);
  const n = (v: number) => fmt(v, "n");

  // Losing side: stop markets. Freed money = what is left of the plan, the same figure the STOP instruction quotes.
  const lose: Row[] = pick("STOP").flatMap((x) => {
    const g = byName.get(x.market); if (!g) return [];
    const a = g.act, headroom = Math.max(g.pl.Spend - a.Spend, 0);
    return [{ name: x.market, from: a.Spend, to: 0, move: headroom, line: money(a.Spend) + " spent, " + n(a.FundedAccounts) + " funded, " + n(a.Leads) + " leads went nowhere." }];
  });
  // Gaining side: scale markets, +30% as the SCALE instruction says.
  const gain: Row[] = pick("SCALE").flatMap((x) => {
    const g = byName.get(x.market); if (!g) return [];
    const a = g.act;
    return [{ name: x.market, from: a.Spend, to: a.Spend * 1.3, move: a.Spend * 0.3, line: "every $1 returns $" + a.ROI.toFixed(2) + ", " + n(a.FundedAccounts) + " funded at " + money(a.CPFA) + " each." }];
  });
  const freed = lose.reduce((s, r) => s + r.move, 0);
  const scale = Math.max(1, ...lose.map((r) => r.from), ...gain.map((r) => r.to));

  const H = Math.max(lose.length, gain.length, 1) * ROW;
  const hub = H / 2;
  const headline = lose.length && gain.length
    ? "Move " + money(freed) + " from " + lose.length + (lose.length === 1 ? " market" : " markets") + " to " + gain.length + (gain.length === 1 ? " market" : " markets") + "."
    : lose.length ? "Stop " + lose.length + (lose.length === 1 ? " market" : " markets") + " and hold " + money(freed) + " until a market earns it."
    : gain.length ? "Nothing to stop. Raise budget in " + gain.length + (gain.length === 1 ? " market" : " markets") + " that pay back."
    : "No budget moves this period. Work the fix list.";

  const Bar = ({ r, side }: { r: Row; side: "lose" | "gain" }) => (
    <div className={"bs-row " + side} style={{ height: ROW }}>
      <div className="bs-head"><Flag country={r.name} /><b>{r.name}</b><span>{money(r.from)} → {money(r.to)}</span></div>
      <div className="bs-bar">
        <i className="now" style={{ width: (r.from / scale) * 100 + "%" }} />
        <i className="next" style={{ width: (r.to / scale) * 100 + "%" }} />
      </div>
      <small>{side === "lose" ? "Stop " : "Scale "}{r.name}: {r.line}</small>
    </div>
  );

  return (
    <div className={"bs" + (dense ? " dense" : "")}>
      <h2 className="bs-title">{headline}</h2>
      <div className="bs-grid">
        <div className="bs-col"><div className="bs-ch lose">Stop funding</div>{lose.length ? lose.map((r) => <Bar key={r.name} r={r} side="lose" />) : <p className="bs-none">No market needs stopping.</p>}</div>
        <svg className="bs-mid" width={MID} height={H + 40} viewBox={`0 0 ${MID} ${H + 40}`} aria-hidden="true">
          {/* Every losing row flows into a hub, the hub fans out to every gaining row. Stroke width follows the money. */}
          {lose.map((r, i) => {
            const y = 40 + i * ROW + ROW / 2 - 14, w = 2 + (freed ? (r.move / freed) * 14 : 4);
            return <path key={"l" + r.name} d={`M0,${y} C${MID / 4},${y} ${MID / 4},${hub + 40} ${MID / 2},${hub + 40}`} strokeWidth={w} />;
          })}
          {gain.map((r, i) => {
            const y = 40 + i * ROW + ROW / 2 - 14, tot = gain.reduce((s, x) => s + x.move, 0), w = 2 + (tot ? (r.move / tot) * 14 : 4);
            return <path key={"g" + r.name} d={`M${MID / 2},${hub + 40} C${(MID * 3) / 4},${hub + 40} ${(MID * 3) / 4},${y} ${MID},${y}`} strokeWidth={w} />;
          })}
          <circle cx={MID / 2} cy={hub + 40} r={dense ? 44 : 34} className="bs-hub" />
          <text x={MID / 2} y={hub + 36} textAnchor="middle" className="bs-hubv">{money(freed)}</text>
          <text x={MID / 2} y={hub + 52} textAnchor="middle" className="bs-hubl">moves</text>
        </svg>
        <div className="bs-col"><div className="bs-ch gain">Scale funding</div>{gain.length ? gain.map((r) => <Bar key={r.name} r={r} side="gain" />) : <p className="bs-none">No market pays back yet.</p>}</div>
      </div>
    </div>
  );
}
