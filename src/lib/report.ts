import { jsPDF } from "jspdf";
import autoTable, { type CellHookData, type RowInput } from "jspdf-autotable";
import { ALLCH, COUNTRIES, ISO } from "./plan";
import { fmt, money, signed } from "./format";
import {
  buildCard, buildGrid, METRICS, recRows,
  type Agg, type Cal, type Hist, type MonthData, type Period, type RecRow, type Status,
} from "./engine";

export type ReportInput = {
  agg: Agg; period: Period; chan: string; enabled: Set<string>; cal: Cal; hist: Hist; months: MonthData[];
};

type RGB = [number, number, number];
const INK: RGB = [26, 29, 35], INK2: RGB = [91, 98, 112], INK3: RGB = [154, 161, 173], LINE: RGB = [230, 233, 238], BAND: RGB = [245, 247, 250], HEAD: RGB = [238, 243, 251];
const FILL: Record<Status, RGB | null> = { good: [228, 244, 234], warn: [253, 241, 207], bad: [251, 228, 231], "": null };
const TEXT: Record<Status, RGB> = { good: [29, 107, 60], warn: [138, 97, 0], bad: [166, 58, 69], "": INK };
const plain = (s: string) => s.replace(/\*\*/g, "");
const lastY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

/* ---------- helpers: images ---------- */
async function flagData(c: string): Promise<string | null> {
  const iso = ISO[c]; if (!iso) return null;
  try {
    const r = await fetch(`https://flagcdn.com/w80/${iso}.png`); if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b); });
  } catch { return null; }
}

