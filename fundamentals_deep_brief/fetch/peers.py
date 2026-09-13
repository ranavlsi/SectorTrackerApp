"""
fundamentals_deep_brief/fetch/peers.py
Resolves 3-6 named peers and fetches identical valuation multiples
and scale comparison metrics for relative valuation benchmarking.
"""

import yfinance as yf
from typing import List, Dict, Any, Optional

DEFAULT_PEER_MAP = {
    "PWR": ["EME", "MTZ", "DY", "FLR", "J"],        # Quanta Services peers (EPC, grid infra)
    "CPRT": ["IAA", "KAR", "KMX", "AN", "PAG"],      # Copart peers (salvage & auto auctions)
    "NVDA": ["AMD", "AVGO", "QCOM", "INTC", "ARM"],  # Nvidia peers
    "AAPL": ["MSFT", "GOOGL", "AMZN", "META"],       # Apple peers
    "MSFT": ["GOOGL", "AMZN", "AAPL", "ORCL", "CRM"],# Microsoft peers
    "AMZN": ["MSFT", "GOOGL", "WMT", "TGT", "BABA"], # Amazon peers
    "GOOGL": ["META", "MSFT", "AMZN", "AAPL"],       # Alphabet peers
    "META": ["GOOGL", "SNAP", "PINS", "MSFT", "AMZN"],
    "TSLA": ["F", "GM", "RIVN", "LCID", "BYDDF"],
    "JPM": ["BAC", "WFC", "C", "GS", "MS"],
    "SMCI": ["DELL", "HPE", "VRT", "ANET"],
    "VRT": ["SMCI", "ETN", "HUBB", "NVDA"],
    "CRWD": ["PANW", "FTNT", "ZS", "S"],
}

def resolve_peer_tickers(target_ticker: str, user_peers: Optional[List[str]] = None, industry: Optional[str] = None) -> List[str]:
    target = target_ticker.upper().strip()
    if user_peers:
        clean_user = [p.upper().strip() for p in user_peers if p.upper().strip() != target]
        if clean_user:
            return clean_user[:6]

    # Check curated peer map
    if target in DEFAULT_PEER_MAP:
        return DEFAULT_PEER_MAP[target][:5]

    # Heuristic fallback using sector/industry or common large caps
    fallback_peers = ["AAPL", "MSFT", "NVDA", "AMZN"]
    return [p for p in fallback_peers if p != target][:4]

def fetch_peers_comparison(target_ticker: str, peer_tickers: List[str]) -> List[Dict[str, Any]]:
    results = []
    
    # Process target first, then peers
    all_tickers = [target_ticker.upper().strip()] + [p.upper().strip() for p in peer_tickers if p.upper().strip() != target_ticker.upper().strip()]
    
    for sym in all_tickers:
        try:
            t = yf.Ticker(sym)
            info = t.info or {}
            
            mkt_cap = info.get("marketCap", 0)
            ev = info.get("enterpriseValue", 0)
            rev_ttm = info.get("totalRevenue", 0)
            gp_margin = info.get("grossMargins")
            op_margin = info.get("operatingMargins")
            
            pe_fwd = info.get("forwardPE")
            ev_sales = info.get("enterpriseToRevenue")
            ev_ebitda = info.get("enterpriseToEbitda")
            fcf = info.get("freeCashflow")
            fcf_yield = round((fcf / mkt_cap * 100), 2) if (fcf and mkt_cap and mkt_cap > 0) else None

            results.append({
                "ticker": sym,
                "is_target": (sym == target_ticker.upper().strip()),
                "company_name": info.get("shortName") or sym,
                "market_cap": mkt_cap,
                "enterprise_value": ev,
                "revenue_ttm": rev_ttm,
                "gross_margin_pct": round(gp_margin * 100, 1) if gp_margin is not None else None,
                "operating_margin_pct": round(op_margin * 100, 1) if op_margin is not None else None,
                "ev_sales": round(ev_sales, 2) if ev_sales else None,
                "ev_ebitda": round(ev_ebitda, 2) if ev_ebitda else None,
                "forward_pe": round(pe_fwd, 1) if pe_fwd else None,
                "fcf_yield_pct": fcf_yield,
                "source": f"YF_QUOTE_{sym}"
            })
        except Exception as e:
            print(f"[fetch_peers_comparison] Error fetching peer {sym}: {e}")

    return results
