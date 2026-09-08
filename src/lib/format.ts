import type { Format } from "./data";

export const money = (n: number, d = 0) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const compact = (n: number) =>
  n >= 1e9 ? (n / 1e9).toFixed(2) + "B"
  : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + "M"
  : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + "K"
  : String(n);

export const pct = (n: number, d = 1) => n.toFixed(d) + "%";

export function fmt(v: number, f: Format) {
  switch (f) {
    case "money": return "$" + compact(v);
    case "money2": return money(v, 2);
    case "int": return compact(v);
    case "pct": return pct(v, 2);
    case "x": return v.toFixed(1) + "×";
  }
}
