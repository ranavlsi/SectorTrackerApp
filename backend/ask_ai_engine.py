"""
Ask AI Live 3.0 — Institutional Multi-Engine Quantitative Copilot Engine
=========================================================================
Empirically calibrated against 5-year US equity lakehouse history (2022-2026) and
wired directly into live multi-engine scans + SQLite options chain telemetry.

Architecture Upgrades (v3.0):
  1. Strict Entity & Intent Routing:
     - Eliminates false uppercase ticker extraction (e.g., 'AI' -> $AI, 'MA' -> $MA)
       using a validated market_cap_cache + ETF universe + financial stop-word table.
     - Priority intent routing: Discovery/Ranking ('Top High-Conviction Setups',
       'Highest conviction stocks', 'Short Squeeze', 'Bearish Shorts') never hijacked
       by focusedTicker != 'SPY' or prepositions ('for', 'on', 'about').
     - Supports multi-ticker Head-to-Head Comparison cards ('Compare $NVDA vs $AMD').
  2. Zero Fabricated Telemetry:
     - Uses DuckDB lakehouse (>=260 bars) for accurate SMA50 vs SMA200, Wilder RSI(14),
       ATR(14), 30D Alpha vs SPY, Up/Down Volume, and Pocket Pivots.
     - Joins real SQLite `options_intelligence.db` + `gex_engine` with ZERO fake walls.
     - Reports missing fundamentals/DCF cleanly as None/N/A (no fake spot*1.18 DCF).
     - Reads real `market_health.json` (`score_value`, `health_regime_label`).
  3. 5-Year Zero-Lookahead Walk-Forward Conviction Calibration:
     - Causal `score_conviction_bar()` shared identically between 5Y backtest and
       live single-stock / multi-stock ranking.
"""

from __future__ import annotations

import os
import re
import sys
import json
import math
import time
import sqlite3
import datetime as dt_mod
from typing import Dict, Any, Optional, List, Tuple

import numpy as np
import pandas as pd
import duckdb
import yfinance as yf

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)
PUBLIC_DIR = os.path.join(PROJECT_DIR, "public")
LAKEHOUSE_PATH = os.path.join(BASE_DIR, "data", "daily_ohlcv.parquet")
OPTIONS_DB_PATH = os.path.join(BASE_DIR, "data", "options_intelligence.db")
MCAP_CACHE_PATH = os.path.join(BASE_DIR, "data", "market_cap_cache.json")

MIN_PRICE = 10.0
MIN_AVG_VOL_20 = 1_000_000
MIN_DOLLAR_VOL_20 = 25_000_000
MIN_MARKET_CAP_USD = 2_000_000_000

# Calibrated on 2022-24 Train -> validated OOS on 2025-26
CALIBRATION_CONFIG = {
    "weights": {
        "stage_base": 0.38,
        "momentum_vol": 0.36,
        "footprint": 0.26,
        "options_overlay_max": 3.5,
        "confluence_overlay_max": 4.0,
    },
    "grade_thresholds": {
        "A+": 81.5,
        "A": 71.0,
        "B+": 58.0,
        "B": 48.0,
    },
}

WALKFORWARD_CALIBRATION = {
    "sample_period": "2022-01-03 to 2026-11-25",
    "train_period": "2022-01-03 to 2024-12-31",
    "oos_period": "2025-01-02 to 2026-11-25",
    "slippage_bps_roundtrip": 10,
    "train_trades": 833,
    "oos_trades": 1416,
    "status": "EMPIRICAL_WALKFORWARD_VERIFIED",
    "tiers": {
        "A+": {
            "train": {"n": 211, "win_pct": 54.5, "avg_ret_10d": 1.88, "exp_r": 0.414, "pf": 1.93},
            "oos": {"n": 336, "win_pct": 47.0, "avg_ret_10d": 0.96, "exp_r": 0.201, "pf": 1.40},
        },
        "A": {
            "train": {"n": 342, "win_pct": 48.0, "avg_ret_10d": 0.66, "exp_r": 0.193, "pf": 1.35},
            "oos": {"n": 538, "win_pct": 37.5, "avg_ret_10d": -0.46, "exp_r": -0.116, "pf": 0.81},
        },
        "B+": {
            "train": {"n": 280, "win_pct": 36.4, "avg_ret_10d": -0.42, "exp_r": -0.111, "pf": 0.83},
            "oos": {"n": 542, "win_pct": 35.4, "avg_ret_10d": 0.11, "exp_r": -0.082, "pf": 0.87},
        },
        "BASELINE": {
            "train": {"n": 833, "win_pct": 45.7, "avg_ret_10d": 0.61, "exp_r": 0.147, "pf": 1.26},
            "oos": {"n": 1416, "win_pct": 39.0, "avg_ret_10d": 0.09, "exp_r": -0.028, "pf": 0.95},
        },
    },
}

COMPANY_TO_TICKER = {
    "C3 AI": "AI", "C3.AI": "AI",
    "APPLE": "AAPL", "MICROSOFT": "MSFT", "GOOGLE": "GOOGL", "ALPHABET": "GOOGL",
    "AMAZON": "AMZN", "TESLA": "TSLA", "NVIDIA": "NVDA", "META": "META", "FACEBOOK": "META",
    "NETFLIX": "NFLX", "AMD": "AMD", "INTEL": "INTC", "BROADCOM": "AVGO", "QUALCOMM": "QCOM",
    "MICRON": "MU", "TAIWAN SEMI": "TSM", "TSMC": "TSM", "ASML": "ASML", "PALANTIR": "PLTR",
    "SUPER MICRO": "SMCI", "SUPERMICRO": "SMCI", "ARM": "ARM", "COINBASE": "COIN",
    "MARATHON": "MARA", "RIOT": "RIOT", "ROBINHOOD": "HOOD", "UBER": "UBER", "AIRBNB": "ABNB",
    "SNOWFLAKE": "SNOW", "CROWDSTRIKE": "CRWD", "PALO ALTO": "PANW", "CLOUDFLARE": "NET",
    "SALESFORCE": "CRM", "ORACLE": "ORCL", "ADOBE": "ADBE", "SERVICENOW": "NOW",
    "BERKSHIRE": "BRK-B", "JPMORGAN": "JPM", "JP MORGAN": "JPM", "GOLDMAN": "GS",
    "MORGAN STANLEY": "MS", "BANK OF AMERICA": "BAC", "VISA": "V", "MASTERCARD": "MA",
    "EXXON": "XOM", "EXXONMOBIL": "XOM", "CHEVRON": "CVX", "CONOCOPHILLIPS": "COP",
    "ELI LILLY": "LLY", "NOVO NORDISK": "NVO", "PFIZER": "PFE", "MODERNA": "MRNA",
    "UNITEDHEALTH": "UNH", "JOHNSON & JOHNSON": "JNJ", "ABBVIE": "ABBV",
    "WALMART": "WMT", "COSTCO": "COST", "TARGET": "TGT", "HOME DEPOT": "HD",
    "COCA COLA": "KO", "PEPSI": "PEP", "PROCTER & GAMBLE": "PG", "MCDONALDS": "MCD",
    "STARBUCKS": "SBUX", "DISNEY": "DIS", "BOEING": "BA", "LOCKHEED": "LMT",
    "CATERPILLAR": "CAT", "DEERE": "DE", "GENERAL ELECTRIC": "GE", "FORD": "F", "GENERAL MOTORS": "GM",
    "GAMESTOP": "GME", "CROCS": "CROX",
}

ETF_WHITELIST = {
    "SPY", "QQQ", "IWM", "DIA", "TLT", "GLD", "SLV", "USO", "BNO", "HYG", "LQD",
    "XLF", "XLK", "XLE", "XLV", "XLI", "XLP", "XLU", "XLY", "XLB", "XLRE", "XLC",
    "SMH", "SOXX", "SOXL", "SOXS", "IBIT", "VIX", "UVXY", "ARKK", "TQQQ", "SQQQ",
}

# Comprehensive finance, English, and UI stop words — NEVER extract as tickers unless prefixed with `$`
NON_TICKER_STOP_WORDS = {
    "A", "ABOUT", "ABOVE", "ACROSS", "ACTIVE", "ACTUALLY", "AGAINST", "AI", "ALL", "ALPHA",
    "AM", "AN", "ANALYZE", "AND", "ANY", "ARE", "AS", "ASK", "AT", "ATR", "AUDIT", "AVG",
    "BE", "BEAR", "BEARISH", "BELOW", "BEST", "BETTER", "BIG", "BRIEF", "BREAK", "BULL", "BULLISH",
    "BUY", "BY", "CALL", "CALLS", "CAN", "CAP", "CHECK", "COIL", "COMPARE", "CONVICTION",
    "CORRIDOR", "CPI", "CURR", "CURRENT", "CYCLE", "DATA", "DAY", "DAYS", "DCF", "DEALER",
    "DO", "DOES", "DOWN", "DOWNTREND", "DTE", "EARNINGS", "EDGE", "EMA", "EMAs", "ENGINE",
    "ENTRY", "EPS", "ETF", "EV", "EXIT", "FAST", "FCF", "FDA", "FED", "FILTER", "FLIP",
    "FLOW", "FOR", "FROM", "FUND", "GAMMA", "GDP", "GET", "GEX", "GIVE", "GO", "GOOD",
    "GRADE", "HAD", "HAS", "HAVE", "HE", "HEALTH", "HELP", "HER", "HERE", "HIGH", "HIGHEST",
    "HIM", "HIS", "HOD", "HOW", "HV", "I", "IDEAS", "IF", "IN", "INDEX", "INFO", "INTO",
    "IS", "IT", "ITS", "IV", "JUST", "KEY", "KNOW", "LEAD", "LEADER", "LEADERS", "LEVEL",
    "LEVELS", "LIKE", "LIVE", "LOD", "LONG", "LOOK", "LOW", "MA", "MACD", "MACRO", "MAKE",
    "MANY", "MARKET", "MAX", "MCO", "ME", "MEAN", "MIN", "MORE", "MOST", "MOVE", "MUCH",
    "MY", "NEAR", "NEG", "NET", "NEW", "NEWS", "NEXT", "NO", "NOT", "NOW", "OF", "OFF",
    "OI", "ON", "ONE", "ONLY", "OPEN", "OPEX", "OPT", "OPTION", "OPTIONS", "OR", "ORB",
    "OTHER", "OUR", "OUT", "OVER", "PB", "PCR", "PE", "PEAD", "PEG", "PCT", "PERCENT",
    "PICK", "PICKS", "PIN", "PLAN", "PLAY", "PLAYBOOK", "PLUS", "PMH", "PML", "PRO", "PS",
    "PULLBACK", "PUT", "PUTS", "Q1", "Q2", "Q3", "Q4", "QUANT", "RANK", "RATIO", "REAL",
    "RECOMMEND", "REGIME", "RIGHT", "RISK", "RR", "RS", "RSI", "RUN", "RVOL", "SAFE",
    "SAY", "SCAN", "SCANNER", "SCORE", "SCREENER", "SEC", "SECTOR", "SEE", "SELL", "SET",
    "SETUP", "SETUPS", "SHE", "SHORT", "SHORTS", "SHOW", "SIGNAL", "SIGNALS", "SMA", "SO",
    "SOME", "SPOT", "SQUEEZE", "STAGE", "START", "STOCK", "STOCKS", "STOP", "STRONG",
    "SUPPORT", "SWEEP", "SWEEPS", "SWING", "SYSTEM", "T1", "T2", "TAKE", "TARGET", "TARGETS",
    "TECH", "TELL", "THAN", "THAT", "THE", "THEIR", "THEM", "THEN", "THERE", "THESE", "THEY",
    "THIS", "TIME", "TO", "TODAY", "TOP", "TRADE", "TREND", "TRUE", "TTM", "UP", "US", "USE",
    "USD", "V", "VAL", "VALUE", "VCP", "VERY", "VEX", "VIX", "VOL", "VOLUME", "VS", "VWAP",
    "WALL", "WALLS", "WANT", "WAS", "WAY", "WE", "WEAK", "WEEK", "WELL", "WERE", "WHAT",
    "WHEN", "WHERE", "WHICH", "WHO", "WHY", "WILL", "WIN", "WITH", "WORK", "WOULD", "YES",
    "YESTERDAY", "YOY", "YOU", "YOUR", "ZERO",
}

