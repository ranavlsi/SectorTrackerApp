"""
fundamentals_deep_brief/pipeline.py
Master Orchestration Pipeline for Fundamentals Deep-Brief v2
Pipeline = Retrieve -> Ground -> Analyze -> Synthesize -> Verify Numbers against Retrieval.
Assembles the complete BriefData adhering to Chapters A through G.
"""

import os
import json
import datetime
from typing import Dict, Any, List, Optional

from fundamentals_deep_brief.fetch.market_yahoo import fetch_market_data
from fundamentals_deep_brief.fetch.statements_yahoo import fetch_statements_yahoo
from fundamentals_deep_brief.fetch.sec_companyfacts import fetch_sec_companyfacts
from fundamentals_deep_brief.fetch.sec_filings import fetch_sec_filings_text
from fundamentals_deep_brief.fetch.peers import resolve_peer_tickers, fetch_peers_comparison

from fundamentals_deep_brief.analyze.model import analyze_business_model
from fundamentals_deep_brief.analyze.quality import analyze_financial_quality
from fundamentals_deep_brief.analyze.valuation import analyze_valuation_in_context
from fundamentals_deep_brief.analyze.synthesize import (
    build_thesis_stub,
    build_competitive_position,
    build_catalysts_and_risks
)
from fundamentals_deep_brief.verify.number_audit import audit_narrative_text

def format_magnitude(val: Optional[float], default: str = "N/A") -> str:
    if val is None:
        return default
    abs_v = abs(val)
    if abs_v >= 1e12:
        return f"{val / 1e12:.2f}T"
    elif abs_v >= 1e9:
        return f"{val / 1e9:.2f}B"
    elif abs_v >= 1e6:
        return f"{val / 1e6:.1f}M"
    elif abs_v >= 1e3:
        return f"{val / 1e3:.0f}K"
    return f"{val:.2f}"

