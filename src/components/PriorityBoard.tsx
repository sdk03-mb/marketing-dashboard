import { plain, stakeLabel, tierItems, type Lanes } from "@/lib/priority";
import { Flag } from "./Flag";

/** Option 3, board: five columns, most urgent on the left, one card per instruction, biggest money on top. */
export function PriorityBoard({ lanes, max = 6 }: { lanes: Lanes; max?: number }) {
  const tiers = tierItems(lanes);
  return (
    <div className="kb">
      {tiers.map((t, i) => (
        <div key={t.key} className="kb-col">
          <div className="kb-head" style={{ background: t.color }}>
            <b>{i + 1}. {t.head}</b>
            <small>{stakeLabel(t)}</small>
          </div>
          <div className="kb-cards" style={{ background: t.pastel }}>
            {t.items.length ? t.items.slice(0, max).map((x) => (
              <div key={x.title + x.market + x.dept} className="kb-card">
                <div className="kb-ct"><Flag country={x.market} /><b>{x.market}</b></div>
                <div className="kb-do">{plain(x).do}</div>
                <div className="kb-cn">{plain(x).why}</div>
                <div className="kb-cf">{x.dept}, by {x.due}.</div>
              </div>
            )) : <p className="kb-empty">{t.empty}</p>}
            {t.items.length > max && <p className="kb-more">+{t.items.length - max} more</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
