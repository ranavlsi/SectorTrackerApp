"""
Expert Screeners Unified Backend Telemetry & Cross-Scanner Confluence Enricher
==============================================================================
Synchronizes sibling scanner JSON outputs into public/screener_results.json,
computes live OHLCV telemetry (price, 1D/5D/20D returns, 20D avg volume, dollar
volume, RVOL, EMA10/21/SMA50, 30D sparklines, risk/reward brackets) in a single
DuckDB Lakehouse query, attaches verified market caps & ETF flags in bulk, and
builds a cross-scanner confluence index (_ticker_telemetry & _confluence_leaders).
"""

import json
import math
import os
import time
from typing import Any, Dict, List
import duckdb
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "..", "public")
LAKEHOUSE_PATH = os.path.join(BASE_DIR, "data", "daily_ohlcv.parquet")
SCREENER_RESULTS_FILE = os.path.join(PUBLIC_DIR, "screener_results.json")

try:
    from market_cap_utils import fetch_and_cache_market_caps
except ImportError:
    from backend.market_cap_utils import fetch_and_cache_market_caps


def _sanitize_json(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _sanitize_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_json(v) for v in obj]
    if isinstance(obj, (float, np.floating)):
        val = float(obj)
        if math.isnan(val) or math.isinf(val):
            return 0.0
        return val
    if isinstance(obj, (int, np.integer)):
        return int(obj)
    if isinstance(obj, (bool, np.bool_)):
        return bool(obj)
    return obj


def _load_json(filename: str) -> Any:
    path = os.path.join(PUBLIC_DIR, filename)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return None


def _clean_tail(arr: np.ndarray, fallback: np.ndarray, tail_n: int) -> List[float]:
    sub = arr[-tail_n:]
    fb = fallback[-tail_n:]
    out = []
    for v, fv in zip(sub, fb):
        val = fv if (np.isnan(v) or np.isinf(v)) else v
        out.append(round(float(val), 2))
    return out