def generate_deep_brief_data(
    ticker: str,
    user_peers: Optional[List[str]] = None,
    focus_theme: Optional[str] = None,
    user_dcf_params: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    ticker_clean = ticker.upper().strip()
    failed_fetches = []

    # 1. RETRIEVAL LAYER
    # A. Market Data
    try:
        market_data = fetch_market_data(ticker_clean)
    except Exception as e:
        failed_fetches.append({"field": "Market Data", "reason": str(e)})
        market_data = {"ticker": ticker_clean, "price": 0.0, "source_id": "YF_FAILED"}

    # B. Financial Statements
    try:
        statements = fetch_statements_yahoo(ticker_clean)
    except Exception as e:
        failed_fetches.append({"field": "Financial Statements", "reason": str(e)})
        statements = {"annual_records": [], "quarterly_records": [], "ttm": {}}

    # C. SEC Company Facts
    try:
        sec_facts = fetch_sec_companyfacts(ticker_clean)
        if sec_facts.get("status") == "failed":
            failed_fetches.append({"field": "SEC XBRL Facts", "reason": sec_facts.get("reason")})
    except Exception as e:
        failed_fetches.append({"field": "SEC XBRL Facts", "reason": str(e)})
        sec_facts = {"status": "failed", "facts": {}, "accession_numbers": []}

    # D. SEC Filings Text (10-K / 10-Q)
    try:
        filing_data = fetch_sec_filings_text(ticker_clean)
        if not filing_data.get("filings_available"):
            failed_fetches.append({"field": "SEC 10-K Text Disclosures", "reason": filing_data.get("reason", "Unavailable")})
    except Exception as e:
        failed_fetches.append({"field": "SEC 10-K Text Disclosures", "reason": str(e)})
        filing_data = {"filings_available": False, "latest_10k": None}

    # E. Peers Benchmark
    resolved_peers = resolve_peer_tickers(ticker_clean, user_peers, market_data.get("industry"))
    try:
        peers_comparison = fetch_peers_comparison(ticker_clean, resolved_peers)
    except Exception as e:
        failed_fetches.append({"field": "Peers Comparison", "reason": str(e)})
        peers_comparison = []

    # 2. ANALYSIS LAYER
    # Chapter B: Business Model
    business_model = analyze_business_model(ticker_clean, market_data, filing_data)

    # Chapter D: Financial Statement Quality & Economics
    quality = analyze_financial_quality(statements, market_data)

    # Chapter E: Valuation in Context
    valuation = analyze_valuation_in_context(ticker_clean, market_data, statements, peers_comparison, user_dcf_params)

    # Chapter C: Competitive Position
    competitive = build_competitive_position(ticker_clean, filing_data, business_model)
    competitive["peers_table"] = peers_comparison

    # Chapter F: Catalysts, Risks & Watchlist
    synthesis = build_catalysts_and_risks(ticker_clean, filing_data, market_data, quality)

    # Chapter A: One-line thesis stub (strictly generated only after B-F exist)
    thesis_stub = build_thesis_stub(ticker_clean, business_model, quality, valuation)

    # 3. AUDIT & VERIFICATION LAYER
    # Assert every numeric token in narrative appears in data store
    raw_brief = {
        "price": market_data.get("price"),
        "market_cap": market_data.get("market_cap"),
        "enterprise_value": market_data.get("enterprise_value"),
        "revenue_ttm": statements.get("ttm", {}).get("revenue"),
        "fcf_ttm": statements.get("ttm", {}).get("free_cash_flow"),
        "annual_records": statements.get("annual_records", []),
        "peers": peers_comparison
    }

    # Audit thesis stub and what market is pricing
    audited_thesis, thesis_violations = audit_narrative_text(thesis_stub, raw_brief)
    audited_pricing, pricing_violations = audit_narrative_text(valuation["what_market_is_pricing"], raw_brief)
    valuation["what_market_is_pricing"] = audited_pricing

    # 4. COVER STRIP & SOURCES INVENTORY ASSEMBLY
    ttm = statements.get("ttm", {})
    rev_ttm_val = ttm.get("revenue")
    fcf_ttm_val = ttm.get("free_cash_flow")
    net_debt_val = ttm.get("net_debt") or quality.get("balance_sheet", {}).get("net_debt")
    emp_count = market_data.get("employees")

    latest_10k_date = filing_data.get("latest_10k", {}).get("filing_date") if filing_data.get("latest_10k") else "Latest Annual"

    cover = {
        "ticker": ticker_clean,
        "company_name": market_data.get("company_name", ticker_clean),
        "exchange": market_data.get("exchange", "US"),
        "sector": market_data.get("sector", "Sector"),
        "industry": market_data.get("industry", "Industry"),
        "as_of_market": market_data.get("as_of_timestamp", datetime.datetime.now().strftime("%Y-%m-%d")),
        "as_of_filing": latest_10k_date,
        "cik": sec_facts.get("cik"),
        "thesis_stub": audited_thesis,
        "price": market_data.get("price", 0.0),
        "market_cap_str": format_magnitude(market_data.get("market_cap")),
        "enterprise_value_str": format_magnitude(market_data.get("enterprise_value")),
        "ttm_revenue_str": format_magnitude(rev_ttm_val),
        "ttm_fcf_str": format_magnitude(fcf_ttm_val),
        "net_debt_str": format_magnitude(net_debt_val),
        "employees_str": f"{emp_count:,}" if emp_count else "Not Disclosed"
    }

    # Build Master Sources Appendix
    sources_entries = [
        {
            "id": market_data.get("source_id", "YF_MKT"),
            "description": "Yahoo Finance Real-Time Quote & Historical Multiples",
            "details": f"Timestamp: {market_data.get('as_of_timestamp')}"
        }
    ]

    for rec in statements.get("annual_records", []):
        sources_entries.append({
            "id": rec.get("source_id", "STMT_ANNUAL"),
            "description": f"Audited Annual 10-K Financial Statement (FY{rec.get('period')})",
            "details": f"Period Ended: {rec.get('date')}"
        })

    if filing_data.get("latest_10k"):
        k = filing_data["latest_10k"]
        sources_entries.append({
            "id": f"SEC_EDGAR_10K_{ticker_clean}",
            "description": "SEC EDGAR Annual Report Form 10-K (Item 1, Item 1A, Item 7)",
            "details": f"Accession No: {k.get('accession_no')} | Filed: {k.get('filing_date')}"
        })

    for p in peers_comparison:
        if not p.get("is_target"):
            sources_entries.append({
                "id": p.get("source", f"PEER_{p['ticker']}"),
                "description": f"Peer Comparison Data for {p['ticker']} ({p['company_name']})",
                "details": f"Market Cap: ${format_magnitude(p.get('market_cap'))} | EV/Sales: {p.get('ev_sales') or 'N/A'}"
            })

    sources = {
        "entries": sources_entries,
        "failed_fetches": failed_fetches,
        "audit_violations_caught": len(thesis_violations) + len(pricing_violations)
    }

    return {
        "cover": cover,
        "business_model": business_model,
        "competitive": competitive,
        "quality": quality,
        "valuation": valuation,
        "synthesis": synthesis,
        "sources": sources,
        "metadata": {
            "version": "v2.0",
            "spec": "Fundamentals Deep-Brief App — Build Spec v2",
            "generated_at": datetime.datetime.now().isoformat(),
            "focus_theme": focus_theme
        }
    }
