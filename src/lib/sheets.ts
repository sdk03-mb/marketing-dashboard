// Periods loaded from the PPC and Social export workbooks (src/data/sheets.json, built by scripts/xlsx_to_json.py).
// Each period carries country x platform rows in the same shape as the Power BI snapshot.
import data from "@/data/sheets.json";
import type { Row, SheetMetrics } from "./snapshot";

export type SheetPeriod = { id: string; label: string; from: string; to: string; source: string[]; rows: Row[]; totals: Record<string, SheetMetrics> };

export const SHEET_PERIODS: SheetPeriod[] = (data as { periods: SheetPeriod[] }).periods;
export const SHEETS: Record<string, Row[]> = Object.fromEntries(SHEET_PERIODS.map((p) => [p.id, p.rows]));

/** The workbook Total row for a platform, used for the All countries column when every country is in scope. */
export const sheetTotal = (periodId: string, platform: string): SheetMetrics | undefined => SHEET_PERIODS.find((p) => p.id === periodId)?.totals[platform];

/** Rows of the workbook period that covers exactly this range, so a quick range (last month) reads the JSON rather than the snapshot. */
export const sheetRowsFor = (from: string, to: string): Row[] | undefined => SHEET_PERIODS.find((p) => p.from === from && p.to === to)?.rows;
