"use client";

import { Fragment, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ITEM, Pill } from "./motion";
import { Accordion } from "./Accordion";
import { buildCard, recRows, type Agg, type Cal, type Hist, type MonthData, type Period, type RecRow } from "@/lib/engine";
import { fmt, money } from "@/lib/format";
import { Flag } from "./Flag";
import { Mermaid } from "./Mermaid";
import { EChart, type Option } from "./EChart";
import type { FixNode } from "@/lib/engine";

const TONE: Record<string, { fill: string; border: string; text: string }> = {
  bad: { fill: "#fbe4e7", border: "#dc2626", text: "#a63a45" },
  warn: { fill: "#fdf1cf", border: "#d97706", text: "#8a6100" },
  good: { fill: "#e4f4ea", border: "#16a34a", text: "#1d6b3c" },
  dept: { fill: "#e9f0f8", border: "#2f5d8a", text: "#2f5d8a" },
};

/** Mindmap as an ECharts tree: market root, department branches, task leaves. */
function treeOption(root: FixNode): Option {
  // Label placement keeps text off the edges: root to the left, departments above their node, tasks to the right.
  const style = (n: FixNode, depth: number) => {
    const t = TONE[n.tone ?? ""] ?? null;
    if (depth === 2 || !t) return { itemStyle: { color: "#fff", borderColor: "#cfd4dc" }, label: { color: "#1a1d23", fontWeight: 400, position: "right", align: "left" } };
    if (depth === 0) return { itemStyle: { color: t.fill, borderColor: t.border }, label: { color: t.text, fontWeight: 700, position: "left", align: "right", fontSize: 13 } };
    return { itemStyle: { color: t.fill, borderColor: t.border }, label: { color: t.text, fontWeight: 600, position: "top", align: "center", distance: 8 } };
  };
  const conv = (n: FixNode, depth: number): Record<string, unknown> => ({
    name: n.name, ...style(n, depth), children: n.children?.map((c) => conv(c, depth + 1)),
  });
  return {
    animation: false,
    textStyle: { fontFamily: "Inter, sans-serif" },
    tooltip: { show: false },
    series: [{
      type: "tree", data: [conv(root, 0)], layout: "orthogonal", orient: "LR", top: 24, bottom: 10, left: 200, right: 280,
      symbol: "roundRect", symbolSize: [10, 10], edgeShape: "curve", edgeForkPosition: "60%", initialTreeDepth: -1, expandAndCollapse: false,
      lineStyle: { color: "#cfd4dc", width: 1.5 },
      label: { position: "right", verticalAlign: "middle", align: "left", fontSize: 12, backgroundColor: "transparent", padding: [3, 8], borderRadius: 6 },
      leaves: { label: { position: "right", align: "left" } },
    }],
  };
}

/** Renders "**bold**" markers as <b>. */
function Rich({ text }: { text: string }) {
  const parts = text.split("**");
  return <>{parts.map((s, i) => (i % 2 ? <b key={i}>{s}</b> : <Fragment key={i}>{s}</Fragment>))}</>;
}

type CardProps = { r: RecRow; period: Period; cal: Cal; hist: Hist; months: MonthData[]; open: boolean };

function Card({ r, period, cal, hist, months, open }: CardProps) {
  // Body (and its mermaid render) only mounts once the card is expanded; keeps tab switches fast.
  const [isOpen, setOpen] = useState(open);
  const m = useMemo(() => (isOpen ? buildCard(r, period, cal, hist, months) : null), [isOpen, r, period, cal, hist, months]);
  return (
    <details className={"rc " + r.kind} open={isOpen} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <Flag country={r.c} />
        <span className="act">{r.kind === "stop" ? "Stop spending" : "Spend more"}</span>
        <span className="who">{r.c} · {r.chanS}</span>
        <span className="kpi">
          <b>{money(r.Spend)}</b><i>spent</i><b>{fmt(r.FundedAccounts, "n")}</b><i>funded</i><b>{r.ROI.toFixed(2)}</b><i>ROI</i>
        </span>
      </summary>
      {m && (
      <div className="body">
        <div className="left">
          <section><h4>Why?</h4><blockquote className="why">{m.why}</blockquote></section>
          <section>
            <h4>Reasoning</h4>
            <Mermaid code={m.mermaid} />
            <ul className="rsn">{m.reasoning.map((t, i) => <li key={i}><Rich text={t} /></li>)}</ul>
          </section>
          <Accordion title="What to fix" meta="what each department can do">
            <EChart option={treeOption(m.fixTree)} height={Math.max(260, 26 * m.fixTree.children!.reduce((s, d) => s + (d.children?.length ?? 0), 0) + 40)} />
          </Accordion>
          <Accordion title="Data points" meta={m.given.length + " rows, diff is actual - expected"}>
            <table className="gt">
              <thead><tr><th></th><th>Expected</th><th>Actual</th><th title="Actual - Expected">Diff</th></tr></thead>
              <tbody>
                {m.given.map((g) => (
                  <tr key={g.label}>
                    <th>{g.label}</th>
                    <td>{g.e ? fmt(g.e, g.f) : "-"}</td>
                    <td>{g.a === null ? "-" : fmt(g.a, g.f)}</td>
                    <td className={g.status}>{g.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Accordion>
        </div>
        <aside className="side">
          <h4>Conclusion</h4>
          <ul className="cta">
            {m.actions.map((a, i) => <li key={i}><span className="verb">{a.verb}</span><span><Rich text={a.text} /></span></li>)}
          </ul>
        </aside>
      </div>
      )}
    </details>
  );
}

type Props = { agg: Agg; period: Period; cal: Cal; hist: Hist; months: MonthData[]; enabled: Set<string> };

export function Recs({ agg, period, cal, hist, months, enabled }: Props) {
  const [rtab, setRtab] = useState<"stop" | "grow">("stop");
  const rows = recRows(agg, period, hist, enabled);
  const stops = rows.filter((r) => r.kind === "stop").sort((a, b) => b.Spend - a.Spend);
  const grows = rows.filter((r) => r.kind === "grow").sort((a, b) => b.ROI - a.ROI);
  const list = rtab === "stop" ? stops : grows;
  const key = (r: RecRow) => period.id + "|" + r.chan + "|" + r.c;
  return (
    <div id="recs">
      <LayoutGroup id="rtabs">
        <div className="rtabs">
          {([["stop", "Stop spending", stops.length], ["grow", "Spend more", grows.length]] as const).map(([id, lbl, n]) => (
            <button type="button" key={id} className={rtab === id ? "on" : ""} onClick={() => setRtab(id)}>
              {rtab === id && <Pill id="rtab" className="rpill" />}
              <span className="rl">{lbl} <span>{n}</span></span>
            </button>
          ))}
        </div>
      </LayoutGroup>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={rtab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
          {list.length
            ? list.map((r, i) => (
              <motion.div key={key(r)} {...ITEM(i)}>
                <Card r={r} period={period} cal={cal} hist={hist} months={months} open={i === 0} />
              </motion.div>
            ))
            : <p className="empty">No market meets the {rtab} rule for {period.label}.</p>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