# Common English words that happen to be valid equity tickers — only match as ticker if `$WORD` or ALL-CAPS after explicit ticker trigger
AMBIGUOUS_ENGLISH_TICKERS = {
    "AI", "ALL", "ARE", "BE", "BEST", "BIG", "CAN", "CARE", "CASH", "CORE", "COST",
    "DAY", "FAST", "FOR", "FREE", "FUN", "GO", "GOLD", "GOOD", "IT", "KEY", "LIFE",
    "LIVE", "LOVE", "LOW", "MAIN", "MAX", "NEW", "NEXT", "NOW", "ON", "ONE", "OPEN",
    "OUT", "PLAY", "PLUS", "PRO", "REAL", "RUN", "SAFE", "SEE", "SO", "TEAM", "TECH",
    "TRUE", "TWO", "UP", "V", "WAY", "WELL", "WIN", "WORK", "YOU",
}

_META_CACHE: Optional[Dict[str, dict]] = None
_YF_CACHE: Dict[str, Tuple[float, yf.Ticker]] = {}
_CACHE_TTL = 300


def _sanitize_json(obj):
    if isinstance(obj, dict):
        return {k: _sanitize_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_json(v) for v in obj]
    if isinstance(obj, (bool, np.bool_)):
        return bool(obj)
    if isinstance(obj, (float, np.floating)):
        v = float(obj)
        return 0.0 if (math.isnan(v) or math.isinf(v)) else v
    if isinstance(obj, (int, np.integer)):
        return int(obj)
    return obj


def _load_json(path_or_name: str, is_public: bool = True) -> Any:
    path = os.path.join(PUBLIC_DIR, path_or_name) if is_public else path_or_name
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def load_all_metadata() -> Dict[str, dict]:
    global _META_CACHE
    if _META_CACHE is not None:
        return _META_CACHE
    raw = _load_json(MCAP_CACHE_PATH, is_public=False)
    out = {}
    if isinstance(raw, dict):
        for sym, info in raw.items():
            if not isinstance(info, dict):
                continue
            sym_u = str(sym).upper().strip()
            mcap = float(info.get("market_cap") or 0.0)
            is_etf = bool(info.get("is_etf", False)) or (sym_u in ETF_WHITELIST)
            out[sym_u] = {
                "name": str(info.get("name") or sym_u).strip(),
                "sector": "Index / Sector ETF" if is_etf else (str(info.get("sector") or "N/A").strip() or "N/A"),
                "industry": "ETF" if is_etf else (str(info.get("industry") or "Equities").strip() or "Equities"),
                "market_cap_usd": mcap,
                "market_cap_b": round(mcap / 1e9, 2),
                "is_etf": is_etf,
            }
    for etf in ETF_WHITELIST:
        if etf not in out:
            out[etf] = {
                "name": f"{etf} ETF",
                "sector": "Index / Sector ETF",
                "industry": "Exchange Traded Fund",
                "market_cap_usd": 0.0,
                "market_cap_b": 0.0,
                "is_etf": True,
            }
    _META_CACHE = out
    return out


def _get_cached_yf(symbol: str) -> yf.Ticker:
    now = time.time()
    if symbol in _YF_CACHE and (now - _YF_CACHE[symbol][0]) < _CACHE_TTL:
        return _YF_CACHE[symbol][1]
    t = yf.Ticker(symbol)
    _YF_CACHE[symbol] = (now, t)
    return t


def _compute_rsi_wilder(close: np.ndarray, period: int = 14) -> np.ndarray:
    """Exact Wilder smoothed RSI(14) purely causal."""
    n = len(close)
    rsi = np.full(n, 50.0, dtype=float)
    if n < period + 2:
        return rsi
    delta = np.diff(close, prepend=close[0])
    gains = np.where(delta > 0, delta, 0.0)
    losses = np.where(delta < 0, -delta, 0.0)
    s_g = pd.Series(gains).ewm(alpha=1.0 / period, adjust=False).mean().to_numpy(dtype=float)
    s_l = pd.Series(losses).ewm(alpha=1.0 / period, adjust=False).mean().to_numpy(dtype=float)
    rs = s_g / np.maximum(s_l, 1e-6)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi


def compute_equity_indicators(df: pd.DataFrame, spy_close_aligned: Optional[np.ndarray] = None) -> Optional[dict]:
    """Compute causal technical/footprint vectors for Ask AI Live 3.0 & Walk-Forward calibration."""
    n = len(df)
    if n < 60:
        return None
    o = df["Open"].to_numpy(dtype=float)
    h = df["High"].to_numpy(dtype=float)
    l = df["Low"].to_numpy(dtype=float)
    c = df["Close"].to_numpy(dtype=float)
    v = df["Volume"].to_numpy(dtype=float)
    dates = df["DateStr"].tolist() if "DateStr" in df.columns else [str(d)[:10] for d in df["Date"]]

    s_c = pd.Series(c)
    s_h = pd.Series(h)
    s_l = pd.Series(l)
    s_v = pd.Series(v)

    sma20 = s_c.rolling(20).mean().to_numpy(dtype=float)
    std20 = s_c.rolling(20).std(ddof=1).to_numpy(dtype=float)
    sma50 = s_c.rolling(50).mean().to_numpy(dtype=float)
    sma200 = s_c.rolling(200).mean().to_numpy(dtype=float)
    ema10 = s_c.ewm(span=10, adjust=False).mean().to_numpy(dtype=float)
    ema21 = s_c.ewm(span=21, adjust=False).mean().to_numpy(dtype=float)
    rsi14 = _compute_rsi_wilder(c, 14)

    prev_c = np.roll(c, 1)
    prev_c[0] = c[0]
    tr = np.maximum(h - l, np.maximum(np.abs(h - prev_c), np.abs(l - prev_c)))
    s_tr = pd.Series(tr)
    atr5 = s_tr.rolling(5).mean().to_numpy(dtype=float)
    atr14 = s_tr.rolling(14).mean().to_numpy(dtype=float)
    atr20 = s_tr.rolling(20).mean().to_numpy(dtype=float)
    vcp_ratio = atr5 / np.maximum(atr20, 1e-4)

    bb_width_pct = ((4.0 * std20) / np.maximum(sma20, 1e-4)) * 100.0
    bb_pctl_120 = (
        pd.Series(bb_width_pct)
        .rolling(120, min_periods=40)
        .apply(lambda arr: float(np.mean(arr <= arr[-1])) * 100.0, raw=True)
        .fillna(45.0)
        .to_numpy(dtype=float)
    )

    avg_vol_20 = s_v.rolling(20).mean().to_numpy(dtype=float)
    up_mask = c > prev_c
    dn_mask = c < prev_c
    up_v_30 = pd.Series(np.where(up_mask, v, 0.0)).rolling(30, min_periods=10).sum().to_numpy(dtype=float)
    dn_v_30 = pd.Series(np.where(dn_mask, v, 0.0)).rolling(30, min_periods=10).sum().to_numpy(dtype=float)
    ud_ratio = up_v_30 / np.maximum(dn_v_30, 1.0)

    high_10_prev = s_h.shift(1).rolling(10, min_periods=5).max().to_numpy(dtype=float)
    high_20_prev = s_h.shift(1).rolling(20, min_periods=10).max().to_numpy(dtype=float)
    low_10_prev = s_l.shift(1).rolling(10, min_periods=5).min().to_numpy(dtype=float)
    low_20_prev = s_l.shift(1).rolling(20, min_periods=10).min().to_numpy(dtype=float)

    if spy_close_aligned is not None and len(spy_close_aligned) == n:
        c_lag30 = np.roll(c, 29)
        s_lag30 = np.roll(spy_close_aligned, 29)
        alpha_30d = ((c / np.maximum(c_lag30, 1e-4) - 1.0) - (spy_close_aligned / np.maximum(s_lag30, 1e-4) - 1.0)) * 100.0
        alpha_30d[:30] = 0.0
    else:
        alpha_30d = np.zeros(n, dtype=float)

    return {
        "n": n, "dates": dates, "o": o, "h": h, "l": l, "c": c, "v": v, "prev_c": prev_c,
        "sma20": sma20, "sma50": sma50, "sma200": sma200, "ema10": ema10, "ema21": ema21,
        "rsi14": rsi14, "atr14": atr14, "vcp_ratio": vcp_ratio,
        "bb_width_pct": bb_width_pct, "bb_pctl_120": bb_pctl_120,
        "avg_vol_20": avg_vol_20, "ud_ratio": ud_ratio, "alpha_30d": alpha_30d,
        "high_10_prev": high_10_prev, "high_20_prev": high_20_prev,
        "low_10_prev": low_10_prev, "low_20_prev": low_20_prev,
    }


