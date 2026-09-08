import { jsPDF } from "jspdf";
import autoTable, { type CellHookData, type RowInput } from "jspdf-autotable";
import { ALLCH, COUNTRIES } from "./plan";
import { fmt, money, signed } from "./format";
import {
  buildCard, buildGrid, METRICS, recRows, type Agg, type Cal, type Hist, type MonthData, type Period, type RecRow, type Status,
} from "./engine";

export type ReportInput = {
  agg: Agg; period: Period; chan: string; enabled: Set<string>; cal: Cal; hist: Hist; months: MonthData[];
};

const INK: [number, number, number] = [26, 29, 35], INK2: [number, number, number] = [91, 98, 112], INK3: [number, number, number] = [154, 161, 173];
const FILL: Record<Status, [number, number, number] | null> = { good: [228, 244, 234], warn: [253, 241, 207], bad: [251, 228, 231], "": null };
const TEXT: Record<Status, [number, number, number]> = { good: [29, 107, 60], warn: [138, 97, 0], bad: [166, 58, 69], "": INK };
const plain = (s: string) => s.replace(/\*\*/g, "");

/** Landscape PDF: overview on page 1, then one page per selected country with its table and recommendations. */
export function buildReport(inp: ReportInput): jsPDF {
  const { agg, period, chan, enabled, cal, hist, months } = inp;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14;
  const chanLabel = chan.replace(" (combined)", "");
  const stamp = "Marketing Dashboard - Plan vs Reality · " + period.label + " · " + chanLabel;

  const footer = () => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(...INK3);
      doc.text(stamp, M, H - 7);
      doc.text("Page " + i + " of " + n, W - M, H - 7, { align: "right" });
    }
  };
  const heading = (title: string, sub?: string) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...INK);
    doc.text(title, M, 20);
    if (sub) { doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...INK2); doc.text(sub, M, 27); }
    doc.setDrawColor(230, 233, 238); doc.line(M, 31, W - M, 31);
  };
  const colorDiff = (data: CellHookData, statuses: Status[]) => {
    if (data.section !== "body" || data.column.index !== 3) return;
    const st = statuses[data.row.index];
    const f = FILL[st];
    if (f) data.cell.styles.fillColor = f;
    data.cell.styles.textColor = TEXT[st];
    data.cell.styles.fontStyle = "bold";
  };
  const metricRows = (act: Record<string, number>, pl: Record<string, number>, hasSpend: boolean) => {
    const rows: RowInput[] = [], statuses: Status[] = [];
    let group = "";
    for (const m of METRICS) {
      if (m.group !== group) { group = m.group; rows.push([{ content: group.toUpperCase(), colSpan: 4, styles: { fillColor: [245, 247, 250], textColor: INK2, fontStyle: "bold", fontSize: 7.5 } }]); statuses.push(""); }
      const a = act[m.k] || 0, e = pl[m.k] || 0;
      const nodata = (m.k === "Impressions" || m.k === "CTR") && !act.Impressions;
      const nospend = m.dir === "cost" && !hasSpend;
      const na = m.dir === "cost" && hasSpend && !(a > 0);
      const st: Status = nodata || nospend ? "" : na ? "bad" : (e ? (m.dir === "cost" ? (a <= e ? "good" : a <= e * 1.5 ? "warn" : "bad") : (a / e >= 0.9 ? "good" : a / e >= 0.6 ? "warn" : "bad")) : "");
      rows.push([m.l, nodata && !e ? "-" : fmt(e, m.f), nodata || nospend || na ? "-" : fmt(a, m.f), nodata || nospend || na || !e ? "-" : signed(a - e, m.f)]);
      statuses.push(st);
    }
    return { rows, statuses };
  };
  /* ---------- page 1: overview ---------- */
  const G = buildGrid(agg, period, chan, enabled);
  const tot = G.groups.find((g) => g.tot) ?? G.groups[0];
  const countries = COUNTRIES.filter((c) => enabled.has(c));
  const recs = recRows(agg, period, hist, enabled);
  const stops = recs.filter((r) => r.kind === "stop"), grows = recs.filter((r) => r.kind === "grow");
  heading("Overview", period.label + " (" + period.full + ") · " + chanLabel + " · " + countries.length + " countries · diff is actual - expected");
  if (tot) {
    // KPI strip
    const kpis: [string, string, string, string, Status][] = [
      ["Spend", money(tot.pl.Spend), money(tot.act.Spend), signed(tot.act.Spend - tot.pl.Spend, "$0"), tot.act.Spend / (tot.pl.Spend || 1) >= 0.9 ? "good" : tot.act.Spend / (tot.pl.Spend || 1) >= 0.6 ? "warn" : "bad"],
      ["Funded accounts", fmt(tot.pl.FundedAccounts, "n"), fmt(tot.act.FundedAccounts, "n"), signed(tot.act.FundedAccounts - tot.pl.FundedAccounts, "n"), tot.act.FundedAccounts / (tot.pl.FundedAccounts || 1) >= 0.9 ? "good" : tot.act.FundedAccounts / (tot.pl.FundedAccounts || 1) >= 0.6 ? "warn" : "bad"],
      ["Deposits", money(tot.pl.TotalDeposits), money(tot.act.TotalDeposits), signed(tot.act.TotalDeposits - tot.pl.TotalDeposits, "$0"), tot.act.TotalDeposits / (tot.pl.TotalDeposits || 1) >= 0.9 ? "good" : tot.act.TotalDeposits / (tot.pl.TotalDeposits || 1) >= 0.6 ? "warn" : "bad"],
      ["Cost per funded account", fmt(tot.pl.CPFA, "$2"), tot.act.FundedAccounts ? fmt(tot.act.CPFA, "$2") : "-", tot.act.FundedAccounts ? signed(tot.act.CPFA - tot.pl.CPFA, "$2") : "-", tot.act.FundedAccounts ? (tot.act.CPFA <= tot.pl.CPFA ? "good" : tot.act.CPFA <= tot.pl.CPFA * 1.5 ? "warn" : "bad") : "bad"],
      ["Return per $1", tot.pl.ROI.toFixed(2), tot.act.ROI.toFixed(2), signed(tot.act.ROI - tot.pl.ROI, "r"), tot.act.ROI >= 1 ? "good" : tot.act.ROI >= 0.5 ? "warn" : "bad"],
    ];
    const bw = (W - 2 * M - 4 * 4) / 5;
    kpis.forEach(([l, e, a, d, st], i) => {
      const x = M + i * (bw + 4), y = 36;
      doc.setFillColor(255, 255, 255); doc.setDrawColor(230, 233, 238); doc.roundedRect(x, y, bw, 26, 2, 2, "FD");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...INK2); doc.text(l.toUpperCase(), x + 4, y + 6);
      doc.setFontSize(15); doc.setTextColor(...INK); doc.text(a, x + 4, y + 14);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...INK3); doc.text("Expected " + e, x + 4, y + 20);
      doc.setFont("helvetica", "bold"); doc.setTextColor(...TEXT[st]); doc.text(d, x + bw - 4, y + 20, { align: "right" });
    });
    // Totals table (left) and recommendation summary (right)
    const { rows, statuses } = metricRows(tot.act as unknown as Record<string, number>, tot.pl as unknown as Record<string, number>, tot.act.Spend > 0);
    autoTable(doc, {
      startY: 68, head: [["All selected countries", "Expected", "Actual", "Diff"]], body: rows, theme: "grid", margin: { left: M, right: W / 2 + 4 },
      styles: { font: "helvetica", fontSize: 7.2, cellPadding: 1.2, textColor: INK, lineColor: [230, 233, 238], lineWidth: 0.2, halign: "right" },
      headStyles: { fillColor: [238, 243, 251], textColor: INK2, fontStyle: "bold", halign: "right" },
      columnStyles: { 0: { halign: "left", cellWidth: 52, fontStyle: "bold" }, 1: { textColor: INK2 } },
      didParseCell: (d) => { if (d.column.index === 0 && d.section === "head") d.cell.styles.halign = "left"; colorDiff(d, statuses); },
    });
    const rx = W / 2 + 8;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK); doc.text("Recommendations", rx, 73);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...INK2);
    doc.text(stops.length + " markets to stop or cut, " + grows.length + " to grow. Details on each country page.", rx, 79);
    const recTable = (title: string, list: RecRow[], y: number, tone: Status) => {
      if (!list.length) return y;
      autoTable(doc, {
        startY: y, head: [[title, "Spend", "Funded", "Return per $1"]], margin: { left: rx, right: M }, theme: "grid",
        body: list.slice(0, 8).map((r) => [r.c + " · " + r.chanS, money(r.Spend), fmt(r.FundedAccounts, "n"), r.ROI.toFixed(2)]),
        styles: { font: "helvetica", fontSize: 8, cellPadding: 1.4, textColor: INK, lineColor: [230, 233, 238], lineWidth: 0.2, halign: "right" },
        headStyles: { fillColor: FILL[tone] ?? [238, 243, 251], textColor: TEXT[tone], fontStyle: "bold", halign: "right" },
        columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
        didParseCell: (d) => { if (d.column.index === 0 && d.section === "head") d.cell.styles.halign = "left"; },
      });
      return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
    };
    const afterStops = recTable("Stop spending", [...stops].sort((a, b) => b.Spend - a.Spend), 83, "bad");
    recTable("Spend more", [...grows].sort((a, b) => b.ROI - a.ROI), afterStops, "good");
  }

  /* ---------- one page per country ---------- */
  for (const c of countries) {
    const g = G.groups.find((x) => x.name === c);
    if (!g) continue;
    doc.addPage();
    heading(c, period.label + " · " + chanLabel + " · expected is the monthly plan prorated to " + period.full);
    const { rows, statuses } = metricRows(g.act as unknown as Record<string, number>, g.pl as unknown as Record<string, number>, g.act.Spend > 0);
    const half = (W - 2 * M) / 2 - 4;
    autoTable(doc, {
      startY: 36, head: [["Metric", "Expected", "Actual", "Diff"]], body: rows, theme: "grid", margin: { left: M, right: W - M - half },
      styles: { font: "helvetica", fontSize: 7.2, cellPadding: 1.2, textColor: INK, lineColor: [230, 233, 238], lineWidth: 0.2, halign: "right" },
      headStyles: { fillColor: [238, 243, 251], textColor: INK2, fontStyle: "bold", halign: "right" },
      columnStyles: { 0: { halign: "left", cellWidth: 52, fontStyle: "bold" }, 1: { textColor: INK2 } },
      didParseCell: (d) => { if (d.column.index === 0 && d.section === "head") d.cell.styles.halign = "left"; colorDiff(d, statuses); },
    });

    // Recommendations for this country (all channels when combined view, else the selected one).
    const mine = recs.filter((r) => r.c === c && (chan === ALLCH || r.chan === chan));
    const rx = M + half + 8, rw = W - M - rx;
    let y = 36;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK); doc.text("Recommendations", rx, y + 4); y += 9;
    if (!mine.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...INK2);
      doc.text("No stop or grow signal for this country in " + period.label + ".", rx, y + 2);
    }
    for (const r of mine) {
      const card = buildCard(r, period, cal, hist, months);
      if (y > H - 60) { doc.addPage(); heading(c + " (continued)", chanLabel); y = 36; }
      const tone: Status = r.kind === "stop" ? "bad" : "good";
      doc.setFillColor(...(FILL[tone] as [number, number, number])); doc.roundedRect(rx, y, rw, 7, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...TEXT[tone]);
      doc.text((r.kind === "stop" ? "STOP SPENDING" : "SPEND MORE") + "  ·  " + r.chanS + "  ·  " + money(r.Spend) + " spent, " + fmt(r.FundedAccounts, "n") + " funded, " + r.ROI.toFixed(2) + " per $1", rx + 3, y + 5);
      y += 11;
      doc.setFont("helvetica", "bolditalic"); doc.setFontSize(9.5); doc.setTextColor(...INK);
      const why = doc.splitTextToSize(plain(card.why), rw - 2); doc.text(why, rx, y); y += why.length * 4.6 + 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...INK2); doc.text("ACTIONS", rx, y); y += 4;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...INK);
      for (const a of card.actions) {
        const lines = doc.splitTextToSize(a.verb + ": " + plain(a.text), rw - 6);
        if (y + lines.length * 4.2 > H - 14) { doc.addPage(); heading(c + " (continued)", chanLabel); y = 36; }
        doc.text("•", rx + 1, y); doc.text(lines, rx + 5, y); y += lines.length * 4.2 + 1.2;
      }
      y += 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...INK2); doc.text("WHAT EACH TEAM CAN DO", rx, y); y += 4;
      for (const d of card.fixTree.children ?? []) {
        const line = d.name + ": " + (d.children ?? []).map((t) => t.name).join("; ");
        const lines = doc.splitTextToSize(line, rw - 2);
        if (y + lines.length * 4.2 > H - 14) { doc.addPage(); heading(c + " (continued)", chanLabel); y = 36; }
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...INK); doc.text(lines, rx, y); y += lines.length * 4.2 + 1.2;
      }
      y += 5;
    }
  }

  footer();
  return doc;
}

export function downloadReport(inp: ReportInput) {
  const doc = buildReport(inp);
  const name = "marketing-plan-vs-reality-" + inp.period.id + "-" + inp.chan.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".pdf";
  doc.save(name);
}
