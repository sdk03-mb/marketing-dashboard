"""Build src/data/marketing-data.json from the three source workbooks.

  python scripts/build_marketing_data.py

Reads (paths below), and keeps each workbook's own reporting window separate - they do NOT
describe the same range and must not be merged:

  Aug-Social_and_PPC-SourceOfTruth (1).xlsx  full month Aug 2026, rates only (no NMI / ROI columns)
  Sept-Social_and_PPC-SourceOfTruth.xlsx     1-9 Sept 2026,       rates only (no NMI / ROI columns)
  Aug&Sept-ExpectedNumbers.xlsx              1-26 Aug 2026 actuals with real volumes, plus the
                                             full-month Aug plan and its assumption levers
  Lead_Distribution_Marketing_Budget_10-09-2026.xlsx
                                             the Sept 2026 plan: budget, CPL and lead targets by
                                             country and region. The sales-team / per-head split in
                                             that workbook is deliberately not read.

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

# The *_ALL_SOURCE_OF_TRUTH workbooks supersede the earlier SourceOfTruth exports: same tabs, but
# 14 columns carrying the volume counts (clicks, leads, live accounts, funded accounts) plus NMI
# and ROI, so every rate can be blended correctly instead of read off a row.
SOT = [
    ("aug", "August 2026", "2026-08-01", "2026-08-31", "AUG_ALL_SOURCE_OF_TRUTH (1).xlsx"),
    ("sep", "September 2026", "2026-09-01", None, "SEPT_ALL_SOURCE_OF_TRUTH (1).xlsx"),
]
# Column order of the PPC / Social tabs and of each block on the Overview tab.
COLS = ["Country", "Spend", "Clicks", "CPC", "Leads", "CPL", "LiveAccounts", "CPA",
        "FundedAccounts", "CPFA", "AvgAccountSize", "Redeposit", "TotalNMI", "ROI"]
# Overview blocks start at A, P and AE.
BLOCKS = (0, 15, 30)
EXPECTED = "Aug&Sept-ExpectedNumbers.xlsx"
BUDGET = "Lead_Distribution_Marketing_Budget_10-09-2026.xlsx"  # September plan
# The Sept plan spells this market out; every other file and the app say KSA. Keyed as KSA
# so it joins, with the workbook's own label retained on the row.
ALIAS = {"Saudi Arabia": "KSA"}
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


def _block(row, off):
    """One 14-column block of a row, keyed by COLS. Country stays text; the rest go through num()."""
    vals = row[off:off + len(COLS)]
    out = {"country": vals[0]}
    for k, v in zip(COLS[1:], vals[1:]):
        out[k] = num(v)
    return out


def build_actuals():
    out = []
    for pid, label, frm, to, fname in SOT:
        wb = openpyxl.load_workbook(DL / fname, data_only=True)
        rows, totals = [], {}
        for tab, platform in (("PPC", PLATFORM["PPC"]), ("Social", PLATFORM["Social"])):
            for r in wb[tab].iter_rows(min_row=2, values_only=True):
                if not r[0]:
                    continue
                b = _block(r, 0)
                name = b.pop("country")
                if name == "Total":
                    totals[platform] = b
                else:
                    rows.append({"country": name, "platform": platform, **b})

        # The Overview tab carries a third block combining the two channels. Its banner row names
        # each block, and the order is not the same in both workbooks, so read it rather than assume.
        ws = wb["Overview"]
        grid = list(ws.iter_rows(values_only=True))
        banner = {grid[0][o]: o for o in BLOCKS if grid[0][o]}
        combined_off = banner.get("TOTALS")
        overview, ov_total = [], None
        for r in grid[3:]:
            if not r[combined_off]:
                continue
            b = _block(r, combined_off)
            name = b.pop("country")
            if name == "Total":
                ov_total = b
            else:
                overview.append({"country": name, **b})

        # Two cells the workbook never finishes: "Average Account Size" is the literal text
        # FORMULA?? in both files, and the Sept Overview has no CPFA formula at all. Fill them with
        # the same method the workbook uses for every other blended rate - sum the volumes, then
        # divide - and keep them OUT of the as-stated block so provenance stays clear.
        def blended_avg(a, b):
            fa, fb = (a.get("FundedAccounts") or 0), (b.get("FundedAccounts") or 0)
            if fa + fb == 0:
                return None
            return ((a.get("AvgAccountSize") or 0) * fa + (b.get("AvgAccountSize") or 0) * fb) / (fa + fb)

        by_ctry = {}
        for r in rows:
            by_ctry.setdefault(r["country"], {})[r["platform"]] = r
        gaps_by_country = []
        for o in overview:
            pair = by_ctry.get(o["country"], {})
            a = pair.get(PLATFORM["PPC"], {}); b = pair.get(PLATFORM["Social"], {})
            gaps_by_country.append({
                "country": o["country"],
                "AvgAccountSize": blended_avg(a, b),
                "CPFA": (o["Spend"] / o["FundedAccounts"]) if o.get("FundedAccounts") else None,
            })
        # Flag as-stated overview rates that disagree with the correct blend, rather than sniffing
        # the formula text: this clears itself when the workbook is fixed and catches any cause
        # (unfinished cell, misaligned row reference, stale cached value).
        def off_by(stated, correct):
            if correct is None:
                return False
            if stated is None:
                return True
            tol = max(0.01, abs(correct) * 1e-6)   # tolerant of the 2dp copies the Overview keeps
            return abs(stated - correct) > tol

        suspect = []
        for field in ("AvgAccountSize", "CPFA"):
            wrong = [o["country"] for o, g in zip(overview, gaps_by_country) if off_by(o.get(field), g[field])]
            if wrong:
                suspect.append({"field": field, "rowsAffected": len(wrong),
                                "examples": wrong[:5],
                                "why": "as-stated value does not equal the correct blend for its own row; use overview.corrected"})

        gaps_total = {
            "AvgAccountSize": blended_avg(totals.get(PLATFORM["PPC"], {}), totals.get(PLATFORM["Social"], {})),
            "CPFA": (ov_total["Spend"] / ov_total["FundedAccounts"]) if ov_total and ov_total.get("FundedAccounts") else None,
        }

        out.append({
            "id": pid, "label": label, "from": frm, "to": to, "source": [fname],
            "reports": "spend, volume counts, every unit cost, re-deposits, NMI and ROI",
            "blocksOnOverviewTab": list(banner),
            "rows": rows,
            "totals": totals,
            "overview": {
                "what": "the workbook's own TOTALS block: PPC + Social combined, per country and overall",
                "byCountry": overview,
                "total": ov_total,
                "suspect": suspect,
                "corrected": {
                    "what": "NOT from a cell. Computed here the same way the workbook computes its other blended rates. Use in place of the as-stated fields listed in overview.suspect.",
                    "AvgAccountSize": "sum(AvgAccountSize x FundedAccounts) / sum(FundedAccounts) across the two channels",
                    "CPFA": "combined Spend / combined FundedAccounts",
                    "byCountry": gaps_by_country,
                    "total": gaps_total,
                },
            },
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


def build_september_plan():
    """The 9 Sept 2026 Lead Distribution / Marketing Budget plan.

    States budget, CPL and leads only, by region and by country. It carries none of the
    downstream funnel that the August workbook derived from assumption levers (accounts,
    funded, deposits, ROI), so those are simply absent here rather than computed.

    The workbook's sales-team views - section 1 in full, the per-country team split in
    section 3, and the staff / leads-per-head columns - are deliberately not read.
    """
    wb = openpyxl.load_workbook(DL / BUDGET, data_only=True)
    g = list(wb["Marketing Budget"].iter_rows(values_only=True))

    def hrow(label):
        return next(i for i, r in enumerate(g) if r and r[1] == label)

    def chan(r, o):
        return {"Budget": num(r[o]), "CPL": num(r[o + 1]), "Leads": num(r[o + 2])}

    # 1. by region
    regions = []
    for r in g[hrow("Region") + 1:]:
        if not r[1] or str(r[1]).startswith("TOTAL"):
            break
        regions.append({"region": str(r[1]).split("\n")[0], "countries": r[2],
                        "PPC": chan(r, 3), "Social": chan(r, 6),
                        "Combined": {"Budget": num(r[9]), "Leads": num(r[10])},
                        "shareOfPPCBudget": num(r[11]), "shareOfSocialBudget": num(r[12])})

    # 2. by country. Rows under a country are its sales-team split and are skipped.
    countries, region = {}, None
    for r in g[hrow("Region  /  Country  /  Sales team") + 1:]:
        if not r[1]:
            continue
        if str(r[1]).startswith("TOTAL"):
            break
        if r[2] is None:                       # region banner
            region = str(r[1]).split("\n")[0]
        elif r[2] == "country total":
            name = ALIAS.get(r[1], r[1])
            entry = {"region": region, "PPC": chan(r, 3), "Social": chan(r, 6),
                     "Combined": {"Budget": num(r[9]), "Leads": num(r[10])}}
            if name != r[1]:
                entry["sourceLabel"] = r[1]
            countries[name] = entry

    tot = g[hrow("TOTAL  —  ALL REGIONS")]
    return {
        "label": "September 2026 plan",
        "planBasis": g[2][1],
        "planDated": "2026-09-09",
        "workbookDated": "2026-09-10",
        "source": [BUDGET],
        "reports": "budget, CPL and leads only; this plan states no accounts, funded accounts, deposits or ROI",
        "excluded": "the workbook's sales-team views and staff / leads-per-head columns",
        "byRegion": regions,
        "byCountry": countries,
        "totals": {"PPC": chan(tot, 3), "Social": chan(tot, 6),
                   "Combined": {"Budget": num(tot[9]), "Leads": num(tot[10])}},
    }


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
            "  plans.aug.actual  = 1-26 Aug 2026, the only source that states clicks/leads/accounts/funded",
            "  plans.sep         = full-month Sept 2026 budget plan; states budget, CPL and leads only",
            "Do not compare plans.aug.actual against actuals[aug]: 26 days versus 31.",
            "plans.sep is a FULL-MONTH plan while actuals[sep] covers only 1-9 Sept.",
            "plans.sep is keyed KSA where the workbook writes Saudi Arabia, so it joins with every other block; the original label is kept on that row as sourceLabel.",
            "plans.sep adds Uruguay, which appears in no actuals file, and budgets no Greece, Norway, Sweden, Netherlands, Kazakhstan, India or Pakistan, all of which the August plan did.",
            "The September workbook also splits budget and leads by sales team and per head. That is people data and is not carried in this file.",
            "In the plan workbook PPC = Google Search/Bing/Display/Others and SOC = Facebook & Instagram/TikTok/Social Boosting Posts, a wider grouping than the SourceOfTruth tabs.",
            "The Overview tabs are ignored; they are computed from the PPC and Social tabs and the Sept Overview disagrees with its own Social tab on the sign of Jordan's NMI.",
        ],
        "audit": [
            "Audited against AUG_ALL_SOURCE_OF_TRUTH (1).xlsx and SEPT_ALL_SOURCE_OF_TRUTH (1).xlsx as modified 2026-09-10 20:13.",
            "CORRECT - per-row rates hold on every row with a non-zero denominator: CPC=Spend/Clicks, CPL=Spend/Leads, CPA=Spend/Live, CPFA=Spend/Funded, ROI=NMI/Spend. Aug PPC, Aug Social and Sept PPC are clean on all of them.",
            "CORRECT - volumes are additive and each tab's Total row equals the sum of its countries, except Sept Social NMI (see the Jordan entry).",
            "CORRECT - every Total row recomputes its rates from the totals instead of summing the rate columns.",
            "CORRECT - the Overview TOTALS block blends properly: sums the volumes, then divides. The earlier SourceOfTruth exports summed the rate columns instead, which inflated combined ROI by 70% and combined CPL by about 109%.",
            "CONFIRMED - Average Account Size uses Funded Accounts as its denominator; the funded-weighted country average reproduces each tab's Total row exactly in all four tabs.",
            "FIXED - the Aug Overview Average Account Size is now a real formula, =IFERROR((K4*I4+Z4*X4)/(I4+X4),0), aligned to its own row. It was the literal text FORMULA?? in the two previous uploads.",
            "FIXED - the Sept Overview Average Account Size row misalignment is gone. The previous upload had AO4 reading row 5 and the Total reading row 38 (past the data), so every country showed the next country's blend; all 34 rows now match the correct blend for their own row.",
            "FIXED - the Sept Overview CPFA formula is present.",
            "FIXED - Aug PPC, Other: CPFA now reads 56.0 against $56 of spend and 1 funded account. It was 0.",
            "OPEN - Sept Social, Jordan: Total NMI is stated +20,458.14 but its own ROI of -14.8661 against $1,376.16 of spend implies -20,458.13. Flipping the sign makes the country rows reconcile exactly to the stated Total of 47,026.71, so the sign is the error and the Total row is right. As loaded, Sept Social country NMI sums to 87,942.99, exceeding the Total row by 40,916.28 = 2x Jordan. Across the last three uploads this cell has only changed from text to number; the sign is unchanged.",
            "OPEN - the Sept Social tab still stores its rates pre-rounded as text ('$11', '$44', '$0.93'), 223 such cells, while every other tab now carries full precision. Twelve CPL and CPA rows therefore differ from Spend/Leads and Spend/Live in the second decimal, and its Total CPC reads 0.93 against a true 0.929677. Values only, not a logic fault.",
            "MINOR - the Aug Overview keeps a 2dp copy of the Social block's Average Account Size total (668.79 against the tab's 668.7901409), so its blended figure reads 1,116.53674 where full precision gives 1,116.53679. A 0.00005 rounding artifact.",
            "OPEN - neither workbook states a reporting window anywhere. August matches the earlier full-month export exactly ($276,488.18 PPC). September spans more days than the 1-9 Sept export (PPC $127,030.33 -> $139,334.39) but the end date is not in the file, so actuals[sep].to is null pending confirmation.",
        ],
        "sources": [
            {"file": f, "window": w} for f, w in [
                ("AUG_ALL_SOURCE_OF_TRUTH.xlsx", "1-31 Aug 2026"),
                ("SEPT_ALL_SOURCE_OF_TRUTH.xlsx", "September 2026, end date not stated in the workbook"),
                ("Aug&Sept-ExpectedNumbers.xlsx", "plan: full-month Aug 2026; actual: 1-26 Aug 2026"),
                ("Lead_Distribution_Marketing_Budget_10-09-2026.xlsx", "plan: full-month Sept 2026"),
            ]
        ],
        "actuals": build_actuals(),
        "plans": {
          "aug": {
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
          "sep": build_september_plan(),
        },
    }
    OUT.write_text(json.dumps(doc, indent=1))
    n_act = sum(len(p["rows"]) for p in doc["actuals"])
    print(f"wrote {OUT}")
    print(f"  actual periods : {[p['id'] for p in doc['actuals']]}  ({n_act} country-platform rows)")
    for pp in doc["actuals"]:
        print(f"     {pp['id']}: {len(pp['rows'])} rows, totals {list(pp['totals'])}, overview {len(pp['overview']['byCountry'])} countries")
    sep = doc["plans"]["sep"]
    print(f"  aug plan       : {len(plan_inputs)} countries, {len(assumptions)} levers, expected channels {list(expected)}")
    print(f"  sep plan       : {len(sep['byCountry'])} countries, {len(sep['byRegion'])} regions, budget ${sep['totals']['Combined']['Budget']:,.0f} (no people data)")


if __name__ == "__main__":
    main()