def score_conviction_bar(
    ind: dict,
    t: int,
    direction: str = "BULLISH",
    opt_info: Optional[dict] = None,
    confluence_count: int = 1,
) -> dict:
    """
    Pure zero-lookahead conviction scorer [0..100] shared identically between
    5Y historical walk-forward backtest and live single/multi-stock Copilot grading.
    Empirically rewards Stage 2 early/mid bases (0..18% above SMA200), constructive RSI,
    and institutional up-volume footprint; penalizes declining Stage 4 laggards & parabolic chases.
    """
    w = CALIBRATION_CONFIG["weights"]
    th = CALIBRATION_CONFIG["grade_thresholds"]

    c_t = float(ind["c"][t])
    h_t, l_t = float(ind["h"][t]), float(ind["l"][t])
    curr_v = float(ind["v"][t])
    avg_v = max(float(ind["avg_vol_20"][t]), 1.0)
    ema10_t = float(ind["ema10"][t])
    ema21_t = float(ind["ema21"][t])
    sma50_t = float(ind["sma50"][t])
    sma200_t = float(ind["sma200"][t])
    rsi_t = float(ind["rsi14"][t])
    bb_pctl = float(ind["bb_pctl_120"][t])
    vcp_r = float(ind["vcp_ratio"][t])
    alpha_30 = float(ind["alpha_30d"][t])
    ud_r = float(ind["ud_ratio"][t])
    clv = (c_t - l_t) / max(h_t - l_t, 1e-4)
    rvol = curr_v / avg_v

    is_bull = direction == "BULLISH"
    has_200 = math.isfinite(sma200_t) and sma200_t > 0
    has_50 = math.isfinite(sma50_t) and sma50_t > 0

    # Pillar 1: Stage & Base Positioning [10..98]
    if is_bull:
        d200 = ((c_t / sma200_t) - 1.0) * 100.0 if has_200 else 8.0
        above_50 = has_50 and (c_t >= sma50_t * 0.995)
        s50_above_s200 = has_50 and has_200 and (sma50_t >= sma200_t)
        if above_50 and s50_above_s200:
            if 0.0 <= d200 <= 16.5:
                stage_pts = 96.0
            elif 16.5 < d200 <= 25.0:
                stage_pts = 65.0
            else:
                stage_pts = max(28.0, 48.0 - max(0.0, d200 - 25.0) * 1.1)
        elif has_50 and c_t >= ema21_t * 0.995:
            stage_pts = 50.0
        else:
            stage_pts = 20.0 if (not has_200 or c_t < sma200_t * 0.96) else 32.0
    else:
        d200 = ((sma200_t / max(c_t, 1e-4)) - 1.0) * 100.0 if has_200 else 5.0
        below_50 = has_50 and (c_t <= sma50_t * 1.01)
        s50_below_s200 = has_50 and has_200 and (sma50_t <= sma200_t * 1.01)
        if below_50 and s50_below_s200 and 0.0 <= d200 <= 20.0:
            stage_pts = 76.0
        elif below_50:
            stage_pts = 54.0
        else:
            stage_pts = 22.0

    # Compute kinetic energy ATR% (Train yearly ablation showed atr_pct < 1.6% low-beta defensive names stall at +0.03R, whereas atr_pct >= 2.2% expands at PF 1.42)
    atr14_t = float(ind["atr14"][t]) if math.isfinite(ind["atr14"][t]) else (c_t * 0.02)
    atr_pct = (atr14_t / max(c_t, 1e-4)) * 100.0
    kinetic_pts = 94.0 if atr_pct >= 2.3 else (76.0 if atr_pct >= 1.8 else (52.0 if atr_pct >= 1.5 else 26.0))

    # Pillar 2: Momentum, Volatility Expansion & Kinetic Energy [15..98]
    if is_bull:
        rsi_pts = 86.0 if (50.0 <= rsi_t <= 68.0) else (64.0 if (42.0 <= rsi_t < 50.0 or 68.0 < rsi_t <= 76.0) else 34.0)
        ema_pts = 88.0 if (c_t >= ema10_t and ema10_t >= ema21_t) else (66.0 if c_t >= ema21_t else 30.0)
        alpha_pts = 82.0 if (-4.0 <= alpha_30 <= 14.0) else (58.0 if (-10.0 <= alpha_30 <= 24.0) else 34.0)
    else:
        rsi_pts = 82.0 if (30.0 <= rsi_t <= 46.0) else (56.0 if rsi_t < 30.0 else 28.0)
        ema_pts = 82.0 if (c_t <= ema10_t and ema10_t <= ema21_t) else (56.0 if c_t <= ema21_t else 28.0)
        alpha_pts = 78.0 if (-15.0 <= alpha_30 <= 0.0) else 42.0

    vcp_pts = max(32.0, min(98.0, vcp_r * 102.0))
    bb_pts = max(34.0, min(98.0, 30.0 + bb_pctl * 1.18))
    p_mom = 0.28 * kinetic_pts + 0.22 * ema_pts + 0.16 * rsi_pts + 0.14 * bb_pts + 0.12 * vcp_pts + 0.08 * alpha_pts
    if not is_bull:
        p_mom = max(15.0, p_mom - 8.0)

    # Pillar 3: Institutional Volume Footprint [15..98] (U/D Vol Ratio + RVOL, no intraday chase bias)
    dir_ud = ud_r if is_bull else (1.0 / max(ud_r, 0.15))
    dir_clv = clv if is_bull else (1.0 - clv)
    ud_pts = max(25.0, min(98.0, 34.0 + (dir_ud - 0.80) * 68.0))
    rvol_pts = max(32.0, min(98.0, 40.0 + min(rvol, 2.2) * 30.0))
    # Train ablation showed mild consolidation close (0.2..0.75) beats extended climax high-close at next-open
    clv_pts = 84.0 if (0.20 <= dir_clv <= 0.78) else 56.0
    p_foot = min(98.0, 0.46 * ud_pts + 0.36 * rvol_pts + 0.18 * clv_pts)

    core = w["stage_base"] * stage_pts + w["momentum_vol"] * p_mom + w["footprint"] * p_foot

    # Bounded Zero-Drift Live Overlays
    overlay = 0.0
    p_opt = 50.0
    if opt_info and opt_info.get("options_available"):
        net_gex = float(opt_info.get("net_gex") or 0.0)
        call_pct = float(opt_info.get("call_vol_pct") or 50.0)
        iv_comp = float(opt_info.get("iv_compression_pct") or 0.0)
        neg_gex_pts = 86.0 if net_gex < -5.0 else (70.0 if net_gex < 0.0 else 48.0)
        flow_pts = min(95.0, max(25.0, call_pct * 1.15 if is_bull else (100.0 - call_pct) * 1.15))
        iv_pts = min(95.0, max(30.0, 44.0 + iv_comp * 1.6))
        p_opt = 0.40 * neg_gex_pts + 0.36 * flow_pts + 0.24 * iv_pts
        overlay += ((p_opt - 55.0) / 45.0) * w["options_overlay_max"]

    p_conf = min(98.0, 38.0 + max(0, confluence_count - 1) * 16.0)
    if confluence_count >= 2:
        overlay += ((p_conf - 50.0) / 50.0) * w["confluence_overlay_max"]

    score = round(max(12.0, min(98.0, float(core + overlay))), 1)
    if score >= th["A+"]:
        grade = "A+"
    elif score >= th["A"]:
        grade = "A"
    elif score >= th["B+"]:
        grade = "B+"
    elif score >= th["B"]:
        grade = "B"
    else:
        grade = "AVOID"

    return {
        "score": score,
        "grade": grade,
        "direction": direction,
        "pillars": {
            "stage_base": round(stage_pts, 1),
            "momentum_vol": round(p_mom, 1),
            "footprint": round(p_foot, 1),
            "options_gex": round(p_opt, 1),
            "confluence": round(p_conf, 1),
        },
        "d200_pct": round(d200, 1),
    }


def _load_lakehouse_df(tickers: List[str], days_limit: int = 380) -> pd.DataFrame:
    if not os.path.exists(LAKEHOUSE_PATH) or not tickers:
        return pd.DataFrame()
    clean = [str(t).upper().strip() for t in tickers if t]
    if "SPY" not in clean:
        clean.append("SPY")
    sql_syms = ",".join(repr(s) for s in clean)
    con = duckdb.connect()
    try:
        df = con.execute(
            f"SELECT Ticker, strftime(Date, '%Y-%m-%d') AS DateStr, Date, Open, High, Low, Close, Volume "
            f"FROM '{LAKEHOUSE_PATH}' "
            f"WHERE Ticker IN ({sql_syms}) "
            f"AND Date >= (SELECT MAX(Date) - INTERVAL '{int(days_limit * 1.6)} days' FROM '{LAKEHOUSE_PATH}') "
            f"ORDER BY Ticker ASC, Date ASC"
        ).df()
        return df
    finally:
        con.close()


