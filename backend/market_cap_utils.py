"""Shared real market-cap and equity verification utilities for institutional scanners."""

import json
import math
import os
import time
from typing import Any, Dict, List

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
MCAP_CACHE_PATH = os.path.join(DATA_DIR, "market_cap_cache.json")
MCAP_CACHE_TTL_SEC = 7 * 86400
NON_EQUITY_TYPES = {
    "ETF",
    "MUTUALFUND",
    "INDEX",
    "TRUST",
    "CURRENCY",
    "CRYPTOCURRENCY",
    "FUTURE",
    "OPTION",
}


def _load_mcap_cache() -> Dict[str, Dict[str, Any]]:
    if not os.path.exists(MCAP_CACHE_PATH):
        return {}
    try:
        with open(MCAP_CACHE_PATH, "r") as f:
            raw = json.load(f)
        return raw if isinstance(raw, dict) else {}
    except Exception:
        return {}


def _save_mcap_cache(cache: Dict[str, Dict[str, Any]]) -> None:
    try:
        os.makedirs(os.path.dirname(MCAP_CACHE_PATH), exist_ok=True)
        sanitized: Dict[str, Dict[str, Any]] = {}
        for sym, entry in cache.items():
            if not isinstance(entry, dict):
                continue
            mcap = entry.get("market_cap", 0.0)
            try:
                mcap_f = float(mcap or 0.0)
                if math.isnan(mcap_f) or math.isinf(mcap_f):
                    mcap_f = 0.0
            except Exception:
                mcap_f = 0.0
            sanitized[sym] = {
                "market_cap": mcap_f,
                "is_etf": bool(entry.get("is_etf", False)),
                "name": str(entry.get("name") or ""),
                "sector": str(entry.get("sector") or ""),
                "industry": str(entry.get("industry") or ""),
                "ts": float(entry.get("ts") or 0.0),
            }
        with open(MCAP_CACHE_PATH, "w") as f:
            json.dump(sanitized, f, indent=2, allow_nan=False)
    except Exception:
        pass