def _sync_sibling_scanners(screener_results: Dict[str, Any]) -> Dict[str, List[str]]:
    """
    Merges sibling scanner files into screener_results buckets and collects
    non-screener_results ticker lists (deepvue, clean_uptrend) for confluence.
    """
    extra_confluence_buckets: Dict[str, List[str]] = {}

    # 1. First MA Pullback
    fmp = _load_json("first_ma_pullback_results.json")
    if isinstance(fmp, dict) and isinstance(fmp.get("results"), list):
        items = []
        for s in fmp["results"]:
            tk = str(s.get("ticker", "")).upper().strip()
            if not tk:
                continue
            items.append({
                "ticker": tk,
                "metric": f"${s.get('close', 0)} | 1st Retest {s.get('ma_tested', 'MA')} (${s.get('ma_price', 0)}) | Impulse +{s.get('impulse_gain_pct', 0)}% | {s.get('volume_footprint', '')}",
                "score": float(s.get("score") or 82),
                "close": s.get("close"),
                "ma_tested": s.get("ma_tested"),
                "ma_price": s.get("ma_price"),
                "impulse_gain_pct": s.get("impulse_gain_pct"),
                "volume_footprint": s.get("volume_footprint"),
            })
        screener_results["first_ma_pullback"] = items

    # 2. Real Simple Framework (Ariel Hernandez)
    rsf = _load_json("realsimple_results.json")
    if isinstance(rsf, dict) and isinstance(rsf.get("stocks"), list):
        items = []
        for s in rsf["stocks"]:
            tk = str(s.get("ticker", "")).upper().strip()
            if not tk:
                continue
            rs_out = s.get("rs_outperformance_pct", 0)
            vdu = s.get("vdu_ratio", 0)
            stype = s.get("setup_type") or "3-Line Stack"
            items.append({
                "ticker": tk,
                "metric": f"${s.get('price', 0)} | {stype} | RS {rs_out:+}% vs SPY | VDU {vdu}x | Depth {s.get('base_depth_pct', 0)}%",
                "score": float(s.get("score") or 80),
                "price": s.get("price"),
                "ema9": s.get("ema9"),
                "ema21": s.get("ema21"),
                "sma50": s.get("sma50"),
                "rs_outperformance_pct": rs_out,
                "vdu_ratio": vdu,
                "setup_type": stype,
            })
        screener_results["realsimple_framework"] = items

    # 3. Best-Acting Stocks
    ba = _load_json("best_acting_stocks.json")
    if isinstance(ba, dict) and isinstance(ba.get("stocks"), list):
        items = []
        for s in ba["stocks"]:
            tk = str(s.get("ticker", "")).upper().strip()
            if not tk:
                continue
            badges = s.get("badges") or []
            badge_str = " ".join(badges[:2]) if isinstance(badges, list) else ""
            items.append({
                "ticker": tk,
                "metric": f"${s.get('price', 0)} | Score {s.get('score', 0)}/100 | ADX {s.get('adx', 0)} | 21-EMA {s.get('dist_ema21_pct', 0):+.1f}% | {badge_str}".strip(" |"),
                "score": float(s.get("score") or 80),
                "price": s.get("price"),
                "adx": s.get("adx"),
                "rs_outperformance_pct": s.get("rs_outperformance_pct"),
                "pct_from_52w_high": s.get("pct_from_52w_high"),
                "dist_ema21_pct": s.get("dist_ema21_pct"),
                "badges": badges,
            })
        screener_results["best_acting_stocks"] = items

    # 4. Emerging Leaders
    el = _load_json("emerging_leaders.json")
    if isinstance(el, dict) and isinstance(el.get("candidates"), list):
        items = []
        for c in el["candidates"]:
            tk = str(c.get("ticker", "")).upper().strip()
            if not tk:
                continue
            badges = c.get("badges") or []
            badge_str = " ".join(badges[:2]) if isinstance(badges, list) else ""
            items.append({
                "ticker": tk,
                "metric": f"${c.get('price', 0)} | {c.get('tier_label', 'Coiling')} ({c.get('score', 0)}/100) | Pivot ${c.get('entry_pivot', 0)} | Pinch {c.get('pinch_spread_pct', 0)}% {badge_str}".strip(),
                "score": float(c.get("score") or 78),
                "price": c.get("price"),
                "tier_label": c.get("tier_label"),
                "tier_color": c.get("tier_color"),
                "entry_pivot": c.get("entry_pivot"),
                "stop_loss": c.get("stop_loss"),
                "risk_pct": c.get("risk_pct"),
                "badges": badges,
            })
        screener_results["emerging_leaders"] = items

    # 5. Wick Supply Absorption
    wa = _load_json("wick_absorption_results.json")
    if isinstance(wa, dict) and isinstance(wa.get("results"), list):
        items = []
        for w in wa["results"]:
            tk = str(w.get("ticker", "")).upper().strip()
            if not tk:
                continue
            items.append({
                "ticker": tk,
                "metric": f"${w.get('close', 0)} | {w.get('tier_badge', 'Supply Absorption')} | Wick {w.get('wick_zone', '')} | VDU {w.get('vdu_pct', 0)}%",
                "score": float(w.get("score") or 80),
                "close": w.get("close"),
                "tier": w.get("tier"),
            })
        screener_results["wick_supply_absorption"] = items

    # 6. Clean Uptrend (preserve screener_results['clean_uptrend_9_13'] or use clean_uptrend_results.json for confluence)
    cu = _load_json("clean_uptrend_results.json")
    if isinstance(cu, dict) and isinstance(cu.get("stocks"), list):
        cu_tickers = [str(s.get("ticker", "")).upper().strip() for s in cu["stocks"] if s.get("ticker")]
        extra_confluence_buckets["clean_uptrend_9_13"] = cu_tickers

    # 7. DeepVue Leaders & Active VCP
    dv = _load_json("deepvue_results.json")
    if isinstance(dv, dict):
        if isinstance(dv.get("leaders"), list):
            extra_confluence_buckets["deepvue_leaders"] = [
                str(r.get("ticker", "")).upper().strip() for r in dv["leaders"] if r.get("ticker")
            ]
        if isinstance(dv.get("active_vcp"), list):
            extra_confluence_buckets["deepvue_vcp"] = [
                str(r.get("ticker", "")).upper().strip() for r in dv["active_vcp"] if r.get("ticker")
            ]

    return extra_confluence_buckets