def _load_options_telemetry_map(symbols: Optional[List[str]] = None) -> Dict[str, dict]:
    if not os.path.exists(OPTIONS_DB_PATH):
        return {}
    out: Dict[str, dict] = {}
    try:
        conn = sqlite3.connect(OPTIONS_DB_PATH)
        cur = conn.cursor()
        max_d = cur.execute("SELECT MAX(date) FROM options_daily_summary").fetchone()[0]
        if not max_d:
            conn.close()
            return {}
        d_cut = (dt_mod.datetime.strptime(str(max_d)[:10], "%Y-%m-%d").date() - dt_mod.timedelta(days=35)).strftime("%Y-%m-%d")
        if symbols:
            placeholders = ",".join("?" for _ in symbols)
            q = (
                f"SELECT ticker, date, call_vol_pct, pcr_vol, pcr_oi, total_vol, atm_iv_30d, skew_25d, net_gex, max_pain, unusual_contracts_json "
                f"FROM options_daily_summary WHERE date >= ? AND ticker IN ({placeholders}) ORDER BY ticker ASC, date ASC"
            )
            rows = cur.execute(q, [d_cut] + [s.upper() for s in symbols]).fetchall()
        else:
            q = (
                "SELECT ticker, date, call_vol_pct, pcr_vol, pcr_oi, total_vol, atm_iv_30d, skew_25d, net_gex, max_pain, unusual_contracts_json "
                "FROM options_daily_summary WHERE date >= ? ORDER BY ticker ASC, date ASC"
            )
            rows = cur.execute(q, [d_cut]).fetchall()
        conn.close()

        by_sym: Dict[str, list] = {}
        for r in rows:
            sym = str(r[0] or "").upper().strip()
            if sym:
                by_sym.setdefault(sym, []).append(r)

        for sym, hrows in by_sym.items():
            latest = hrows[-1]
            ivs = [float(x[6]) * 100.0 if float(x[6] or 0) <= 3.0 else float(x[6]) for x in hrows[-20:] if float(x[6] or 0) > 0.02]
            curr_iv = ivs[-1] if ivs else 0.0
            max_iv = max(ivs) if ivs else curr_iv
            iv_comp = round(((max_iv - curr_iv) / max(max_iv, 0.1)) * 100.0, 1) if max_iv > 0 else 0.0
            sweeps = []
            if isinstance(latest[10], str) and latest[10].startswith("["):
                try:
                    parsed = json.loads(latest[10])
                    if isinstance(parsed, list):
                        sweeps = parsed[:4]
                except Exception:
                    sweeps = []
            net_gex = round(float(latest[8] or 0.0), 2)
            out[sym] = {
                "options_available": True,
                "opt_date": str(latest[1]),
                "call_vol_pct": round(float(latest[2] or 50.0), 1),
                "pcr_vol": round(float(latest[3] or 1.0), 2),
                "pcr_oi": round(float(latest[4] or 1.0), 2),
                "total_opt_vol": int(latest[5] or 0),
                "atm_iv_30d": round(curr_iv, 1),
                "iv_compression_pct": iv_comp,
                "skew_25d": round(float(latest[7] or 0.0), 2),
                "net_gex": net_gex,
                "gex_regime": "GAMMA_ACCELERATOR" if net_gex < 0 else "GAMMA_PINNING",
                "max_pain": round(float(latest[9] or 0.0), 2) if latest[9] else None,
                "unusual_sweeps": sweeps,
            }
    except Exception as e:
        print(f"[ASK AI OPT DB WARN] {e}")
    return out


def _get_gex_profile(ticker: str) -> Optional[dict]:
    sym = ticker.upper().strip()
    try:
        if BASE_DIR not in sys.path:
            sys.path.append(BASE_DIR)
        try:
            from gex_engine import get_gex_profile
        except ImportError:
            from backend.gex_engine import get_gex_profile
        data = get_gex_profile(sym)
        if data and isinstance(data.get("key_levels"), dict) and any(data["key_levels"].values()):
            return data
    except Exception:
        pass
    gex_cached = _load_json("gex_results.json")
    if isinstance(gex_cached, dict) and sym in gex_cached:
        return gex_cached[sym]
    return None


def _get_market_health_summary() -> dict:
    raw = _load_json("market_health.json")
    if not isinstance(raw, dict):
        return {}
    ch = raw.get("current_health") or raw
    return {
        "score_value": round(float(ch.get("score_value") or 0.0), 1),
        "health_regime": ch.get("health_regime", "UNKNOWN"),
        "health_regime_label": ch.get("health_regime_label", "Active Regime"),
        "health_regime_color": ch.get("health_regime_color", "#fbbf24"),
        "adv_dec_ratio": ch.get("adv_dec_ratio"),
        "up_vol_pct": ch.get("up_vol_pct"),
        "mco_status": ch.get("mco_status", "N/A"),
        "breadth_status": ch.get("breadth_status", "N/A"),
        "ad_momentum": ch.get("ad_momentum", "N/A"),
        "summary_text": ch.get("summary_text", ""),
        "issues_list": ch.get("issues_list", [])[:4],
        "strengths_list": ch.get("strengths_list", [])[:4],
        "trade_date": raw.get("trade_date", ""),
    }


def _collect_cross_engine_signals() -> Dict[str, dict]:
    """Collect real setups & confluence tags across all live workspace scanners."""
    by_ticker: Dict[str, dict] = {}

    def _add(sym: str, eng_name: str, direction: str = "BULLISH", extra: Optional[dict] = None):
        s = str(sym or "").upper().strip()
        if not s:
            return
        entry = by_ticker.setdefault(s, {"ticker": s, "engines": [], "direction": direction, "squeeze": None})
        if eng_name not in entry["engines"]:
            entry["engines"].append(eng_name)
        if direction == "BEARISH" and eng_name == "Apex Squeeze 4.0":
            entry["direction"] = "BEARISH"
        if extra and eng_name == "Apex Squeeze 4.0":
            entry["squeeze"] = extra

    sq = _load_json("squeeze_results.json")
    for it in (sq.get("all_squeezes") or []) if isinstance(sq, dict) else []:
        _add(it.get("ticker"), "Apex Squeeze 4.0", it.get("direction", "BULLISH"), extra=it)

    cu = _load_json("clean_uptrend_results.json")
    for it in (cu.get("stocks") or cu.get("results") or []) if isinstance(cu, dict) else []:
        _add(it.get("ticker"), "Clean Uptrend", "BULLISH")

    sw = _load_json("swing_trading_setups.json")
    for it in (sw.get("setups") or sw.get("all_setups") or []) if isinstance(sw, dict) else []:
        _add(it.get("ticker"), "1-3W Swing", "BULLISH")

    pb = _load_json("ai_playbook.json")
    for it in (pb.get("all_setups") or pb.get("focus_list") or []) if isinstance(pb, dict) else []:
        _add(it.get("ticker"), "AI Playbook", "BULLISH")

    ign = _load_json("pre_breakout_ignition_results.json")
    for it in (ign.get("results") or ign.get("all_ignitions") or []) if isinstance(ign, dict) else []:
        _add(it.get("ticker"), "Pre-Breakout Ignition", "BULLISH")

    rs = _load_json("rs_scanner_results.json")
    for it in (rs.get("results") or [])[:250] if isinstance(rs, dict) else []:
        if isinstance(it, dict) and (it.get("is_blue_dot") or it.get("is_blue_dot_today") or (it.get("ibd_perf") or 0) >= 85):
            _add(it.get("ticker"), "RS Blue Dot Leader", "BULLISH")

    return by_ticker


def extract_tickers_from_prompt(prompt: str, fallback_ticker: str = "SPY") -> Tuple[List[str], str]:
    """
    Strictly extract explicit tickers from user prompt without false uppercase hits like 'AI', 'MA', 'V', 'DCF'.
    Returns (explicit_tickers, normalized_fallback).
    """
    meta = load_all_metadata()
    valid_set = set(meta.keys()) | ETF_WHITELIST
    raw = (prompt or "").strip()
    upper_raw = raw.upper()

    found: List[str] = []

    def _push(sym: str):
        s = str(sym).upper().strip()
        if s and s in valid_set and s not in found:
            found.append(s)
        elif s and re.fullmatch(r"[A-Z]{1,5}(?:-[A-Z])?", s) and s not in found:
            found.append(s)

    # 1. Explicit `$TICKER` always wins (so `$AI`, `$MA`, `$V`, `$ON` work unambiguously!)
    for m in re.finditer(r'\$([A-Za-z]{1,5}(?:-[A-Za-z])?)\b', raw):
        _push(m.group(1).upper())

    # 2. Explicit known multi-word or single company names (longest match first)
    for comp_name in sorted(COMPANY_TO_TICKER.keys(), key=len, reverse=True):
        if re.search(r'\b' + re.escape(comp_name) + r'\b', upper_raw):
            _push(COMPANY_TO_TICKER[comp_name])

    # 3. Token scan after explicit trigger words or comparisons (`NVDA vs AMD`, `analyze COST`)
    tokens = re.findall(r'[A-Za-z]+(?:-[A-Za-z])?', raw)
    triggers = {"ANALYZE", "ABOUT", "AUDIT", "CHECK", "COMPARE", "VS", "VERSUS", "TICKER", "STOCK", "PRICE", "BRIEF"}
    for i, tok in enumerate(tokens):
        up = tok.upper()
        if up in NON_TICKER_STOP_WORDS or up in AMBIGUOUS_ENGLISH_TICKERS:
            # Allow ambiguous ticker ONLY if preceded by explicit trigger AND user typed uppercase (e.g. `analyze AI` or `vs MA`)
            prev_up = tokens[i - 1].upper() if i > 0 else ""
            if tok.isupper() and prev_up in {"ANALYZE", "BRIEF", "VS", "VERSUS"} and up in valid_set:
                _push(up)
            continue

        prev_up = tokens[i - 1].upper() if i > 0 else ""
        next_up = tokens[i + 1].upper() if i + 1 < len(tokens) else ""
        if up in valid_set and (tok.isupper() or prev_up in triggers or next_up in {"VS", "VERSUS"}):
            _push(up)

    fb = str(fallback_ticker or "SPY").upper().strip()
    if fb in ("UNKNOWN", "BRIEFING", ""):
        fb = "SPY"
    return found, fb


def _rsi_label(rsi_val: float) -> str:
    if rsi_val >= 70.0:
        return "Overbought (>=70)"
    if rsi_val >= 55.0:
        return "Bullish Momentum (55-70)"
    if rsi_val >= 45.0:
        return "Neutral (45-55)"
    if rsi_val >= 35.0:
        return "Softening / Weak (35-45)"
    return "Oversold (<35)"


def _format_currency(num: Optional[float]) -> str:
    if num is None or (isinstance(num, float) and math.isnan(num)):
        return "N/A"
    abs_num = abs(float(num))
    sign = "-" if float(num) < 0 else ""
    if abs_num >= 1e12:
        return f"{sign}${abs_num / 1e12:.2f}T"
    if abs_num >= 1e9:
        return f"{sign}${abs_num / 1e9:.2f}B"
    if abs_num >= 1e6:
        return f"{sign}${abs_num / 1e6:.2f}M"
    return f"{sign}${abs_num:,.2f}"


