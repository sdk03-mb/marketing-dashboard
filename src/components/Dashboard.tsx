"use client";
import { motion } from "framer-motion";
import { TopBar } from "./TopBar";
import { Sparkline } from "./Sparkline";
import { TrendChart } from "./TrendChart";
import { alerts, campaigns, channels, funnel, kpis, period, regions, topKeywords } from "@/lib/data";
import { compact, fmt, money, pct } from "@/lib/format";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

function Delta({ v, goodWhen }: { v: number; goodWhen: "up" | "down" }) {
  const good = goodWhen === "up" ? v >= 0 : v <= 0;
  return (
    <span className={`num text-[11px] ${good ? "text-up" : "text-down"}`}>
      {v > 0 ? "+" : ""}{v.toFixed(1)}%
    </span>
  );
}

function Panel({ title, meta, children, className = "" }: { title: string; meta?: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.section variants={item} className={`panel flex flex-col min-h-0 ${className}`}>
      <header className="flex items-baseline justify-between px-2.5 pt-2 pb-1">
        <h2 className="text-[12px] font-semibold">{title}</h2>
        {meta && <span className="text-[10px] text-muted">{meta}</span>}
      </header>
      <div className="px-1.5 pb-1.5 min-h-0 overflow-auto">{children}</div>
    </motion.section>
  );
}

const statusDot: Record<string, string> = {
  live: "bg-up",
  learning: "bg-warn",
  paused: "bg-muted",
};

