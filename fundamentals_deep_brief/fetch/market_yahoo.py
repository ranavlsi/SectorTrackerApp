"""
fundamentals_deep_brief/fetch/market_yahoo.py
Fetches real-time price, market cap, enterprise value, shares outstanding,
valuation multiples, and historical trading ranges from Yahoo Finance.
Every datapoint is annotated with a source ID and timestamp.
"""

import yfinance as yf
import datetime
from typing import Dict, Any, Optional

def fetch_market_data(ticker: str) -> Dict[str, Any]:
    ticker_clean = ticker.upper().strip()
    t = yf.Ticker(ticker_clean)
    now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    source_id = f"YF_MKT_{ticker_clean}_{datetime.datetime.now().strftime('%Y%m%d')}"

    info = {}
    try:
        info = t.info or {}
    except Exception as e:
        print(f"[fetch_market_data] Warning fetching info for {ticker_clean}: {e}")

    # Fallbacks and price resolution
    curr_price = (
        info.get("currentPrice")
        or info.get("regularMarketPrice")
        or info.get("previousClose")
        or 0.0
    )
    
    # 52w bounds
    high_52 = info.get("fiftyTwoWeekHigh", 0.0)
    low_52 = info.get("fiftyTwoWeekLow", 0.0)

    # Key statistics
    mkt_cap = info.get("marketCap", 0)
    ev = info.get("enterpriseValue", 0)
    shares_out = info.get("sharesOutstanding", 0)
    employees = info.get("fullTimeEmployees")
    
    # Valuation multiples
    pe_trailing = info.get("trailingPE")
    pe_forward = info.get("forwardPE")
    ev_sales = info.get("enterpriseToRevenue")
    ev_ebitda = info.get("enterpriseToEbitda")
    pb_ratio = info.get("priceToBook")
    ps_ratio = info.get("priceToSalesTrailing12Months")
    beta = info.get("beta", 1.0)
    div_yield = info.get("dividendYield")

    # Fetch 3-5Y price history to derive historical valuation bands
    hist_multiples = {}
    try:
        hist_df = t.history(period="5y")
        if not hist_df.empty:
            close_prices = hist_df["Close"]
            hist_multiples = {
                "5y_high_price": round(float(close_prices.max()), 2),
                "5y_low_price": round(float(close_prices.min()), 2),
                "5y_median_price": round(float(close_prices.median()), 2),
                "current_vs_5y_high_pct": round(float((curr_price - close_prices.max()) / close_prices.max() * 100), 1) if close_prices.max() > 0 else 0.0,
                "current_vs_5y_low_pct": round(float((curr_price - close_prices.min()) / close_prices.min() * 100), 1) if close_prices.min() > 0 else 0.0,
            }
    except Exception as e:
        print(f"[fetch_market_data] Could not fetch 5y history for {ticker_clean}: {e}")

    return {
        "ticker": ticker_clean,
        "company_name": info.get("longName") or info.get("shortName") or ticker_clean,
        "short_name": info.get("shortName") or ticker_clean,
        "exchange": info.get("exchange", "US"),
        "sector": info.get("sector", "Unknown"),
        "industry": info.get("industry", "Unknown"),
        "country": info.get("country", "United States"),
        "website": info.get("website", ""),
        "currency": info.get("currency", "USD"),
        "as_of_timestamp": now_utc,
        "source_id": source_id,
        "price": float(curr_price),
        "market_cap": mkt_cap,
        "enterprise_value": ev,
        "shares_outstanding": shares_out,
        "employees": employees,
        "52_week_high": high_52,
        "52_week_low": low_52,
        "multiples": {
            "pe_trailing": round(pe_trailing, 2) if pe_trailing else None,
            "pe_forward": round(pe_forward, 2) if pe_forward else None,
            "ev_sales": round(ev_sales, 2) if ev_sales else None,
            "ev_ebitda": round(ev_ebitda, 2) if ev_ebitda else None,
            "pb_ratio": round(pb_ratio, 2) if pb_ratio else None,
            "ps_ratio": round(ps_ratio, 2) if ps_ratio else None,
            "beta": round(beta, 2) if beta else 1.0,
            "dividend_yield_pct": round(div_yield * 100, 2) if div_yield else None,
        },
        "history_bands": hist_multiples,
        "raw_info": {
            "target_mean_price": info.get("targetMeanPrice"),
            "target_high_price": info.get("targetHighPrice"),
            "target_low_price": info.get("targetLowPrice"),
            "recommendation": info.get("recommendationKey"),
            "business_summary": info.get("longBusinessSummary", "")
        }
    }