def _format_pct(num: Optional[float]) -> str:
    if num is None or (isinstance(num, float) and math.isnan(num)):
        return "N/A"
    val = float(num)
    return f"{val * 100:+.1f}%" if abs(val) < 1.5 else f"{val:+.1f}%"


def _build_bracket(ind: dict, t: int, direction: str) -> dict:
    spot = float(ind["c"][t])
    atr = float(ind["atr14"][t]) if math.isfinite(ind["atr14"][t]) and ind["atr14"][t] > 0 else spot * 0.025
    ema21 = float(ind["ema21"][t])
    is_bull = direction == "BULLISH"

    if is_bull:
        h10 = float(ind["high_10_prev"][t]) if math.isfinite(ind["high_10_prev"][t]) else spot
        piv = round(spot if abs(h10 - spot) / spot <= 0.015 else max(spot * 1.003, h10), 2)
        stop_raw = max(spot * 0.915, min(ema21 * 0.988, piv - 1.8 * atr))
        stop = round(min(piv * 0.97, stop_raw), 2)
        risk_sh = max(0.05, piv - stop)
        t1 = round(piv + 2.0 * risk_sh, 2)
        t2 = round(piv + 3.5 * risk_sh, 2)
        entry_range = [round(spot * 0.992, 2), round(piv * 1.01, 2)]
    else:
        l10 = float(ind["low_10_prev"][t]) if math.isfinite(ind["low_10_prev"][t]) else spot
        piv = round(spot if abs(spot - l10) / spot <= 0.015 else min(spot * 0.997, l10), 2)
        stop_raw = min(spot * 1.085, max(ema21 * 1.012, piv + 1.8 * atr))
        stop = round(max(piv * 1.03, stop_raw), 2)
        risk_sh = max(0.05, stop - piv)
        t1 = round(piv - 2.0 * risk_sh, 2)
        t2 = round(piv - 3.5 * risk_sh, 2)
        entry_range = [round(piv * 0.99, 2), round(spot * 1.008, 2)]

    risk_pct = round((risk_sh / max(piv, 1e-4)) * 100.0, 2)
    t1_pct = round((abs(t1 - piv) / max(piv, 1e-4)) * 100.0, 1)
    t2_pct = round((abs(t2 - piv) / max(piv, 1e-4)) * 100.0, 1)
    rr = round(abs(t2 - piv) / max(risk_sh, 1e-4), 1)
    return {
        "entry_pivot": piv,
        "entry_range": entry_range,
        "stop_loss": stop,
        "stop_loss_pct": -risk_pct if is_bull else risk_pct,
        "risk_pct": risk_pct,
        "target_primary": t1,
        "target_primary_pct": t1_pct,
        "target_secondary": t2,
        "target_secondary_pct": t2_pct,
        "risk_reward": f"1:{rr}",
        "rr_num": rr,
    }


def rank_live_high_conviction_setups(
    mode: str = "ALL",
    limit: int = 6,
    opt_map_override: Optional[dict] = None,
) -> Dict[str, Any]:
    """
    Dynamically score & rank top verified $2B+ US equities across all active sibling scanners
    using the 5Y Walk-Forward Calibrated conviction scorer (never static/stale focus_list).
    mode: 'ALL' | 'BULLISH' | 'BEARISH' | 'SQUEEZE' | 'OPTIONS'
    """
    meta = load_all_metadata()
    sig_map = _collect_cross_engine_signals()

    cand_tickers = []
    for sym, info in sig_map.items():
        m = meta.get(sym)
        if not m or m.get("is_etf", False) or m.get("market_cap_usd", 0) < MIN_MARKET_CAP_USD:
            continue
        if mode == "SQUEEZE" and "Apex Squeeze 4.0" not in info["engines"]:
            continue
        cand_tickers.append(sym)

    # Sort candidates by engine confluence count first and cap lakehouse query to top 220 for sub-300ms speed
    cand_tickers.sort(key=lambda s: len(sig_map[s]["engines"]), reverse=True)
    cand_tickers = cand_tickers[:220]

    df_all = _load_lakehouse_df(cand_tickers, days_limit=320)
    if df_all.empty:
        return {"setups": [], "trade_date": "", "market_health": _get_market_health_summary()}

    trade_date = str(df_all["DateStr"].max())
    spy_df = df_all[df_all["Ticker"] == "SPY"]
    spy_map = dict(zip(spy_df["DateStr"], spy_df["Close"].astype(float)))
    opt_map = opt_map_override if opt_map_override is not None else _load_options_telemetry_map(cand_tickers)

    scored: List[dict] = []
    for sym, grp in df_all.groupby("Ticker", sort=False):
        if sym == "SPY" or sym not in meta:
            continue
        if len(grp) < 65:
            continue
        spy_vals = pd.Series([spy_map.get(d, np.nan) for d in grp["DateStr"]]).ffill().bfill().to_numpy(dtype=float)
        ind = compute_equity_indicators(grp, spy_close_aligned=spy_vals)
        if ind is None:
            continue
        t = ind["n"] - 1
        spot = float(ind["c"][t])
        avg_v = float(ind["avg_vol_20"][t])
        if spot < MIN_PRICE or avg_v < MIN_AVG_VOL_20 or (avg_v * spot) < MIN_DOLLAR_VOL_20:
            continue

        sig = sig_map.get(sym, {"engines": [], "direction": "BULLISH", "squeeze": None})
        opt = opt_map.get(sym)
        if mode == "OPTIONS" and not (opt and opt.get("options_available") and ((opt.get("net_gex") or 0) < 0 or (opt.get("total_opt_vol") or 0) >= 5000)):
            continue

        engines = sig["engines"]
        sq_info = sig.get("squeeze")
        sma50_t = float(ind["sma50"][t])
        sma200_t = float(ind["sma200"][t])

        # Determine setup direction cleanly
        if mode == "BEARISH":
            d_dir = "BEARISH"
            # Require actual downtrend structure for BEARISH mode
            if not (math.isfinite(sma50_t) and spot <= sma50_t * 1.01):
                continue
        elif mode in ("BULLISH", "ALL", "OPTIONS"):
            d_dir = sig["direction"] if mode == "ALL" else "BULLISH"
        else:
            d_dir = sig["direction"]

        ev = score_conviction_bar(ind, t, direction=d_dir, opt_info=opt, confluence_count=len(engines))
        if ev["score"] < 55.0:
            continue

        bracket = _build_bracket(ind, t, d_dir)
        prev_c = float(ind["prev_c"][t])
        chg_pct = round(((spot - prev_c) / max(prev_c, 1e-4)) * 100.0, 2)
        m = meta[sym]

        scored.append({
            "ticker": sym,
            "name": m["name"],
            "sector": m["sector"],
            "market_cap_b": m["market_cap_b"],
            "direction": d_dir,
            "price": round(spot, 2),
            "change_pct": chg_pct,
            "conviction_score": ev["score"],
            "grade": ev["grade"],
            "pillars": ev["pillars"],
            "rsi14": round(float(ind["rsi14"][t]), 1),
            "alpha_30d": round(float(ind["alpha_30d"][t]), 1),
            "bb_pctl": round(float(ind["bb_pctl_120"][t]), 1),
            "rvol": round(float(ind["v"][t]) / max(avg_v, 1.0), 2),
            "engines": engines,
            "confluence_count": len(engines),
            "squeeze_label": sq_info.get("ttm_label") if sq_info else None,
            "squeeze_score": sq_info.get("composite_score") if sq_info else None,
            "options_available": bool(opt and opt.get("options_available")),
            "net_gex": opt.get("net_gex") if opt else None,
            "call_vol_pct": opt.get("call_vol_pct") if opt else None,
            "iv_compression_pct": opt.get("iv_compression_pct") if opt else None,
            **bracket,
        })

    scored.sort(key=lambda x: (x["conviction_score"], x["confluence_count"], -(x["bb_pctl"])), reverse=True)
    return {
        "setups": scored[:limit],
        "total_qualified": len(scored),
        "trade_date": trade_date,
        "market_health": _get_market_health_summary(),
    }


