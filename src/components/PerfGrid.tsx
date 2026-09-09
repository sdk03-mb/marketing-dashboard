"use client";

import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { buildGrid, type Agg, type Period } from "@/lib/engine";
import { fmt, signed } from "@/lib/format";
import { Flag } from "./Flag";

type Props = { agg: Agg; period: Period; chan: string; enabled: Set<string>; metrics?: Set<string> };

export function PerfGrid({ agg, period, chan, enabled, metrics }: Props) {
  const G = buildGrid(agg, period, chan, enabled);
  // Row filter by metric label; undefined means show everything.
  const rows = metrics ? G.rows.filter((r) => metrics.has(r.m.l)) : G.rows;
  const ref = useRef<HTMLDivElement>(null);
  const empty = G.groups.length === 0;
  // Hover tint: the cell, its row, and its single column.
  const [hot, setHot] = useState<{ r: number; c: number } | null>(null);
  const hv = (r: number, c: number) => (hot && hot.r === r && hot.c === c ? " hcell" : "");
  const nCols = 1 + G.groups.length * 3 + 1;

  // Pin the total group (Expected / Actual / Diff) after the sticky row header.
  useLayoutEffect(() => {
    const stick = () => {
      const tbl = ref.current?.querySelector<HTMLTableElement>("table.xl"); if (!tbl) return;
      const row = [...tbl.tBodies[0].rows].find((r) => [...r.cells].some((c) => c.classList.contains("tot"))); if (!row) return;
      const tots = [...row.cells].filter((c) => c.classList.contains("tot"));
      let x = row.cells[0].offsetWidth;
      const lefts: number[] = [];
      for (const c of tots) { lefts.push(x); x += c.offsetWidth; }
      for (const r of tbl.rows) {
        const cells = [...r.cells].filter((c) => c.classList.contains("tot"));
        cells.forEach((c, i) => (c.style.left = lefts[i] + "px"));
      }
    };
    stick();
    window.addEventListener("resize", stick);
    return () => window.removeEventListener("resize", stick);
  }, [G]);

  const cls = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

  if (empty) {
    return <div id="perf"><p className="empty nocountry">No country selected. Pick at least one country to see performance against plan.</p></div>;
  }

  // Mobile: one card per country instead of the wide table (CSS swaps which one shows).
  const cellText = (c: (typeof rows)[number]["cells"][number], f: (typeof rows)[number]["m"]["f"]) => ({
    e: c.nodata && !c.e ? "-" : fmt(c.e, f),
    a: c.na || c.nospend || c.nodata ? "-" : fmt(c.a, f),
    d: c.na || c.nospend || c.nodata || !c.e ? "-" : signed(c.diff, f),
    st: c.na ? "bad" : c.nospend || c.nodata ? "" : c.status,
  });
  const cards = (
    <div className="mcards">
      {G.groups.map((g, gi) => (
        <details key={g.name} className={"mcard" + (g.tot ? " tot" : "")} open={gi === 0}>
          <summary><Flag country={g.name} /><span>{g.name}</span>
            <span className="msum">{fmt(g.act.Spend, "$0")} <i>spent</i> {fmt(g.act.FundedAccounts, "n")} <i>funded</i></span>
          </summary>
          <table className="mt">
            <thead><tr><th>Metric</th><th>Expected</th><th>Actual</th><th>Diff</th></tr></thead>
            <tbody>
              {rows.map((r, ri) => {
                const t = cellText(r.cells[gi], r.m.f);
                return (
                  <Fragment key={ri}>
                    {(ri === 0 || rows[ri - 1].m.group !== r.m.group) && <tr className="mgrp"><th colSpan={4}>{r.m.group}</th></tr>}
                    <tr><th>{r.m.l}</th><td className="exp">{t.e}</td><td>{t.a}</td><td className={t.st}>{t.d}</td></tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </details>
      ))}
    </div>
  );

  return (
    <div id="perf" ref={ref}>
      {cards}
      <table className="xl compact" onMouseLeave={() => setHot(null)}>
        <thead>
          <tr>
            <th className="corner" rowSpan={2}></th>
            {G.groups.map((g, i) => (
              <th key={g.name} className={cls("ghead", g.tot && "tot last", i % 2 === 1 && "alt")} colSpan={3}>
                <Flag country={g.name} /><span>{g.name}</span>
              </th>
            ))}
            <th className="fill" rowSpan={2}></th>
          </tr>
          <tr>
            {G.groups.map((g, i) => (
              <Fragment key={g.name}>
                <th className={cls("sub gs exph", g.tot && "tot", i % 2 === 1 && "alt")}>Expected</th>
                <th className={cls("sub", g.tot && "tot", i % 2 === 1 && "alt")}>Actual</th>
                <th className={cls("sub", g.tot && "tot last", i % 2 === 1 && "alt")}>Diff</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><th className="rowh">No rows selected</th><td colSpan={nCols - 1} className="mute" style={{ textAlign: "left" }}>Pick at least one metric in the Rows filter.</td></tr>
          )}
          {rows.map((r, ri) => (
            <Fragment key={ri}>
            {(ri === 0 || rows[ri - 1].m.group !== r.m.group) && (
              <tr className="grp"><th className="rowh gname">{r.m.group}</th><td colSpan={nCols - 1}></td></tr>
            )}
            <tr>
              <th className="rowh">{r.m.l}</th>
              {r.cells.map((c, gi) => {
                const g = G.groups[gi];
                const t = cls(g.tot && "tot", gi % 2 === 1 && "alt");
                const last = g.tot ? "last" : "";
                const col = gi * 3;
                const td = (k: number, klass: string, text: string, title?: string) => (
                  <td className={cls(klass) + hv(ri, col + k)} title={title} onMouseEnter={() => setHot({ r: ri, c: col + k })}>{text}</td>
                );
                const exp = td(0, cls("gs exp", t), c.nodata && !c.e ? "-" : fmt(c.e, r.m.f));
                if (c.na) return <Fragment key={g.name}>{exp}{td(1, cls("bad", t), "-")}{td(2, cls("bad", t, last), "-")}</Fragment>;
                if (c.nospend) return <Fragment key={g.name}>{exp}{td(1, cls("mute", t), "-")}{td(2, cls("mute", t, last), "-")}</Fragment>;
                if (c.nodata) return <Fragment key={g.name}>{exp}{td(1, cls("mute", t), "-", "Impressions come from the live Power BI query only")}{td(2, cls("mute", t, last), "-")}</Fragment>;
                return (
                  <Fragment key={g.name}>
                    {exp}
                    {td(1, t.trim(), fmt(c.a, r.m.f))}
                    {td(2, cls(c.status, t, last), c.e ? signed(c.diff, r.m.f) : "-")}
                  </Fragment>
                );
              })}
              <td className="fill"></td>
            </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