export function Dashboard() {
  const totalSpend = channels.reduce((a, c) => a + c.spend, 0);
  const totalFtd = channels.reduce((a, c) => a + c.ftd, 0);

  return (
    <motion.main
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-[1600px] px-3 py-2 grid gap-2 h-dvh grid-rows-[auto_auto_minmax(0,1fr)_minmax(0,1fr)]"
    >
      {/* Top bar */}
      <motion.div variants={item}>
        <TopBar
          active="overview"
          right={
            <>
              <span className="text-muted">{period.range}</span>
              <div className="flex rounded border border-line overflow-hidden">
                {["7d", "30d", "QTD", "YTD"].map((t, i) => (
                  <button
                    key={t}
                    className={`px-2 py-0.5 ${i === 1 ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`}
                    aria-pressed={i === 1}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <span className="text-muted">{period.compare}</span>
            </>
          }
        />
      </motion.div>

      {/* KPI strip */}
      <motion.div variants={item} className="grid grid-cols-5 lg:grid-cols-10 gap-1.5">
        {kpis.map((k) => (
          <div key={k.label} className="panel px-2 py-1.5 flex flex-col gap-0.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[10.5px] text-muted">{k.label}</span>
              <Delta v={k.delta} goodWhen={k.goodWhen} />
            </div>
            <div className="flex items-end justify-between gap-1">
              <span className="num text-[16px] font-semibold leading-none">{fmt(k.value, k.format)}</span>
              <Sparkline data={k.trend} w={44} h={14} color={k.goodWhen === "down" ? "var(--blue)" : "var(--teal)"} />
            </div>
          </div>
        ))}
      </motion.div>

      {/* Row 1: channels | trend | alerts+funnel */}
      <div className="grid grid-cols-12 gap-2 min-h-0">
        <Panel title="Channels" meta={`${money(totalSpend)} · ${totalFtd.toLocaleString()} FTDs`} className="col-span-5">
          <table className="w-full num">
            <thead>
              <tr>
                <th className="th">Channel</th><th className="th">Spend</th><th className="th">Impr</th><th className="th">Clicks</th>
                <th className="th">CTR</th><th className="th">Leads</th><th className="th">FTD</th><th className="th">CPA</th><th className="th">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.channel}>
                  <td className="td">
                    <div className="flex flex-col gap-0.5">
                      <span>{c.channel}</span>
                      <div className="bar" style={{ width: `${(c.spend / channels[0].spend) * 100}%` }} />
                    </div>
                  </td>
                  <td className="td">{money(c.spend)}</td>
                  <td className="td text-muted">{compact(c.impr)}</td>
                  <td className="td text-muted">{compact(c.clicks)}</td>
                  <td className="td text-muted">{pct((c.clicks / c.impr) * 100, 2)}</td>
                  <td className="td">{c.leads.toLocaleString()}</td>
                  <td className="td font-medium">{c.ftd.toLocaleString()}</td>
                  <td className="td">{money(c.spend / c.ftd)}</td>
                  <td className={`td font-medium ${c.roas >= 3.5 ? "text-up" : c.roas < 2.5 ? "text-down" : ""}`}>{c.roas.toFixed(1)}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Daily spend vs FTDs" meta="hover bars" className="col-span-4">
          <TrendChart />
        </Panel>

        <div className="col-span-3 grid grid-rows-2 gap-2 min-h-0">
          <Panel title="Needs attention" meta={`${alerts.length}`}>
            <ul className="flex flex-col gap-1 px-1">
              {alerts.map((a) => (
                <li key={a.text} className="flex gap-1.5 text-[11px] leading-snug">
                  <span className={`mt-[5px] shrink-0 w-1.5 h-1.5 rounded-full ${a.level === "warn" ? "bg-warn" : "bg-blue"}`} />
                  <span>{a.text}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Funnel" meta="conversion between stages">
            <ul className="flex flex-col gap-[3px] px-1 num">
              {funnel.map((f, i) => {
                const prev = funnel[i - 1]?.value;
                const rate = prev ? (f.value / prev) * 100 : null;
                const w = Math.max(8, (Math.log10(f.value) / Math.log10(funnel[0].value)) * 100);
                return (
                  <li key={f.stage} className="grid grid-cols-[76px_1fr_44px_40px] items-center gap-1 text-[11px]">
                    <span className="text-muted truncate">{f.stage}</span>
                    <div className="h-[9px] rounded-sm bg-surface-2 overflow-hidden">
                      <motion.div
                        className="h-full rounded-sm"
                        style={{ background: "linear-gradient(90deg,var(--blue),var(--teal))" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${w}%` }}
                        transition={{ duration: 0.6, delay: 0.2 + i * 0.06 }}
                      />
                    </div>
                    <span className="text-right">{compact(f.value)}</span>
                    <span className="text-right text-muted">{rate === null ? "" : rate < 1 ? pct(rate, 2) : pct(rate, 1)}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>

      {/* Row 2: campaigns | regions | keywords */}
      <div className="grid grid-cols-12 gap-2 min-h-0">
        <Panel title="Campaigns" meta="top 8 by spend" className="col-span-6">
          <table className="w-full num">
            <thead>
              <tr>
                <th className="th">Campaign</th><th className="th">Channel</th><th className="th">Spend</th><th className="th">Budget</th>
                <th className="th">FTD</th><th className="th">CPA</th><th className="th">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.name}>
                  <td className="td">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${statusDot[c.status]}`} title={c.status} />
                    {c.name}
                  </td>
                  <td className="td text-muted text-left">{c.channel}</td>
                  <td className="td">{money(c.spend)}</td>
                  <td className="td">
                    <div className="flex items-center gap-1.5 justify-end">
                      <div className="w-12 h-[5px] rounded-sm bg-surface-2 overflow-hidden">
                        <div className={`h-full ${c.budgetUsed > 0.9 ? "bg-warn" : "bg-blue"}`} style={{ width: `${c.budgetUsed * 100}%` }} />
                      </div>
                      <span className="text-muted w-7 text-right">{Math.round(c.budgetUsed * 100)}%</span>
                    </div>
                  </td>
                  <td className="td font-medium">{c.ftd}</td>
                  <td className={`td ${c.cpa > 130 ? "text-down" : ""}`}>{money(c.cpa, 2)}</td>
                  <td className={`td font-medium ${c.roas >= 3.5 ? "text-up" : c.roas < 2.5 ? "text-down" : ""}`}>{c.roas.toFixed(1)}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Regions" meta="share of spend" className="col-span-3">
          <table className="w-full num">
            <thead>
              <tr><th className="th">Region</th><th className="th">Spend</th><th className="th">FTD</th><th className="th">CPA</th></tr>
            </thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.region}>
                  <td className="td">
                    <div className="flex items-center gap-1.5">
                      <span className="w-14 truncate">{r.region}</span>
                      <div className="flex-1 h-[5px] rounded-sm bg-surface-2 overflow-hidden">
                        <div className="h-full bg-teal/80" style={{ width: `${r.share * 100 * 3}%` }} />
                      </div>
                      <span className="text-muted w-7 text-right">{Math.round(r.share * 100)}%</span>
                    </div>
                  </td>
                  <td className="td">{money(r.spend)}</td>
                  <td className="td font-medium">{r.ftd.toLocaleString()}</td>
                  <td className={`td ${r.cpa > 150 ? "text-down" : ""}`}>{money(r.cpa, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Search terms" meta="Google Search · by clicks" className="col-span-3">
          <table className="w-full num">
            <thead>
              <tr><th className="th">Term</th><th className="th">Clicks</th><th className="th">CPC</th><th className="th">FTD</th></tr>
            </thead>
            <tbody>
              {topKeywords.map((k) => (
                <tr key={k.kw}>
                  <td className="td">{k.kw}</td>
                  <td className="td">{compact(k.clicks)}</td>
                  <td className="td text-muted">{money(k.cpc, 2)}</td>
                  <td className="td font-medium">{k.ftd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </motion.main>
  );
}