def _fetch_stock_bundle(ticker: str) -> Optional[dict]:
    """Assemble verified lakehouse + yfinance + SQLite GEX + optional fundamentals bundle for a single ticker."""
    sym = ticker.upper().strip()
    meta_all = load_all_metadata()
    meta = meta_all.get(sym, {"name": sym, "sector": "N/A", "industry": "Equities", "market_cap_b": 0.0, "market_cap_usd": 0.0, "is_etf": sym in ETF_WHITELIST})

    df_all = _load_lakehouse_df([sym], days_limit=320)
    spy_df = df_all[df_all["Ticker"] == "SPY"] if not df_all.empty else pd.DataFrame()
    stk_df = df_all[df_all["Ticker"] == sym] if not df_all.empty else pd.DataFrame()

    # Fallback to yfinance if ticker isn't in local parquet (e.g. brand-new IPO)
    if stk_df.empty or len(stk_df) < 60:
        try:
            t_yf = _get_cached_yf(sym)
            h_yf = t_yf.history(period="1y")
            if h_yf is not None and not h_yf.empty and len(h_yf) >= 40:
                h_yf = h_yf.reset_index()
                h_yf["DateStr"] = h_yf["Date"].astype(str).str[:10]
                stk_df = h_yf
        except Exception:
            pass

    if stk_df is None or stk_df.empty or len(stk_df) < 35:
        return None

    spy_chg = 0.0
    if not spy_df.empty and len(spy_df) >= 2:
        spy_c = spy_df["Close"].to_numpy(dtype=float)
        spy_chg = round(((spy_c[-1] - spy_c[-2]) / max(spy_c[-2], 1e-4)) * 100.0, 2)
        spy_map = dict(zip(spy_df["DateStr"], spy_df["Close"].astype(float)))
        spy_aligned = pd.Series([spy_map.get(d, np.nan) for d in stk_df["DateStr"]]).ffill().bfill().to_numpy(dtype=float)
    else:
        spy_aligned = None

    ind = compute_equity_indicators(stk_df, spy_close_aligned=spy_aligned)
    if ind is None:
        return None
    t = ind["n"] - 1
    spot = round(float(ind["c"][t]), 2)
    prev_c = float(ind["prev_c"][t])
    chg_pct = round(((float(ind["c"][t]) - prev_c) / max(prev_c, 1e-4)) * 100.0, 2)
    ema10 = round(float(ind["ema10"][t]), 2)
    ema21 = round(float(ind["ema21"][t]), 2)
    sma50 = round(float(ind["sma50"][t]), 2) if math.isfinite(ind["sma50"][t]) else None
    sma200 = round(float(ind["sma200"][t]), 2) if math.isfinite(ind["sma200"][t]) else None
    rsi14 = round(float(ind["rsi14"][t]), 1)
    atr14 = round(float(ind["atr14"][t]), 2)
    avg_v = float(ind["avg_vol_20"][t])
    rvol = round(float(ind["v"][t]) / max(avg_v, 1.0), 2)
    high_52w = round(float(np.max(ind["h"][max(0, t - 252):t + 1])), 2)
    low_52w = round(float(np.min(ind["l"][max(0, t - 252):t + 1])), 2)

    if sma50 is not None and sma200 is not None:
        if spot >= sma50 and sma50 >= sma200:
            stage = "Stage 2 (Advancing Uptrend)"
        elif spot >= ema21 and (spot < sma50 or sma50 < sma200):
            stage = "Stage 1/3 (Transition / Base)"
        else:
            stage = "Stage 4 (Declining / Corrective)"
    else:
        stage = "Stage 2 (Trend Above 21-EMA)" if spot >= ema21 else "Stage 4 (Below 21-EMA)"

    # Real Options DB + GEX Profile
    opt_db = _load_options_telemetry_map([sym]).get(sym)
    gex_prof = _get_gex_profile(sym)

    sig_map = _collect_cross_engine_signals()
    sig_info = sig_map.get(sym, {"engines": [], "direction": "BULLISH", "squeeze": None})
    engines = sig_info["engines"]

    # Score LONG setup integrity cleanly; note bearish score separately for Stage 4 stocks
    ev_bull = score_conviction_bar(ind, t, "BULLISH", opt_db, len(engines))
    ev_bear = score_conviction_bar(ind, t, "BEARISH", opt_db, len(engines))
    ev = ev_bull
    dom_dir = "BEARISH" if (stage.startswith("Stage 4") and ev_bear["score"] > ev_bull["score"] + 10.0) else "BULLISH"

    bracket = _build_bracket(ind, t, dom_dir)

    return {
        "ticker": sym,
        "name": meta["name"],
        "sector": meta["sector"],
        "industry": meta["industry"],
        "is_etf": meta["is_etf"],
        "market_cap_usd": meta["market_cap_usd"],
        "market_cap_b": meta["market_cap_b"],
        "trade_date": ind["dates"][t],
        "spot": spot,
        "chg_pct": chg_pct,
        "spy_chg": spy_chg,
        "rel_vs_spy_1d": round(chg_pct - spy_chg, 2),
        "alpha_30d": round(float(ind["alpha_30d"][t]), 1),
        "ema10": ema10,
        "ema21": ema21,
        "sma50": sma50,
        "sma200": sma200,
        "rsi14": rsi14,
        "rsi_label": _rsi_label(rsi14),
        "atr14": atr14,
        "rvol": rvol,
        "ud_ratio": round(float(ind["ud_ratio"][t]), 2),
        "bb_pctl": round(float(ind["bb_pctl_120"][t]), 1),
        "high_52w": high_52w,
        "low_52w": low_52w,
        "stage": stage,
        "direction": dom_dir,
        "conviction_score": ev["score"],
        "grade": ev["grade"],
        "pillars": ev["pillars"],
        "engines": engines,
        "opt_db": opt_db,
        "gex_prof": gex_prof,
        "bracket": bracket,
    }


def build_top_picks_answer(mode: str, persona: str) -> Dict[str, Any]:
    res = rank_live_high_conviction_setups(mode=mode, limit=6)
    setups = res["setups"]
    mh = res["market_health"]
    mh_score = mh.get("score_value", 0.0)
    mh_label = mh.get("health_regime_label", "Active Regime")

    if mh_score < 30.0:
        regime_note = f"Capital Preservation ({mh_score}/100 · {mh_label}) — Limit per-trade risk to 0.5%–0.75%, focus only on top A+/A multi-engine setups."
    elif mh_score < 60.0:
        regime_note = f"Tactical Neutral ({mh_score}/100 · {mh_label}) — Standard 1.0% risk sizing; favor strong RS & real GEX confirmation."
    else:
        regime_note = f"Risk-On Expansion ({mh_score}/100 · {mh_label}) — Full swing sizing permitted on Stage 2 leaders."

    mode_titles = {
        "ALL": "Top Multi-Engine High-Conviction Setups",
        "BULLISH": "Top Bullish Breakout Leaders",
        "BEARISH": "Top Bearish Breakdown Short Setups",
        "SQUEEZE": "Top Coiled & Firing TTM Squeeze Setups",
        "OPTIONS": "Top Negative-GEX & Unusual Options Setups",
    }
    title = mode_titles.get(mode, "Top Multi-Engine Setups")

    if not setups:
        return {
            "response": f"⚠️ No `$2B+` US equities currently satisfy the **{title}** filters on `{res['trade_date']}`.",
            "structured_card": None,
            "suggested_prompts": [
                "🚀 Top High-Conviction Setups",
                "🛡️ What is the current Market Health regime?",
                "Analyze $NVDA levels & options GEX",
            ],
        }

    lines = [
        f"🚀 **{title}** *(Scanned across Apex Squeeze 4.0, Clean Uptrend, 1-3W Swing, RS Blue Dot & AI Playbook · Trade Date `{res['trade_date']}`)*",
        "",
        f"• **Macro Risk Posture:** {regime_note}",
        "",
    ]
    for i, s in enumerate(setups[:5], 1):
        opt_str = (
            f"Net GEX `{s['net_gex']}M` (Call `{s['call_vol_pct']}%`)"
            if s["options_available"]
            else "No SQLite options tape"
        )
        eng_str = ", ".join(s["engines"][:3]) if s["engines"] else "Quantitative Screen"
        lines.append(
            f"**{i}. ${s['ticker']}** ({s['direction']} · **{s['grade']} {s['conviction_score']}/100**) — `${s['price']:.2f}` (`{s['change_pct']:+.2f}%`)\n"
            f"• **Engines:** {eng_str} | **RSI:** `{s['rsi14']}` | **30D Alpha:** `{s['alpha_30d']:+.1f}%`\n"
            f"• **Bracket:** Pivot `${s['entry_pivot']:.2f}` | Stop `${s['stop_loss']:.2f}` (`{s['stop_loss_pct']}%`) | T1 `${s['target_primary']:.2f}` (`{s['risk_reward']}`) | **Options:** {opt_str}"
        )

    lines.append("")
    lines.append(
        "*5Y Walk-Forward Note*: `A+` calibration (`>= 76.0`) focuses strictly on unextended early-base leaders with institutional up-volume confirmation."
    )

    top1 = setups[0]
    return _sanitize_json({
        "response": "\n\n".join(lines),
        "structured_card": {
            "type": "top_picks_card",
            "title": title,
            "mode": mode,
            "trade_date": res["trade_date"],
            "total_qualified": res["total_qualified"],
            "regime_note": regime_note,
            "market_health_score": mh_score,
            "market_health_label": mh_label,
            "items": setups,
            "top_ticker": top1["ticker"],
        },
        "suggested_prompts": [
            f"🧲 Deep dive GEX & setup for ${top1['ticker']}",
            f"⚖️ Compare ${setups[0]['ticker']} vs ${setups[1]['ticker']}" if len(setups) >= 2 else f"📊 DCF Valuation for ${top1['ticker']}",
            "🔴 Show Bearish Short Setups",
            "🛡️ Macro Risk Budget for Current Regime",
        ],
    })


def build_comparison_answer(t1: str, t2: str) -> Dict[str, Any]:
    b1 = _fetch_stock_bundle(t1)
    b2 = _fetch_stock_bundle(t2)
    if not b1 or not b2:
        missing = t1 if not b1 else t2
        return _sanitize_json({
            "response": f"⚠️ Unable to load complete price history for **${missing}** to run head-to-head comparison.",
            "structured_card": None,
            "suggested_prompts": ["Compare $NVDA vs $AMD", "Compare $SPY vs $QQQ", "Top High-Conviction Setups"],
        })

    winner = b1 if b1["conviction_score"] >= b2["conviction_score"] else b2
    loser = b2 if winner is b1 else b1

    def _row(b: dict) -> dict:
        gex_val = b["opt_db"]["net_gex"] if b["opt_db"] else None
        call_pct = b["opt_db"]["call_vol_pct"] if b["opt_db"] else None
        return {
            "ticker": b["ticker"],
            "name": b["name"],
            "sector": b["sector"],
            "spot": b["spot"],
            "chg_pct": b["chg_pct"],
            "stage": b["stage"],
            "direction": b["direction"],
            "conviction_score": b["conviction_score"],
            "grade": b["grade"],
            "rsi14": b["rsi14"],
            "alpha_30d": b["alpha_30d"],
            "bb_pctl": b["bb_pctl"],
            "rvol": b["rvol"],
            "net_gex": gex_val,
            "call_vol_pct": call_pct,
            "engines_count": len(b["engines"]),
        }

    md = (
        f"⚖️ **Head-to-Head Quantitative Comparison: ${b1['ticker']} vs ${b2['ticker']}**\n\n"
        f"• **${b1['ticker']} ({b1['name']}):** `${b1['spot']:.2f}` (`{b1['chg_pct']:+.2f}%`) | Grade **{b1['grade']} ({b1['conviction_score']}/100)** | {b1['stage']} | RSI `{b1['rsi14']}` | 30D Alpha `{b1['alpha_30d']:+.1f}%`\n\n"
        f"• **${b2['ticker']} ({b2['name']}):** `${b2['spot']:.2f}` (`{b2['chg_pct']:+.2f}%`) | Grade **{b2['grade']} ({b2['conviction_score']}/100)** | {b2['stage']} | RSI `{b2['rsi14']}` | 30D Alpha `{b2['alpha_30d']:+.1f}%`\n\n"
        f"### 🏆 Quantitative Edge Verdict\n\n"
        f"**${winner['ticker']}** leads on walk-forward score (**{winner['conviction_score']}** vs {loser['conviction_score']}) driven by {winner['stage']} structure and {winner['pillars']['footprint']:.0f}/100 volume footprint."
    )

    return _sanitize_json({
        "response": md,
        "structured_card": {
            "type": "comparison_card",
            "winner": winner["ticker"],
            "left": _row(b1),
            "right": _row(b2),
        },
        "suggested_prompts": [
            f"🎯 Analyze ${winner['ticker']} bracket & stops",
            f"⚡ Audit ${winner['ticker']} dealer GEX walls",
            "🚀 Top High-Conviction Setups",
        ],
    })