/* ---------- main ---------- */
/** Landscape A3 PDF: overview on page 1, then one page per selected country. Tables and text only. */
export async function buildReport(inp: ReportInput): Promise<jsPDF> {
  const { agg, period, chan, enabled, cal, hist, months } = inp;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 18, GAP = 10;
  const chanLabel = chan.replace(" (combined)", "");
  const stamp = "Marketing Dashboard - Plan vs Reality · " + period.label + " · " + chanLabel;
  const countries = COUNTRIES.filter((c) => enabled.has(c));
  const flags = new Map<string, string | null>(await Promise.all(countries.map(async (c) => [c, await flagData(c)] as const)));
  const yieldUI = () => new Promise((r) => setTimeout(r, 0));

  const heading = (title: string, sub?: string, flag?: string | null) => {
    let x = M;
    if (flag) { doc.addImage(flag, "PNG", M, 14, 14, 9.5); x = M + 18; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...INK); doc.text(title, x, 22);
    if (sub) { doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...INK2); doc.text(sub, x, 29); }
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, 34, W - M, 34);
  };
  const footer = () => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...INK3);
      doc.text(stamp, M, H - 8); doc.text("Page " + i + " of " + n, W - M, H - 8, { align: "right" });
    }
  };
  const colorDiff = (data: CellHookData, statuses: Status[]) => {
    if (data.section !== "body" || data.column.index !== 3) return;
    const st = statuses[data.row.index]; const f = FILL[st];
    if (f) data.cell.styles.fillColor = f;
    data.cell.styles.textColor = TEXT[st]; data.cell.styles.fontStyle = "bold";
  };
  const metricRows = (act: Record<string, number>, pl: Record<string, number>, hasSpend: boolean) => {
    const rows: RowInput[] = [], statuses: Status[] = []; let group = "";
    for (const m of METRICS) {
      if (m.group !== group) { group = m.group; rows.push([{ content: group.toUpperCase(), colSpan: 4, styles: { fillColor: BAND, textColor: INK2, fontStyle: "bold", fontSize: 8 } }]); statuses.push(""); }
      const a = act[m.k] || 0, e = pl[m.k] || 0;
      const nodata = (m.k === "Impressions" || m.k === "CTR") && !act.Impressions;
      const nospend = m.dir === "cost" && !hasSpend, na = m.dir === "cost" && hasSpend && !(a > 0);
      const st: Status = nodata || nospend ? "" : na ? "bad" : e ? (m.dir === "cost" ? (a <= e ? "good" : a <= e * 1.5 ? "warn" : "bad") : (a / e >= 0.9 ? "good" : a / e >= 0.6 ? "warn" : "bad")) : "";
      rows.push([m.l, nodata && !e ? "-" : fmt(e, m.f), nodata || nospend || na ? "-" : fmt(a, m.f), nodata || nospend || na || !e ? "-" : signed(a - e, m.f)]);
      statuses.push(st);
    }
    return { rows, statuses };
  };
  const metricTable = (startY: number, title: string, rows: RowInput[], statuses: Status[], left: number, right: number) => {
    autoTable(doc, {
      startY, head: [[title, "Expected", "Actual", "Diff"]], body: rows, theme: "grid", margin: { left, right },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2, textColor: INK, lineColor: LINE, lineWidth: 0.2, halign: "right" },
      headStyles: { fillColor: HEAD, textColor: INK2, fontStyle: "bold", halign: "right" },
      columnStyles: { 0: { halign: "left", cellWidth: 70, fontStyle: "bold" }, 1: { textColor: INK2 } },
      didParseCell: (d) => { if (d.column.index === 0 && d.section === "head") d.cell.styles.halign = "left"; colorDiff(d, statuses); },
    });
    return lastY(doc);
  };
  const sectionTitle = (t: string, x: number, y: number) => { doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...INK); doc.text(t, x, y); };

  /* ---------- page 1: overview ---------- */
  const G = buildGrid(agg, period, chan, enabled);
  const tot = G.groups.find((g) => g.tot) ?? G.groups[0];
  const recs = recRows(agg, period, hist, enabled);
  const stops = [...recs.filter((r) => r.kind === "stop")].sort((a, b) => b.Spend - a.Spend);
  const grows = [...recs.filter((r) => r.kind === "grow")].sort((a, b) => b.ROI - a.ROI);
  heading("Overview", period.label + " (" + period.full + ") · " + chanLabel + " · " + countries.length + " countries · diff is actual - expected");

  if (tot) {
    // KPI cards
    const st = (a: number, e: number, cost = false): Status => !e ? "" : cost ? (a <= e ? "good" : a <= e * 1.5 ? "warn" : "bad") : (a / e >= 0.9 ? "good" : a / e >= 0.6 ? "warn" : "bad");
    const kpis: [string, string, string, string, Status][] = [
      ["Spend", money(tot.pl.Spend), money(tot.act.Spend), signed(tot.act.Spend - tot.pl.Spend, "$0"), st(tot.act.Spend, tot.pl.Spend)],
      ["Leads", fmt(tot.pl.Leads, "n"), fmt(tot.act.Leads, "n"), signed(tot.act.Leads - tot.pl.Leads, "n"), st(tot.act.Leads, tot.pl.Leads)],
      ["Funded accounts", fmt(tot.pl.FundedAccounts, "n"), fmt(tot.act.FundedAccounts, "n"), signed(tot.act.FundedAccounts - tot.pl.FundedAccounts, "n"), st(tot.act.FundedAccounts, tot.pl.FundedAccounts)],
      ["Cost per funded account", fmt(tot.pl.CPFA, "$2"), tot.act.FundedAccounts ? fmt(tot.act.CPFA, "$2") : "-", tot.act.FundedAccounts ? signed(tot.act.CPFA - tot.pl.CPFA, "$2") : "-", tot.act.FundedAccounts ? st(tot.act.CPFA, tot.pl.CPFA, true) : "bad"],
      ["Deposits", money(tot.pl.TotalDeposits), money(tot.act.TotalDeposits), signed(tot.act.TotalDeposits - tot.pl.TotalDeposits, "$0"), st(tot.act.TotalDeposits, tot.pl.TotalDeposits)],
      ["Return per $1", tot.pl.ROI.toFixed(2), tot.act.ROI.toFixed(2), signed(tot.act.ROI - tot.pl.ROI, "r"), tot.act.ROI >= 1 ? "good" : tot.act.ROI >= 0.5 ? "warn" : "bad"],
    ];
    const n = kpis.length, cw = (W - 2 * M - (n - 1) * GAP) / n, cy = 40, ch = 32;
    kpis.forEach(([l, e, a, d, s], i) => {
      const x = M + i * (cw + GAP);
      doc.setFillColor(255, 255, 255); doc.setDrawColor(...LINE); doc.roundedRect(x, cy, cw, ch, 2.5, 2.5, "FD");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK2); doc.text(l.toUpperCase(), x + 5, cy + 7);
      doc.setFontSize(18); doc.setTextColor(...INK); doc.text(a, x + 5, cy + 17);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...INK3); doc.text("Expected " + e, x + 5, cy + 26);
      const f = FILL[s]; const tw = doc.getTextWidth(d) + 6;
      if (f) { doc.setFillColor(...f); doc.roundedRect(x + cw - 5 - tw, cy + 21, tw, 7, 1.5, 1.5, "F"); }
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...TEXT[s]); doc.text(d, x + cw - 8, cy + 26, { align: "right" });
    });

    // Totals table (left) and recommendation lists (right)
    const y1 = cy + ch + GAP + 4;
    const { rows, statuses } = metricRows(tot.act as unknown as Record<string, number>, tot.pl as unknown as Record<string, number>, tot.act.Spend > 0);
    metricTable(y1, "All selected countries", rows, statuses, M, W / 2 + GAP / 2);
    const rx = W / 2 + GAP / 2;
    sectionTitle("Recommendations", rx, y1 + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...INK2);
    doc.text(stops.length + " markets to stop or cut, " + grows.length + " to grow. Details on each country page.", rx, y1 + 11);
    const recTable = (title: string, list: RecRow[], y: number, tone: Status) => {
      if (!list.length) return y;
      autoTable(doc, {
        startY: y, head: [[title, "Spend", "Funded", "Return per $1"]], margin: { left: rx, right: M }, theme: "grid",
        body: list.slice(0, 10).map((r) => [r.c + " · " + r.chanS, money(r.Spend), fmt(r.FundedAccounts, "n"), r.ROI.toFixed(2)]),
        styles: { font: "helvetica", fontSize: 9, cellPadding: 2, textColor: INK, lineColor: LINE, lineWidth: 0.2, halign: "right" },
        headStyles: { fillColor: FILL[tone] ?? HEAD, textColor: TEXT[tone], fontStyle: "bold", halign: "right" },
        columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
        didParseCell: (d) => { if (d.column.index === 0 && d.section === "head") d.cell.styles.halign = "left"; },
      });
      return lastY(doc) + GAP;
    };
    const afterStops = recTable("Stop spending", stops, y1 + 16, "bad");
    recTable("Spend more", grows, afterStops, "good");
  }

  /* ---------- one page per country ---------- */
  for (const c of countries) {
    const g = G.groups.find((x) => x.name === c); if (!g) continue;
    doc.addPage();
    heading(c, period.label + " · " + chanLabel + " · expected is the monthly plan prorated to " + period.full, flags.get(c));
    const half = (W - 2 * M - GAP) / 2;
    const { rows, statuses } = metricRows(g.act as unknown as Record<string, number>, g.pl as unknown as Record<string, number>, g.act.Spend > 0);
    metricTable(40, "Metric", rows, statuses, M, W - M - half);

    const rx = M + half + GAP, rw = half;
    await yieldUI(); // keep the page responsive between country pages
    let y = 40;

    // Recommendations for this country
    const mine = recs.filter((r) => r.c === c && (chan === ALLCH || r.chan === chan));
    sectionTitle("Recommendations", rx, y + 5); y += 11;
    if (!mine.length) { doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK2); doc.text("No stop or grow signal for this country in " + period.label + ".", rx, y + 2); }
    for (const r of mine) {
      const card = buildCard(r, period, cal, hist, months);
      const tone: Status = r.kind === "stop" ? "bad" : "good";
      // Measure content first, then draw the box.
      doc.setFont("helvetica", "bolditalic"); doc.setFontSize(10.5);
      const whyLines: string[] = doc.splitTextToSize(plain(card.why), rw - 12);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
      const actLines = card.actions.map((a) => doc.splitTextToSize(a.verb + ": " + plain(a.text), rw - 18) as string[]);
      const teamLines = (card.fixTree.children ?? []).map((d) => doc.splitTextToSize(d.name + ": " + (d.children ?? []).map((t) => t.name).join("; "), rw - 12) as string[]);
      const LH = 4.8;
      const boxH = 10 + whyLines.length * 5.2 + 8 + actLines.reduce((s, l) => s + l.length * LH + 1.5, 0) + 8 + teamLines.reduce((s, l) => s + l.length * LH + 1.5, 0) + 8;
      if (y + boxH > H - 16) { doc.addPage(); heading(c + " (continued)", chanLabel, flags.get(c)); y = 40; }
      doc.setFillColor(252, 252, 253); doc.setDrawColor(...LINE); doc.roundedRect(rx, y, rw, boxH, 2.5, 2.5, "FD");
      doc.setFillColor(...(FILL[tone] as RGB)); doc.roundedRect(rx, y, rw, 9, 2.5, 2.5, "F"); doc.rect(rx, y + 5, rw, 4, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...TEXT[tone]);
      doc.text((r.kind === "stop" ? "STOP SPENDING" : "SPEND MORE") + "   ·   " + r.chanS + "   ·   " + money(r.Spend) + " spent   ·   " + fmt(r.FundedAccounts, "n") + " funded   ·   " + r.ROI.toFixed(2) + " per $1", rx + 6, y + 6.2);
      let yy = y + 16;
      doc.setFont("helvetica", "bolditalic"); doc.setFontSize(10.5); doc.setTextColor(...INK); doc.text(whyLines, rx + 6, yy); yy += whyLines.length * 5.2 + 4;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK2); doc.text("ACTIONS", rx + 6, yy); yy += 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...INK);
      for (const lines of actLines) { doc.text("•", rx + 7, yy); doc.text(lines, rx + 12, yy); yy += lines.length * LH + 1.5; }
      yy += 3;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK2); doc.text("WHAT EACH TEAM CAN DO", rx + 6, yy); yy += 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...INK);
      for (const lines of teamLines) { doc.text(lines, rx + 6, yy); yy += lines.length * LH + 1.5; }
      y += boxH + GAP;
    }
  }

  footer();
  return doc;
}

export async function downloadReport(inp: ReportInput) {
  const doc = await buildReport(inp);
  doc.save("marketing-plan-vs-reality-" + inp.period.id + "-" + inp.chan.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".pdf");
}
