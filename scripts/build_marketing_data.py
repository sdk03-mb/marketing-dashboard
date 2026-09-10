"""Build src/data/marketing-data.json from the three source workbooks.

  python scripts/build_marketing_data.py

Reads (paths below), and keeps each workbook's own reporting window separate - they do NOT
describe the same range and must not be merged:

  Aug-Social_and_PPC-SourceOfTruth (1).xlsx  full month Aug 2026, rates only (no NMI / ROI columns)
  Sept-Social_and_PPC-SourceOfTruth.xlsx     1-9 Sept 2026,       rates only (no NMI / ROI columns)
  Aug&Sept-ExpectedNumbers.xlsx              1-26 Aug 2026 actuals with real volumes, plus the
                                             full-month Aug plan and its assumption levers

Nothing is derived. Every number is copied from a cell. Where a workbook does not state a figure
the field is null, never 0, so "not reported" stays distinguishable from "zero".
"""
import json, sys
from datetime import date
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DL = Path("/Users/aishwaryanathani/Downloads")
OUT = ROOT / "src" / "data" / "marketing-data.json"

SOT = [
    ("aug", "August 2026", "2026-08-01", "2026-08-31", "Aug-Social_and_PPC-SourceOfTruth (1).xlsx"),
    ("sep", "1-9 September 2026", "2026-09-01", "2026-09-09", "Sept-Social_and_PPC-SourceOfTruth.xlsx"),
]
EXPECTED = "Aug&Sept-ExpectedNumbers.xlsx"
PLATFORM = {"PPC": "Google Search", "Social": "Facebook & Instagram"}


def num(v):
    """'$1,234.56' -> 1234.56, '($1,325.11)' -> -1325.11. None stays None."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("$", "").replace(",", "")
    if not s:
        return None
    neg = s.startswith("(") and s.endswith(")")
    if neg:
        s = s[1:-1]
    try:
        return -float(s) if neg else float(s)
    except ValueError:
        return None


def rows_of(ws):
    head = [c.value for c in ws[1]]
    return [{h: v for h, v in zip(head, r) if h} for r in ws.iter_rows(min_row=2, values_only=True) if r[0]]


def rates(r):
    """The workbook's own rate columns, verbatim. 'CPA / CPFA' is spelled two ways across files."""
    ratio = r.get("CPA / CPFA", r.get("CPA/ CPFA"))
    return {
        "CPC": num(r.get("CPC $")), "CPL": num(r.get("CPL $")), "CPA": num(r.get("CPA $")),
        "CPFA": num(r.get("CPFA $")), "CPAtoCPFA": num(ratio),
        "AvgAccountSize": num(r.get("Average Account Size $")), "Redeposit": num(r.get("Re-Deposit $")),
        "TotalNMI": num(r.get("Total NMI $")), "ROI": num(r.get("ROI (NMI)")),
    }


def build_actuals():
    out = []
    for pid, label, frm, to, fname in SOT:
        wb = openpyxl.load_workbook(DL / fname, data_only=True)
        rows, totals = [], {}
        has_nmi = None
        for tab, platform in (("PPC", PLATFORM["PPC"]), ("Social", PLATFORM["Social"])):
            recs = rows_of(wb[tab])
            has_nmi = any(r.get("Total NMI $") is not None for r in recs)
            for r in recs:
                entry = {"country": r["Country"], "platform": platform,
                         "Spend": num(r.get("Spent $")), **rates(r)}
                if r["Country"] == "Total":
                    totals[platform] = {k: v for k, v in entry.items() if k not in ("country", "platform")}
                else:
                    rows.append(entry)
        out.append({
            "id": pid, "label": label, "from": frm, "to": to, "source": [fname],
            "reports": "rates and spend only; this workbook has no NMI or ROI column" if not has_nmi
                       else "rates, spend, deposits and ROI",
            "volumes": None,  # clicks / leads / accounts / funded are not stated in this workbook
            "rows": rows, "totals": totals,
        })
    return out


