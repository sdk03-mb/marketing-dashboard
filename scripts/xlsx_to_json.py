"""Convert the PPC and Social export workbooks into src/data/sheets.json.

Usage: python scripts/xlsx_to_json.py PPC-1-9-Sept.xlsx Social-1-9Sept.xlsx --id sep9 --label "1-9 Sept (sheet)" --from 2026-09-01 --to 2026-09-09

The workbooks carry derived metrics per country (spend, CPC, CPL, CPA, CPFA, average account size, re-deposits,
net money in, ROI). The app stores base volumes, so this script backs them out:
  clicks = spend / CPC, leads = spend / CPL, accounts = spend / CPA, funded = spend / CPFA (rounded)
  deposits = Total NMI, so ROI in the app equals the sheet's ROI (NMI)
  first deposits = average account size x funded, so average account size matches the sheet
  the sheet's own ratios ride along in `sheet` and win wherever the app shows one sheet row or the sheet's Total,
  so CPC, CPL, CPA, CPFA, average account size, re-deposits and ROI read exactly as the workbook states them
Standard library only: no openpyxl needed.
"""
import json, re, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLATFORM = {"ppc": "Google Search", "social": "Facebook & Instagram"}


def read_rows(path):
    z = zipfile.ZipFile(path)
    ss = []
    if "xl/sharedStrings.xml" in z.namelist():
        sst = z.read("xl/sharedStrings.xml").decode()
        ss = [re.sub(r"<[^>]+>", "", m) for m in re.findall(r"<si>(.*?)</si>", sst, re.S)]
    x = z.read("xl/worksheets/sheet1.xml").decode()
    rows = []
    for r in re.findall(r"<row [^>]*>(.*?)</row>", x, re.S):
        d = {}
        for col, t, v in re.findall(r'<c r="([A-Z]+)\d+"(?: [^>]*?t="(\w+)")?[^>]*?(?:/>|>(?:<f>.*?</f>)?<v>(.*?)</v></c>)', r, re.S):
            if v == "":
                continue
            d[col] = ss[int(v)] if t == "s" else float(v)
        rows.append(d)
    hdr = rows[0]
    cols = sorted(hdr.keys())
    return [{hdr[c]: r.get(c) for c in cols} for r in rows[1:]]


def metrics(r):
    """The sheet's own ratios, kept verbatim so the app shows them unchanged."""
    return {
        "CPC": r.get("CPC $") or 0.0, "CPL": r.get("CPL $") or 0.0, "CPA": r.get("CPA $") or 0.0, "CPFA": r.get("CPFA $") or 0.0,
        "AvgAccountSize": r.get("Average Account Size $") or 0.0, "Redeposit": r.get("Re-Deposit $") or 0.0, "ROI": r.get("ROI (NMI)") or 0.0,
    }


def convert(path, platform):
    out, total = [], None
    for r in read_rows(path):
        name = r.get("Country")
        if not name:
            continue
        if name == "Total":
            total = metrics(r)
            continue
        spend = r.get("Spent $") or 0.0
        cpc, cpl, cpa, cpfa = (r.get(k) or 0.0 for k in ("CPC $", "CPL $", "CPA $", "CPFA $"))
        avg, nmi = (r.get(k) or 0.0 for k in ("Average Account Size $", "Total NMI $"))
        funded = round(spend / cpfa) if cpfa > 0 else 0
        ftd = avg * funded
        out.append({
            "country": name, "platform": platform,
            "Spend": round(spend, 2),
            "Clicks": round(spend / cpc) if cpc > 0 else 0,
            "Leads": round(spend / cpl) if cpl > 0 else 0,
            "Accounts": round(spend / cpa) if cpa > 0 else 0,
            "FundedEvt": funded, "FTDAccounts": funded,
            "TotDep": round(nmi, 2), "Redep": round(nmi - ftd, 2),
            "sheet": metrics(r),
        })
    return out, total


def main(argv):
    args = {"--id": "sheet", "--label": "Sheet", "--from": "", "--to": ""}
    files = []
    i = 0
    while i < len(argv):
        if argv[i] in args:
            args[argv[i]] = argv[i + 1]; i += 2
        else:
            files.append(argv[i]); i += 1
    rows, totals = [], {}
    for f in files:
        kind = "social" if "social" in Path(f).name.lower() else "ppc"
        r, t = convert(f, PLATFORM[kind])
        rows += r
        if t:
            totals[PLATFORM[kind]] = t
    target = ROOT / "src" / "data" / "sheets.json"
    data = json.loads(target.read_text()) if target.exists() else {"periods": []}
    data["periods"] = [p for p in data["periods"] if p["id"] != args["--id"]]
    data["periods"].append({"id": args["--id"], "label": args["--label"], "from": args["--from"], "to": args["--to"],
                            "source": [Path(f).name for f in files], "rows": rows, "totals": totals})
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, indent=1))
    print("wrote", target, "period", args["--id"], "rows", len(rows))


if __name__ == "__main__":
    main(sys.argv[1:])