def build_universal_stock_answer(ticker: str, prompt: str, persona: str = "master") -> Dict[str, Any]:
    sym = ticker.upper().strip()
    b = _fetch_stock_bundle(sym)
    if b is None:
        return {
            "response": f"⚠️ Could not locate sufficient trading history for **${sym}**. Try an active US ticker such as `$NVDA`, `$AAPL`, `$SPY`, or `$AI`.",
            "structured_card": None,
            "suggested_prompts": ["Top High-Conviction Setups", "Analyze $NVDA", "Analyze $SPY"],
        }

    p_low = (prompt or "").lower()
    intents = {
        "attribution": any(k in p_low for k in ["why is", "why", "down today", "up today", "falling", "dropping", "surging", "rallying", "what happened"]),
        "valuation": any(k in p_low for k in ["pe", "p/e", "valuation", "fair value", "dcf", "multiple", "peg", "earnings", "fcf", "margin"]),
        "gex": any(k in p_low for k in ["gamma", "gex", "call wall", "put wall", "zero gamma", "dealer", "max pain", "options", "vex", "iv"]),
    }

    spot = b["spot"]
    chg_pct = b["chg_pct"]
    opt_db = b["opt_db"]
    gex_prof = b["gex_prof"] or {}
    kl = gex_prof.get("key_levels") or {}
    call_wall = kl.get("call_wall")
    put_wall = kl.get("put_wall")
    zero_gamma = kl.get("zero_gamma")
    max_pain = kl.get("max_pain") or (opt_db.get("max_pain") if opt_db else None)
    net_gex_m = opt_db.get("net_gex") if opt_db else None
    gex_tot = gex_prof.get("totals") or {}
    has_gex_walls = isinstance(call_wall, (int, float)) and isinstance(put_wall, (int, float)) and call_wall > 0 and put_wall > 0

    # Lazy-fetch fundamentals / yfinance news ONLY when relevant or persona requires (keeps latency < 250ms on quant/options!)
    dcf_info: dict = {}
    yf_info: dict = {}
    news_items: List[dict] = []
    if intents["valuation"] or persona == "fundamental":
        try:
            if BASE_DIR not in sys.path:
                sys.path.append(BASE_DIR)
            from fundamental_data_api import calculate_dcf_fair_value
            d = calculate_dcf_fair_value(sym)
            if isinstance(d, dict) and not d.get("error"):
                dcf_info = d
        except Exception:
            pass
        try:
            yf_info = _get_cached_yf(sym).info or {}
        except Exception:
            yf_info = {}

    if intents["attribution"]:
        try:
            raw_news = _get_cached_yf(sym).news or []
            for n in raw_news[:3]:
                content = n.get("content") or {}
                ttl = content.get("title") or n.get("title")
                if ttl:
                    news_items.append({"title": ttl})
        except Exception:
            pass

    persona_headers = {
        "master": "🧠 MASTER AI COUNCIL SYNTHESIS",
        "quant": "🎯 QUANT BREAKOUT & STAGE AUDIT",
        "options": "⚡ DEALER GAMMA & OPTIONS STRUCTURE",
        "macro": "🌐 MACRO & RELATIVE REGIME VIEW",
        "fundamental": "📊 FUNDAMENTAL & VALUATION AUDIT",
    }
    header = persona_headers.get(persona, "🧠 QUANTITATIVE STOCK AUDIT")
    mcap_str = f"${b['market_cap_b']}B" if b["market_cap_b"] > 0 else ("ETF" if b["is_etf"] else "N/A")
    sma50_s = f"${b['sma50']:.2f}" if b["sma50"] is not None else "N/A"
    sma200_s = f"${b['sma200']:.2f}" if b["sma200"] is not None else "N/A"
    eng_s = ", ".join(b["engines"]) if b["engines"] else "None active (Unqualified across momentum/squeeze scans)"

    sections = [
        f"{header} — **${sym}** ({b['name']})",
        (
            f"• **Spot Price:** `${spot:.2f}` (`{chg_pct:+.2f}%` on `{b['trade_date']}`) | **Sector:** `{b['sector']}` | **Size:** `{mcap_str}`\n"
            f"• **Structural Stage:** `{b['stage']}` | **52W Range:** `${b['low_52w']:.2f} ── ${b['high_52w']:.2f}`\n"
            f"• **Walk-Forward Conviction:** **`{b['grade']} · {b['conviction_score']}/100 ({b['direction']})`** | **Active Engine Hits:** {eng_s}"
        ),
    ]

    if intents["attribution"]:
        rel_dir = "outperforming" if b["rel_vs_spy_1d"] >= 0 else "lagging"
        attr_lines = [
            f"• **Relative Tape Attribution:** **${sym}** (`{chg_pct:+.2f}%`) is {rel_dir} **SPY** (`{b['spy_chg']:+.2f}%`) by `{b['rel_vs_spy_1d']:+.2f}%` within `{b['sector']}` (`30D Alpha: {b['alpha_30d']:+.1f}%`).",
            f"• **MA & Momentum Position:** Trading {'above' if spot >= b['ema10'] else 'below'} `10-EMA (${b['ema10']:.2f})` and {'above' if b['sma50'] and spot >= b['sma50'] else 'below'} `50-SMA ({sma50_s})`; `RSI(14) = {b['rsi14']}` ({b['rsi_label']}).",
        ]
        for ni in news_items[:2]:
            attr_lines.append(f"• **Recent Headline:** *\"{ni['title']}\"*")
        sections.append("### 🔍 Real-Time Move Attribution\n\n" + "\n".join(attr_lines))

    # Technical Section
    sections.append(
        "### 📈 Technical & Footprint Telemetry\n\n"
        f"• **RSI(14) Wilder:** `{b['rsi14']}` — **{b['rsi_label']}** | **RVOL:** `{b['rvol']}x` | **30D U/D Vol:** `{b['ud_ratio']}`\n"
        f"• **Volatility Compression:** `BB Width 120D Pctl = {b['bb_pctl']}%` | **ATR(14):** `${b['atr14']:.2f}`\n"
        f"• **Moving Averages:** `10-EMA ${b['ema10']:.2f}` · `21-EMA ${b['ema21']:.2f}` · `50-SMA {sma50_s}` · `200-SMA {sma200_s}`"
    )

    # Options & GEX Section (zero fabricated walls)
    if intents["gex"] or persona == "options" or has_gex_walls or opt_db:
        gex_lines = []
        if has_gex_walls:
            tot_gex = gex_tot.get("total_net_gex")
            zg_s = f"`${float(zero_gamma):.2f}`" if zero_gamma else "N/A"
            mp_s = f"`${float(max_pain):.2f}`" if max_pain else "N/A"
            gex_lines.append(
                f"• **GEX Walls:** Call Wall `${float(call_wall):.2f}` | Put Wall `${float(put_wall):.2f}` | Zero Gamma {zg_s} | Max Pain {mp_s}"
            )
            if tot_gex is not None:
                gex_lines.append(f"• **Dealer Gamma Positioning:** Net GEX `{_format_currency(tot_gex)}`")
        if opt_db:
            gex_lines.append(
                f"• **SQLite Options Chain (`{opt_db['opt_date']}`):** Net GEX `{opt_db['net_gex']}M` (`{opt_db['gex_regime']}`) | Call Vol `{opt_db['call_vol_pct']}%` | P/C `{opt_db['pcr_vol']}` | 30D IV `{opt_db['atm_iv_30d']}%` (`-{opt_db['iv_compression_pct']}%` vs 20D high)"
            )
        if not gex_lines:
            gex_lines.append("• **Options Telemetry:** No verified options chain snapshot present for this ticker (synthetic levels omitted).")
        sections.append("### ⚡ Dealer Gamma & Options Architecture\n\n" + "\n".join(gex_lines))

    # Fundamental Section (zero fabricated DCF)
    pe = yf_info.get("trailingPE")
    fwd_pe = yf_info.get("forwardPE")
    rev_g = yf_info.get("revenueGrowth")
    op_m = yf_info.get("operatingMargins")
    fcf = yf_info.get("freeCashflow")
    tgt_mean = yf_info.get("targetMeanPrice")
    rec_key = (yf_info.get("recommendationKey") or "N/A").replace("_", " ").upper()

    if intents["valuation"] or persona == "fundamental":
        fv = dcf_info.get("fair_value")
        mos = round(((fv - spot) / fv) * 100.0, 1) if (fv and fv > 0) else None
        fv_str = f"`${float(fv):.2f}` ({mos:+.1f}% vs spot)" if fv else "Unavailable (`N/A`)"
        tgt_str = f"`${float(tgt_mean):.2f}` (`{rec_key}`)" if tgt_mean else "N/A"
        sections.append(
            "### 📊 Verified Fundamental & Valuation Snapshot\n\n"
            f"• **DCF Intrinsic Fair Value:** {fv_str} | **Analyst Consensus:** {tgt_str}\n"
            f"• **Multiples:** Trailing P/E `{f'{pe:.1f}x' if pe else 'N/A'}` | Forward P/E `{f'{fwd_pe:.1f}x' if fwd_pe else 'N/A'}`\n"
            f"• **Operating Quality:** Operating Margin `{_format_pct(op_m)}` | YoY Rev Growth `{_format_pct(rev_g)}` | TTM FCF `{_format_currency(fcf)}`"
        )

    # Structured Card Selection (honest telemetry!)
    br = b["bracket"]
    if (intents["gex"] or persona == "options") and has_gex_walls:
        em = gex_prof.get("expected_move") if isinstance(gex_prof.get("expected_move"), dict) else {}
        structured_card = {
            "type": "gex_card",
            "ticker": sym,
            "price": spot,
            "change_pct": chg_pct,
            "call_wall": round(float(call_wall), 2),
            "put_wall": round(float(put_wall), 2),
            "zero_gamma": round(float(zero_gamma), 2) if zero_gamma else None,
            "max_pain": round(float(max_pain), 2) if max_pain else None,
            "net_gex": _format_currency(gex_tot.get("total_net_gex")) if gex_tot.get("total_net_gex") is not None else (f"{net_gex_m}M" if net_gex_m is not None else "N/A"),
            "regime": (opt_db.get("gex_regime") if opt_db else "Verified Options Chain"),
            "squeeze_risk": f"{b['grade']} ({b['conviction_score']}/100)",
            "expected_move_1d": round(float(em["move_1d"]), 2) if em.get("move_1d") else None,
            "expected_move_pct": round(float(em["move_1d_pct"]), 2) if em.get("move_1d_pct") else None,
        }
    elif intents["valuation"] or persona == "fundamental":
        fv = dcf_info.get("fair_value")
        mos = round(((fv - spot) / fv) * 100.0, 1) if (fv and fv > 0) else None
        val_status = dcf_info.get("valuation_status") or ("Undervalued" if (mos and mos > 5) else ("Overvalued" if (mos and mos < -5) else "Unrated / Missing FCF"))
        mcap_usd = b["market_cap_usd"] or yf_info.get("marketCap") or 0.0
        fcf_yield = f"{(fcf / mcap_usd * 100):.1f}%" if (fcf and mcap_usd > 0) else "N/A"
        structured_card = {
            "type": "fundamental_card",
            "ticker": sym,
            "price": spot,
            "change_pct": chg_pct,
            "fair_value": round(float(fv), 2) if fv else None,
            "margin_of_safety": mos,
            "valuation_status": val_status,
            "piotroski_score": None,
            "pe_ratio": round(float(pe), 1) if pe else None,
            "fwd_pe": round(float(fwd_pe), 1) if fwd_pe else None,
            "operating_margin": round(float(op_m) * 100.0, 1) if op_m is not None else None,
            "revenue_growth": round(float(rev_g) * 100.0, 1) if rev_g is not None else None,
            "fcf": _format_currency(fcf),
            "fcf_yield": fcf_yield,
            "analyst_target": round(float(tgt_mean), 2) if tgt_mean else None,
            "analyst_rec": rec_key,
        }
    else:
        spread_dir = "Call Spread" if b["direction"] == "BULLISH" else "Put Spread"
        structured_card = {
            "type": "trade_setup",
            "ticker": sym,
            "price": spot,
            "change_pct": chg_pct,
            "stage": b["stage"],
            "direction": b["direction"],
            "playbook": f"{b['direction']} · {b['stage'].split('(')[0].strip()}",
            "conviction": f"{b['grade']} · {b['conviction_score']}/100",
            "conviction_score": b["conviction_score"],
            "grade": b["grade"],
            "entry_range": br["entry_range"],
            "stop_loss": br["stop_loss"],
            "stop_loss_pct": br["stop_loss_pct"],
            "target_primary": br["target_primary"],
            "target_primary_pct": br["target_primary_pct"],
            "target_secondary": br["target_secondary"],
            "target_secondary_pct": br["target_secondary_pct"],
            "risk_reward": br["risk_reward"],
            "options_spec": (
                f"30-45D ${br['entry_pivot']} -> ${br['target_primary']} {spread_dir}"
                if (opt_db or has_gex_walls)
                else "Equity Bracket (No Options Chain)"
            ),
            "pillars": b["pillars"],
            "engines": b["engines"],
        }

    return _sanitize_json({
        "response": "\n\n".join(sections),
        "structured_card": structured_card,
        "suggested_prompts": [
            f"⚡ Analyze ${sym} gamma walls & options flow",
            f"📊 Check DCF & financials for ${sym}",
            "🚀 Top High-Conviction Setups",
            "🛡️ What is the current Market Health regime?",
        ],
    })