def enrich_all_expert_screeners() -> Dict[str, Any]:
    """
    Runs full Lakehouse OHLCV + Market-Cap + Confluence enrichment on public/screener_results.json.
    """
    t0 = time.time()
    print("[Expert Screeners Enricher] Loading screener_results.json & sibling scanner outputs...")

    screener_results: Dict[str, Any] = _load_json("screener_results.json") or {}
    if not isinstance(screener_results, dict):
        screener_results = {}

    extra_buckets = _sync_sibling_scanners(screener_results)

    # Collect unique tickers and map each ticker -> sorted list of scanner keys where it fired
    ticker_scanners_map: Dict[str, set] = {}
    ticker_scores_map: Dict[str, List[float]] = {}
    ticker_metrics_map: Dict[str, List[Dict[str, str]]] = {}

    for key, val in screener_results.items():
        if key.startswith("_") or not isinstance(val, list):
            continue
        for item in val:
            if not isinstance(item, dict) or not item.get("ticker"):
                continue
            sym = str(item["ticker"]).upper().strip()
            if not sym:
                continue
            ticker_scanners_map.setdefault(sym, set()).add(key)
            if item.get("score") is not None:
                try:
                    sc = float(item["score"])
                    if sc > 0:
                        ticker_scores_map.setdefault(sym, []).append(sc)
                except Exception:
                    pass
            if item.get("metric"):
                ticker_metrics_map.setdefault(sym, []).append({"scanner": key, "metric": str(item["metric"])})

    for extra_key, t_list in extra_buckets.items():
        for sym in t_list:
            if sym:
                ticker_scanners_map.setdefault(sym, set()).add(extra_key)

    unique_tickers = sorted(ticker_scanners_map.keys())
    print(f"[Expert Screeners Enricher] Enriching {len(unique_tickers)} unique tickers across all scanners...")

    # Single DuckDB query for last 110 calendar days of OHLCV across all unique tickers
    ohlcv_telemetry: Dict[str, Dict[str, Any]] = {}
    if unique_tickers and os.path.exists(LAKEHOUSE_PATH):
        con = duckdb.connect()
        try:
            con.execute("CREATE TEMP TABLE _target_syms (Ticker VARCHAR)")
            con.executemany("INSERT INTO _target_syms VALUES (?)", [(t,) for t in unique_tickers])
            df_ohlcv = con.execute(f"""
                SELECT d.Ticker, d.Date, d.High, d.Low, d.Close, d.Volume
                FROM '{LAKEHOUSE_PATH}' d
                INNER JOIN _target_syms t ON d.Ticker = t.Ticker
                WHERE d.Date >= CURRENT_DATE - INTERVAL 110 DAY
                ORDER BY d.Ticker, d.Date ASC
            """).df()
        finally:
            con.close()

        for sym, grp in df_ohlcv.groupby("Ticker"):
            sym_u = str(sym).upper().strip()
            if len(grp) < 5:
                continue
            c = grp["Close"].astype(float).values
            h = grp["High"].astype(float).values
            l = grp["Low"].astype(float).values
            v = grp["Volume"].astype(float).values

            price = float(c[-1])
            if price <= 0 or math.isnan(price):
                continue

            prev_c = float(c[-2]) if len(c) >= 2 else price
            c5 = float(c[-6]) if len(c) >= 6 else float(c[0])
            c20 = float(c[-21]) if len(c) >= 21 else float(c[0])

            chg_1d = round(((price - prev_c) / prev_c) * 100.0, 2) if prev_c > 0 else 0.0
            ret_5d = round(((price - c5) / c5) * 100.0, 2) if c5 > 0 else 0.0
            ret_20d = round(((price - c20) / c20) * 100.0, 2) if c20 > 0 else 0.0

            s_vol = pd.Series(v)
            avg_vol_20 = float(s_vol.tail(20).mean())
            curr_vol = float(v[-1])
            dollar_vol_m = round((avg_vol_20 * price) / 1e6, 1)
            avg_vol_20_m = round(avg_vol_20 / 1e6, 2)
            rvol_20 = round(curr_vol / max(1.0, avg_vol_20), 2)

            s_c = pd.Series(c)
            ema10_arr = s_c.ewm(span=10, adjust=False).mean().values
            ema21_arr = s_c.ewm(span=21, adjust=False).mean().values
            sma50_arr = s_c.rolling(min(50, len(c))).mean().values

            ema10_now = round(float(ema10_arr[-1]), 2)
            ema21_now = round(float(ema21_arr[-1]), 2)
            sma50_val = float(sma50_arr[-1]) if not np.isnan(sma50_arr[-1]) else price
            sma50_now = round(sma50_val, 2)

            dist_ema21_pct = round(((price - ema21_now) / ema21_now) * 100.0, 1) if ema21_now > 0 else 0.0
            dist_sma50_pct = round(((price - sma50_now) / sma50_now) * 100.0, 1) if sma50_now > 0 else 0.0

            low_5d = float(np.min(l[-min(5, len(l)):]))
            raw_stop = min(low_5d * 0.99, ema21_now * 0.99)
            stop_loss = round(min(price * 0.96, max(price * 0.90, raw_stop)), 2)
            risk_per_share = max(0.05, price - stop_loss)
            risk_pct = round((risk_per_share / price) * 100.0, 2)
            target_1 = round(price + 2.0 * risk_per_share, 2)
            target_2 = round(price + 3.5 * risk_per_share, 2)

            tail_n = min(30, len(c))
            sparkline = {
                "close": _clean_tail(c, c, tail_n),
                "ema10": _clean_tail(ema10_arr, c, tail_n),
                "ema21": _clean_tail(ema21_arr, c, tail_n),
            }

            ohlcv_telemetry[sym_u] = {
                "price": round(price, 2),
                "change_pct": chg_1d,
                "return_5d_pct": ret_5d,
                "return_20d_pct": ret_20d,
                "avg_vol_20": int(round(avg_vol_20)),
                "avg_vol_20_m": avg_vol_20_m,
                "dollar_vol_m": dollar_vol_m,
                "rvol_20": rvol_20,
                "ema10": ema10_now,
                "ema21": ema21_now,
                "sma50": sma50_now,
                "dist_ema21_pct": dist_ema21_pct,
                "dist_sma50_pct": dist_sma50_pct,
                "sparkline": sparkline,
                "trade_plan": {
                    "entry": round(price, 2),
                    "stop_loss": stop_loss,
                    "risk_pct": risk_pct,
                    "target_1": target_1,
                    "target_2": target_2,
                },
            }

    # Bulk cached market-cap & equity type lookup (fast: allow_yfinance_fallback=False)
    mcap_map = fetch_and_cache_market_caps(unique_tickers, allow_yfinance_fallback=False) if unique_tickers else {}

    ticker_telemetry: Dict[str, Dict[str, Any]] = {}
    for sym in unique_tickers:
        tel = dict(ohlcv_telemetry.get(sym, {}))
        m_info = mcap_map.get(sym, {})
        raw_cap = float(m_info.get("market_cap") or 0.0)
        scanners_sorted = sorted(ticker_scanners_map.get(sym, set()))

        tel["market_cap_b"] = round(raw_cap / 1e9, 1) if raw_cap > 0 else 0.0
        tel["name"] = str(m_info.get("name") or sym)
        tel["sector"] = str(m_info.get("sector") or "")
        tel["is_etf"] = bool(m_info.get("is_etf", False))
        tel["scanner_keys"] = scanners_sorted
        tel["confluence_count"] = len(scanners_sorted)
        ticker_telemetry[sym] = tel

    # Attach compact enrichment fields onto every item inside each scanner bucket
    for key, val in screener_results.items():
        if key.startswith("_") or not isinstance(val, list):
            continue
        for item in val:
            if not isinstance(item, dict) or not item.get("ticker"):
                continue
            sym = str(item["ticker"]).upper().strip()
            t = ticker_telemetry.get(sym)
            if not t:
                continue
            item.setdefault("price", t.get("price"))
            if item.get("price") in (None, 0) and t.get("price"):
                item["price"] = t["price"]
            item["change_pct"] = t.get("change_pct", 0.0)
            if not item.get("market_cap_b") and t.get("market_cap_b"):
                item["market_cap_b"] = t["market_cap_b"]
            if item.get("avg_vol_20_m") is None and t.get("avg_vol_20_m") is not None:
                item["avg_vol_20_m"] = t["avg_vol_20_m"]
            if item.get("dollar_vol_m") is None and t.get("dollar_vol_m") is not None:
                item["dollar_vol_m"] = t["dollar_vol_m"]
            item["is_etf"] = t.get("is_etf", False)
            item["confluence_count"] = t.get("confluence_count", 1)
            if t.get("name") and (not item.get("name") or str(item.get("name")).upper() == sym):
                item["name"] = t["name"]
            if t.get("sector") and not item.get("sector"):
                item["sector"] = t["sector"]

    # Build top Cross-Scanner Confluence Leaders (equities >= $2B, avg vol >= 0.5M, >= 2 scanners)
    confluence_leaders = []
    for sym, t in ticker_telemetry.items():
        if t.get("is_etf", False):
            continue
        if t.get("confluence_count", 0) < 2:
            continue
        if float(t.get("market_cap_b") or 0.0) < 2.0 or float(t.get("avg_vol_20_m") or 0.0) < 0.5:
            continue
        scores = ticker_scores_map.get(sym, [])
        avg_score = round(float(np.mean(scores)), 1) if scores else min(95.0, round(68.0 + t["confluence_count"] * 4.5, 1))
        confluence_leaders.append({
            "ticker": sym,
            "name": t.get("name", sym),
            "sector": t.get("sector", ""),
            "price": t.get("price", 0.0),
            "change_pct": t.get("change_pct", 0.0),
            "return_20d_pct": t.get("return_20d_pct", 0.0),
            "market_cap_b": t.get("market_cap_b", 0.0),
            "avg_vol_20_m": t.get("avg_vol_20_m", 0.0),
            "dollar_vol_m": t.get("dollar_vol_m", 0.0),
            "rvol_20": t.get("rvol_20", 1.0),
            "score": avg_score,
            "confluence_count": t["confluence_count"],
            "scanner_keys": t["scanner_keys"],
            "sample_metrics": ticker_metrics_map.get(sym, [])[:3],
        })

    confluence_leaders.sort(
        key=lambda x: (x["confluence_count"], x["score"], x["dollar_vol_m"]),
        reverse=True,
    )
    confluence_leaders = confluence_leaders[:60]

    screener_results["_ticker_telemetry"] = ticker_telemetry
    screener_results["_confluence_leaders"] = confluence_leaders
    if not isinstance(screener_results.get("_metadata"), dict):
        screener_results["_metadata"] = {}
    screener_results["_metadata"]["enriched_at"] = pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")
    screener_results["_metadata"]["unique_enriched_tickers"] = len(ticker_telemetry)
    screener_results["_metadata"]["confluence_leaders_count"] = len(confluence_leaders)

    sanitized = _sanitize_json(screener_results)
    os.makedirs(os.path.dirname(SCREENER_RESULTS_FILE), exist_ok=True)
    with open(SCREENER_RESULTS_FILE, "w") as f:
        json.dump(sanitized, f, indent=2, allow_nan=False)

    size_mb = round(os.path.getsize(SCREENER_RESULTS_FILE) / (1024 * 1024), 2)
    print(
        f"✅ [Expert Screeners Enricher] Done in {time.time()-t0:.2f}s! "
        f"Enriched {len(ticker_telemetry)} unique tickers, {len(confluence_leaders)} Confluence Leaders "
        f"({size_mb} MB saved to {SCREENER_RESULTS_FILE})."
    )
    return sanitized


if __name__ == "__main__":
    enrich_all_expert_screeners()
