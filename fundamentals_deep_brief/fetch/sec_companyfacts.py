"""
fundamentals_deep_brief/fetch/sec_companyfacts.py
Direct SEC EDGAR XBRL Company Facts extraction.
Pulls verified US-GAAP facts with exact accession numbers and report dates.
Includes local caching to prevent redundant requests and meet <90s runtime SLA.
"""

import os
import json
import requests
import datetime
from typing import Dict, Any, Optional

SEC_USER_AGENT = os.getenv("SEC_USER_AGENT", "SectorTrackerDesk research@sectortracker.com")
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "sec_cache")

def resolve_cik(ticker: str) -> Optional[str]:
    """Resolves a ticker symbol to a 10-digit zero-padded CIK string."""
    ticker_clean = ticker.upper().strip()
    cache_path = os.path.join(CACHE_DIR, "company_tickers.json")
    os.makedirs(CACHE_DIR, exist_ok=True)

    mapping = {}
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                mapping = json.load(f)
        except Exception:
            pass

    if not mapping:
        try:
            headers = {"User-Agent": SEC_USER_AGENT}
            res = requests.get("https://www.sec.gov/files/company_tickers.json", headers=headers, timeout=10)
            if res.status_code == 200:
                raw_data = res.json()
                mapping = {v["ticker"].upper(): str(v["cik_str"]).zfill(10) for v in raw_data.values()}
                with open(cache_path, "w") as f:
                    json.dump(mapping, f)
        except Exception as e:
            print(f"[sec_companyfacts] Warning resolving CIK online: {e}")

    return mapping.get(ticker_clean)

def fetch_sec_companyfacts(ticker: str) -> Dict[str, Any]:
    ticker_clean = ticker.upper().strip()
    cik = resolve_cik(ticker_clean)
    
    if not cik:
        return {
            "status": "failed",
            "reason": f"CIK resolution failed for {ticker_clean}",
            "facts": {},
            "accession_numbers": []
        }

    cache_file = os.path.join(CACHE_DIR, f"facts_{cik}.json")
    facts_data = None

    # Cache validity: 24 hours
    if os.path.exists(cache_file):
        try:
            mtime = os.path.getmtime(cache_file)
            if (datetime.datetime.now().timestamp() - mtime) < 86400:
                with open(cache_file, "r") as f:
                    facts_data = json.load(f)
        except Exception:
            pass

    if not facts_data:
        try:
            headers = {"User-Agent": SEC_USER_AGENT}
            url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
            res = requests.get(url, headers=headers, timeout=15)
            if res.status_code == 200:
                facts_data = res.json()
                with open(cache_file, "w") as f:
                    json.dump(facts_data, f)
            else:
                return {
                    "status": "failed",
                    "reason": f"SEC HTTP status {res.status_code}",
                    "facts": {},
                    "accession_numbers": []
                }
        except Exception as e:
            return {
                "status": "failed",
                "reason": str(e),
                "facts": {},
                "accession_numbers": []
            }

    # Parse primary US-GAAP facts
    us_gaap = facts_data.get("facts", {}).get("us-gaap", {})
    entity_name = facts_data.get("entityName", ticker_clean)
    
    parsed_metrics = {}
    accessions = set()

    def get_latest_annual(tag_names):
        for tag in tag_names:
            if tag in us_gaap:
                units = us_gaap[tag].get("units", {})
                usd_units = units.get("USD", [])
                # Filter for 10-K forms with annual form
                annuals = [u for u in usd_units if u.get("form") == "10-K" and "frame" in u]
                if not annuals:
                    annuals = [u for u in usd_units if u.get("form") == "10-K"]
                if annuals:
                    # Sort by end date
                    annuals.sort(key=lambda x: x.get("end", ""))
                    latest = annuals[-1]
                    if "accn" in latest:
                        accessions.add(latest["accn"])
                    return {
                        "value": latest.get("val"),
                        "end": latest.get("end"),
                        "accn": latest.get("accn"),
                        "form": latest.get("form"),
                        "tag": tag
                    }
        return None

    parsed_metrics["Revenues"] = get_latest_annual(["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"])
    parsed_metrics["GrossProfit"] = get_latest_annual(["GrossProfit"])
    parsed_metrics["OperatingIncome"] = get_latest_annual(["OperatingIncomeLoss"])
    parsed_metrics["NetIncome"] = get_latest_annual(["NetIncomeLoss"])
    parsed_metrics["OperatingCashFlow"] = get_latest_annual(["NetCashProvidedByUsedInOperatingActivities"])

    return {
        "status": "success",
        "cik": cik,
        "entity_name": entity_name,
        "facts": parsed_metrics,
        "accession_numbers": list(accessions),
        "source_url": f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
    }