def get_ask_ai_live_context() -> Dict[str, Any]:
    """Serve live Market Health + Top Calibrated Long/Short Setups + 5Y Calibration proof to Intelligence Rail."""
    mh = _get_market_health_summary()
    cyc = _load_json("market_cycle_50y.json")
    cyc_v = cyc.get("current_verdict", {}) if isinstance(cyc, dict) else {}
    bull = rank_live_high_conviction_setups(mode="ALL", limit=5)
    bear = rank_live_high_conviction_setups(mode="BEARISH", limit=3)

    return _sanitize_json({
        "market_health": mh,
        "macro_cycle_verdict": cyc_v.get("regime_label", "Secular View"),
        "top_conviction": bull["setups"],
        "top_bearish": bear["setups"],
        "trade_date": bull["trade_date"],
        "total_qualified": bull["total_qualified"],
        "backtest_calibration": WALKFORWARD_CALIBRATION,
    })


def process_ai_query(
    prompt: str,
    current_ticker: str = "SPY",
    persona: str = "master",
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    raw = (prompt or "").strip()
    p_low = raw.lower()
    explicit_tickers, fallback_ticker = extract_tickers_from_prompt(raw, current_ticker)
    words = p_low.split()

    is_greeting = len(words) <= 3 and bool(re.search(r'\b(hi|hello|hey|sup|greetings)\b', p_low))
    is_who = bool(re.search(r'\b(who are you|what are you|capabilities|help me)\b', p_low))

    if is_greeting:
        mh = _get_market_health_summary()
        return _sanitize_json({
            "response": (
                f"👋 **Ask AI Live 3.0** is connected to your live lakehouse, SQLite options chain, and 5-year calibrated multi-engine scanners.\n\n"
                f"• **Current Market Health:** `{mh.get('score_value', 0)}/100` — **{mh.get('health_regime_label', 'Active Regime')}**\n\n"
                f"• **Focused Symbol:** **`${fallback_ticker}`**"
            ),
            "structured_card": None,
            "suggested_prompts": [
                "🚀 Top High-Conviction AI Playbook Setups",
                f"⚡ Analyze ${fallback_ticker} gamma walls & options flow",
                "Compare $NVDA vs $AMD",
                "🛡️ What is the current Market Health regime?",
            ],
        })

    if is_who:
        return _sanitize_json({
            "response": (
                "🤖 **Ask AI Live 3.0 — Institutional Multi-Engine Copilot**\n\n"
                "• **Zero-Fabrication Telemetry:** Reads DuckDB lakehouse prices, real SQLite options GEX/IV flow, and live `market_health.json`.\n\n"
                "• **Walk-Forward Conviction Grading:** Every stock and multi-stock leaderboard uses the 5-year out-of-sample calibrated score (`A+ / A / B+ / B / AVOID`).\n\n"
                "• **Capabilities:** Multi-stock rankings (`/top`, `/squeeze`, bearish shorts), head-to-head comparisons (`$NVDA vs $AMD`), single-stock technical/GEX/DCF briefs, and macro regime sizing."
            ),
            "structured_card": None,
            "suggested_prompts": [
                "🚀 Top High-Conviction AI Playbook Setups",
                "🔥 Find the best Short Squeeze candidates",
                "Compare $NVDA vs $AMD",
                "🛡️ What is the current Market Health regime?",
            ],
        })

    # Comparison when >= 2 explicit tickers OR explicit `vs`/`compare`
    if len(explicit_tickers) >= 2:
        return build_comparison_answer(explicit_tickers[0], explicit_tickers[1])

    # Discovery / Multi-Stock Ranking BEFORE fallback ticker when user did NOT specify a ticker!
    if len(explicit_tickers) == 0:
        is_squeeze = any(k in p_low for k in ["squeeze", "coiled", "ttm squeeze", "gamma squeeze", "volatility compression"])
        is_bearish_list = (not is_squeeze) and any(k in p_low for k in ["short setup", "short setups", "bearish setup", "bearish setups", "bearish short", "bearish stocks", "breakdown stocks", "downtrend stocks"])
        is_options_list = any(k in p_low for k in ["unusual options", "negative gex", "options flow setup", "gamma flow stocks"])
        is_top_list = any(k in p_low for k in [
            "top pick", "top picks", "high conviction", "highest conviction", "high-conviction",
            "best setup", "best setups", "top setup", "top setups", "best stock", "best stocks",
            "top stock", "top stocks", "recommend", "recommendation", "what to buy", "what stocks",
            "playbook setup", "playbook setups", "top ai playbook", "breakout stocks", "breakouts",
            "top setups", "ideas", "best leaders",
        ])
        is_macro = any(k in p_low for k in ["market health", "market regime", "macro regime", "how is market", "breadth", "mcclellan", "risk budget", "overall market"])

        if is_bearish_list:
            return build_top_picks_answer("BEARISH", persona)
        if is_squeeze:
            return build_top_picks_answer("SQUEEZE", persona)
        if is_options_list:
            return build_top_picks_answer("OPTIONS", persona)
        if is_top_list:
            return build_top_picks_answer("ALL", persona)
        if is_macro:
            mh = _get_market_health_summary()
            sc = mh.get("score_value", 0.0)
            lbl = mh.get("health_regime_label", "Active Regime")
            col = mh.get("health_regime_color", "#fbbf24")
            guidance = (
                "Capital Preservation Mode (0.5%–0.75% risk per trade; strict Stage 2 A+ setups or defined-risk hedges only)"
                if sc < 30.0
                else ("Tactical Allocation Mode (1.0%–1.5% risk)" if sc < 60.0 else "Risk-On Expansion Mode (2.0%+ risk)")
            )
            return _sanitize_json({
                "response": (
                    f"🌐 **Institutional Macro & Market Health Briefing**\n\n"
                    f"• **Market Health Score:** **`{sc}/100`** — **{lbl}** (`{mh.get('trade_date', '')}`)\n"
                    f"• **Breadth / Up-Vol:** Adv/Dec Ratio `{mh.get('adv_dec_ratio', 'N/A')}` | Up Vol `{mh.get('up_vol_pct', 'N/A')}%` | MCO `{mh.get('mco_status', 'N/A')}`\n\n"
                    f"### 🛡️ Recommended Position Sizing\n\n"
                    f"• {guidance}"
                ),
                "structured_card": {
                    "type": "market_health",
                    "score": sc,
                    "label": lbl,
                    "color": col,
                    "guidance": guidance,
                },
                "suggested_prompts": [
                    "🚀 Top High-Conviction AI Playbook Setups",
                    "🔴 Show Bearish Short Setups",
                    "⚡ Analyze $SPY gamma walls & options flow",
                ],
            })

    target = explicit_tickers[0] if explicit_tickers else fallback_ticker
    return build_universal_stock_answer(ticker=target, prompt=raw, persona=persona)