def build_expected():
    wb = openpyxl.load_workbook(DL / EXPECTED, data_only=True)

    # --- assumption levers ---
    a = {}
    for r in wb["Assumptions"].iter_rows(min_row=1, values_only=True):
        if r[1] and r[2] is not None and isinstance(r[1], str) and r[1] not in ("Metric",):
            a[r[1]] = {"PPC": num(r[2]), "Social": num(r[3]), "basis": r[4]}

    # --- per-country expected, one block per channel tab ---
    expected = {}
    for tab, key in (("PPC", "PPC"), ("Social Media", "Social")):
        grid = list(wb[tab].iter_rows(values_only=True))
        # Find the header by its label rather than a fixed offset; a blank spacer row above it
        # silently shifts the index and yields an empty block.
        hi = next(i for i, r in enumerate(grid) if r and r[0] == "Metric")
        countries = [c for c in grid[hi][1:] if c]
        block = {c: {} for c in countries}
        for row in grid[hi + 2:]:  # +2 skips the "Expected Results" band row
            metric = row[0]
            if not metric or not isinstance(metric, str):
                continue
            if metric.startswith(("TOTAL SPEND", "FTD $, Re-Deposit", "Difference =", "CAUTION")):
                continue
            for i, c in enumerate(countries):
                block[c][metric] = num(row[1 + i])
        expected[key] = block

    # --- the Data tab: plan inputs plus the only stated actual volumes anywhere ---
    ws = wb["Data"]
    head = [c.value for c in ws[1]]
    plan_inputs, actual_1_26 = {}, {}
    for r in ws.iter_rows(min_row=2, values_only=True):
        c = r[0]
        if not c or not isinstance(c, str) or c.startswith(("Blue =", "(NC)")):
            continue
        d = dict(zip(head, r))
        plan_inputs[c] = {
            "ISO": d.get("ISO"),
            "PPC": {"Budget": num(d.get("PPC Budget $")), "PlanCPL": num(d.get("PPC Plan CPL $"))},
            "Social": {"Budget": num(d.get("Social Budget $")), "PlanCPL": num(d.get("Social Plan CPL $"))},
            "AvgAccountSize": num(d.get("Avg Acct Size $")),
        }
        actual_1_26[c] = {
            "PPC": {"Spend": num(d.get("PPC Spend $")), "Clicks": num(d.get("PPC Clicks")),
                    "Impressions": num(d.get("PPC Impr")), "Leads": num(d.get("PPC Leads")),
                    "LiveAccounts": num(d.get("PPC Live")), "FundedAccounts": num(d.get("PPC Funded")),
                    "TotalDeposits": num(d.get("PPC Total Dep $ (NC)")), "FTD": num(d.get("PPC FTD Dep $ (NC)")),
                    "FTDAccounts": num(d.get("PPC FTD Accts (NC)"))},
            "Social": {"Spend": num(d.get("SOC Spend $")), "Clicks": num(d.get("SOC Clicks")),
                       "Impressions": num(d.get("SOC Impr")), "Leads": num(d.get("SOC Leads")),
                       "LiveAccounts": num(d.get("SOC Live")), "FundedAccounts": num(d.get("SOC Funded")),
                       "TotalDeposits": num(d.get("SOC Total Dep $ (NC)")), "FTD": num(d.get("SOC FTD Dep $ (NC)")),
                       "FTDAccounts": num(d.get("SOC FTD Accts (NC)"))},
        }
    # TOTAL is the workbook's own total row: keep it out of the country map so it cannot be summed in.
    totals = {"inputs": plan_inputs.pop("TOTAL", None), "actual": actual_1_26.pop("TOTAL", None)}
    return a, expected, plan_inputs, actual_1_26, totals


def main():
    assumptions, expected, plan_inputs, actual_1_26, plan_totals = build_expected()
    doc = {
        "generated": date.today().isoformat(),
        "notes": [
            "Every value is copied from a workbook cell. Nothing is derived, averaged or back-calculated.",
            "null means the workbook does not state the figure; it is not the same as 0.",
            "The three workbooks cover three different windows and are kept apart deliberately:",
            "  actuals[aug]      = 1-31 Aug 2026, rates and spend only",
            "  actuals[sep]      = 1-9 Sept 2026, rates and spend only",
            "  augustPlan.actual = 1-26 Aug 2026, the only source that states clicks/leads/accounts/funded",
            "Do not compare augustPlan.actual against actuals[aug]: 26 days versus 31.",
            "In the plan workbook PPC = Google Search/Bing/Display/Others and SOC = Facebook & Instagram/TikTok/Social Boosting Posts, a wider grouping than the SourceOfTruth tabs.",
            "The Overview tabs are ignored; they are computed from the PPC and Social tabs and the Sept Overview disagrees with its own Social tab on the sign of Jordan's NMI.",
        ],
        "sources": [
            {"file": f, "window": w} for f, w in [
                ("Aug-Social_and_PPC-SourceOfTruth (1).xlsx", "1-31 Aug 2026"),
                ("Sept-Social_and_PPC-SourceOfTruth.xlsx", "1-9 Sept 2026"),
                ("Aug&Sept-ExpectedNumbers.xlsx", "plan: full-month Aug 2026; actual: 1-26 Aug 2026"),
            ]
        ],
        "actuals": build_actuals(),
        "augustPlan": {
            "label": "August 2026 plan vs actual",
            "planBasis": "Full-month allocated budget per country, Lead Distribution / Marketing Budget plan, 13 Aug 2026",
            "actualWindow": {"from": "2026-08-01", "to": "2026-08-26"},
            "source": [EXPECTED],
            "assumptions": assumptions,
            "inputs": plan_inputs,
            "expected": expected,
            "actual": actual_1_26,
            "totals": plan_totals,
        },
    }
    OUT.write_text(json.dumps(doc, indent=1))
    n_act = sum(len(p["rows"]) for p in doc["actuals"])
    print(f"wrote {OUT}")
    print(f"  actual periods : {[p['id'] for p in doc['actuals']]}  ({n_act} country-platform rows)")
    print(f"  plan countries : {len(plan_inputs)}   expected channels: {list(expected)}")
    print(f"  assumptions    : {len(assumptions)} levers")


if __name__ == "__main__":
    main()
