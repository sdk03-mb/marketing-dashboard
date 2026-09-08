export type Fmt = "$0" | "$2" | "n" | "pct" | "pct1" | "pct2" | "pp" | "pp1" | "pp2" | "x" | "r";

export function fmt(v: number | null | undefined, f: Fmt): string {
  if (v === null || v === undefined || isNaN(v) || !isFinite(v)) v = 0;
  const neg = v < 0 ? "-" : "", a = Math.abs(v);
  if (f === "$0") return neg + "$" + a.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (f === "$2") return neg + "$" + a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (f === "n") return neg + a.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (f === "pct") return neg + Math.round(a * 100) + "%";
  if (f === "pct1") return neg + (a * 100).toFixed(1) + "%";
  if (f === "pct2") return neg + (a * 100).toFixed(2) + "%";
  if (f === "pp") return neg + Math.round(a * 100) + " pts";
  if (f === "pp1") return neg + (a * 100).toFixed(1) + " pts";
  if (f === "pp2") return neg + (a * 100).toFixed(2) + " pts";
  if (f === "x") return (Math.round(v * 10) / 10).toLocaleString("en-US") + "×";
  return neg + a.toFixed(2);
}

export const money = (v: number) => fmt(v, "$0");
/** Signed diff in the same unit as the value it compares (matches the Expected column). */
export const signed = (v: number, f: Fmt) => (v > 0 ? "+" : "") + fmt(v, f);