def fetch_and_cache_market_caps(
    tickers: List[str],
    allow_yfinance_fallback: bool = True,
) -> Dict[str, Dict[str, Any]]:
    """
    Bulk-fetches real market caps, quote types (ETF vs Equity), company names,
    and sector metadata via yahooquery (with yfinance fast_info fallback),
    persisting results in backend/data/market_cap_cache.json.
    """
    cache = _load_mcap_cache()
    now_ts = time.time()
    clean_tickers = sorted({str(t).upper().strip() for t in tickers if t})

    to_fetch = []
    for sym in clean_tickers:
        entry = cache.get(sym)
        if not isinstance(entry, dict):
            to_fetch.append(sym)
            continue
        is_stale = (now_ts - float(entry.get("ts", 0.0) or 0.0)) > MCAP_CACHE_TTL_SEC
        has_valid_cap = entry.get("market_cap") is not None and (
            float(entry.get("market_cap") or 0.0) > 0.0 or bool(entry.get("is_etf", False))
        )
        if is_stale or not has_valid_cap:
            to_fetch.append(sym)

    chunk_size = 55
    for idx in range(0, len(to_fetch), chunk_size):
        chunk = to_fetch[idx : idx + chunk_size]
        summary_details: Dict[str, Any] = {}
        quote_types: Dict[str, Any] = {}
        profiles: Dict[str, Any] = {}

        try:
            from yahooquery import Ticker as YQTicker

            yq = YQTicker(chunk, asynchronous=True)
            try:
                raw_sd = yq.summary_detail
                if isinstance(raw_sd, dict):
                    summary_details = raw_sd
            except Exception:
                pass
            try:
                raw_qt = yq.quote_type
                if isinstance(raw_qt, dict):
                    quote_types = raw_qt
            except Exception:
                pass
            try:
                raw_prof = yq.summary_profile
                if isinstance(raw_prof, dict):
                    profiles = raw_prof
            except Exception:
                pass
        except Exception:
            pass

        for sym in chunk:
            sd = summary_details.get(sym) if isinstance(summary_details.get(sym), dict) else {}
            qt = quote_types.get(sym) if isinstance(quote_types.get(sym), dict) else {}
            prof = profiles.get(sym) if isinstance(profiles.get(sym), dict) else {}

            mcap = float(sd.get("marketCap") or 0.0)
            qtype = str(qt.get("quoteType") or "").upper().strip()
            name = str(qt.get("shortName") or qt.get("longName") or "").strip()
            sector = str(prof.get("sector") or "").strip()
            industry = str(prof.get("industry") or "").strip()

            is_etf = (qtype in NON_EQUITY_TYPES) or (qtype == "" and mcap <= 0.0)

            # Fallback to yfinance fast_info only when allowed, marketCap is missing, and not a known non-equity
            if allow_yfinance_fallback and mcap <= 0.0 and qtype not in NON_EQUITY_TYPES:
                try:
                    import yfinance as yf

                    t_yf = yf.Ticker(sym)
                    fi = getattr(t_yf, "fast_info", None)
                    yf_cap = float((fi.get("market_cap") if isinstance(fi, dict) else getattr(fi, "market_cap", 0)) or 0.0)
                    yf_qtype = str((fi.get("quote_type") if isinstance(fi, dict) else getattr(fi, "quote_type", "")) or "").upper().strip()
                    if yf_qtype in NON_EQUITY_TYPES:
                        is_etf = True
                    elif yf_cap > 0.0:
                        mcap = yf_cap
                        is_etf = False
                except Exception:
                    pass

            if mcap > 0.0 or is_etf:
                cache[sym] = {
                    "market_cap": float(mcap),
                    "is_etf": bool(is_etf and mcap <= 0.0 or qtype in NON_EQUITY_TYPES),
                    "name": name,
                    "sector": sector,
                    "industry": industry,
                    "ts": now_ts,
                }

    if to_fetch:
        _save_mcap_cache(cache)

    return {sym: cache[sym] for sym in clean_tickers if sym in cache}


def enforce_min_market_cap(
    candidates: List[Dict[str, Any]],
    min_mcap_usd: float = 2_000_000_000,
    ticker_key: str = "ticker",
) -> List[Dict[str, Any]]:
    """
    Strictly filters candidates to real equities (non-ETF/trust) with verified
    market cap >= min_mcap_usd, enriching name/sector/market_cap_b in place.
    """
    if not candidates:
        return []

    tickers = [str(item.get(ticker_key, "")).upper().strip() for item in candidates if item.get(ticker_key)]
    meta_map = fetch_and_cache_market_caps(tickers)
    any_verified = any(float(v.get("market_cap") or 0.0) > 0.0 for v in meta_map.values())
    min_mcap_b = min_mcap_usd / 1e9

    verified: List[Dict[str, Any]] = []
    for item in candidates:
        sym = str(item.get(ticker_key, "")).upper().strip()
        if not sym:
            continue

        info = meta_map.get(sym)
        if not any_verified:
            # Total network failure guard: allow only items with pre-verified market_cap_b >= floor
            pre_b = float(item.get("market_cap_b") or 0.0)
            if pre_b >= min_mcap_b:
                verified.append(item)
            continue

        if not info:
            continue
        if info.get("is_etf", False):
            continue

        mcap = float(info.get("market_cap") or 0.0)
        if mcap < min_mcap_usd:
            continue

        item["market_cap_usd"] = int(round(mcap))
        item["market_cap_b"] = round(mcap / 1e9, 1)

        if info.get("name") and (not item.get("name") or str(item.get("name")).upper() == sym):
            item["name"] = info["name"]
        if info.get("sector") and (not item.get("sector") or item.get("sector") in ("Technology", "Unknown", "")):
            item["sector"] = info["sector"]
        if info.get("industry") and (not item.get("industry") or item.get("industry") in ("Institutional Leaders", "Growth Leaders", "Unknown", "")):
            item["industry"] = info["industry"]

        verified.append(item)

    return verified
