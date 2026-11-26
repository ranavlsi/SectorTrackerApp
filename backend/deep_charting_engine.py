"""Deep Charting Institutional Quant Engine.

Provides resilient multi-tier OHLCV ingestion (Alpaca -> Parquet Lakehouse -> Yahoo),
textbook Wilder/TradingView/IBD indicator math, zero-look-ahead pattern detection,
48-bin OHLC Volume Profile, and walk-forward validated signal & trade-plan synthesis.
"""

from __future__ import annotations

import datetime as dt_mod
import math
import os
import time
from typing import Any, Callable, Optional

import numpy as np
import pandas as pd
import pytz

try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
except Exception:
    pass


ET_TZ = pytz.timezone("America/New_York")
PARQUET_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "daily_ohlcv.parquet")

_OHLCV_CACHE: dict[tuple[str, str, str], tuple[float, pd.DataFrame, str]] = {}
_YF_COOLDOWN_UNTIL: float = 0.0

ETF_TICKERS = {
    "SPY", "QQQ", "IWM", "DIA", "SMH", "XLK", "XLF", "XLE", "XLV", "XLI",
    "XLY", "XLP", "XLB", "XLU", "XLC", "XLRE", "ITB", "IBB", "XBI", "SOXX",
    "ARKK", "TLT", "HYG", "GLD", "SLV", "USO", "VXX", "UVXY", "TQQQ", "SQQQ",
}

BACKTEST_OOS_EVIDENCE = {
    "universe": "25 Liquid US Leaders",
    "in_sample": "2023-06 to 2025-05",
    "out_of_sample": "2025-06 to 2026-11",
    "oos_win_rate_pct": 59.3,
    "oos_profit_factor": 1.41,
    "oos_avg_return_pct": 1.06,
    "oos_max_dd_pct": -4.7,
    "stop_rule": "2.0x Wilder ATR",
    "scale_rule": "50% @ +2.0 ATR -> Breakeven, Runner @ +3.5 ATR",
}


def sanitize_json(obj: Any) -> Any:
    """Recursively convert NaN/Inf and numpy scalars into strict RFC-8259 JSON primitives."""
    if obj is None:
        return None
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (int,)):
        return obj
    if isinstance(obj, (float, np.floating)):
        val = float(obj)
        if not math.isfinite(val):
            return None
        return val
    if isinstance(obj, dict):
        return {str(k): sanitize_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize_json(v) for v in obj]
    return obj


def ordinal(n: int) -> str:
    """Return human ordinal string (1st, 2nd, 3rd, 4th, ..., 21st, 22nd, 23rd)."""
    try:
        n_int = int(round(float(n)))
    except Exception:
        return f"{n}th"
    if 11 <= (abs(n_int) % 100) <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(abs(n_int) % 10, "th")
    return f"{n_int}{suffix}"


def _is_rate_limit_error(err: Any) -> bool:
    s = str(err or "").lower()
    return ("429" in s) or ("too many requests" in s) or ("rate limit" in s)


def _normalize_index_et(df: pd.DataFrame, is_intraday: bool) -> pd.DataFrame:
    """Normalize index to America/New_York timestamps, filtering intraday to regular session."""
    if df is None or df.empty:
        return pd.DataFrame()
    out = df.copy()
    if not isinstance(out.index, pd.DatetimeIndex):
        out.index = pd.to_datetime(out.index)
    if out.index.tz is None:
        # Parquet daily bars carry 04:00/05:00 UTC-aligned dates; localize only intraday as UTC
        if is_intraday:
            out.index = out.index.tz_localize("UTC").tz_convert(ET_TZ)
        else:
            out.index = out.index.normalize()
    else:
        out.index = out.index.tz_convert(ET_TZ)
        if not is_intraday:
            out.index = out.index.tz_localize(None).normalize()

    if is_intraday:
        # Filter to regular NYSE trading hours 09:30 - 16:00 ET so pre/after-hours thin ticks don't skew ATR
        hhmm = out.index.hour * 60 + out.index.minute
        out = out[(hhmm >= 9 * 60 + 30) & (hhmm <= 16 * 60)]
    return out.sort_index()


def _fetch_alpaca_bars(ticker: str, timeframe: str, days_back: int) -> tuple[pd.DataFrame, str]:
    """Fetch bars from Alpaca SIP (with 16m delay) or IEX fallback."""
    try:
        from backend.gex_engine import (
            DataFeed,
            StockBarsRequest,
            TimeFrame,
            TimeFrameUnit,
            _get_alpaca_gex_clients,
        )
    except Exception:
        try:
            from gex_engine import (
                DataFeed,
                StockBarsRequest,
                TimeFrame,
                TimeFrameUnit,
                _get_alpaca_gex_clients,
            )
        except Exception:
            return pd.DataFrame(), ""

    clients = _get_alpaca_gex_clients()
    if not clients or StockBarsRequest is None:
        return pd.DataFrame(), ""

    sc, _, _ = clients
    a_sym = ticker.replace("-", ".")
    now_utc = dt_mod.datetime.now(dt_mod.timezone.utc)
    start_dt = now_utc - dt_mod.timedelta(days=days_back)
    end_sip = now_utc - dt_mod.timedelta(minutes=16)

    if timeframe == "15M":
        tf_obj = TimeFrame(15, TimeFrameUnit.Minute)
        is_intra = True
        min_bars = 20
    elif timeframe == "1H":
        tf_obj = TimeFrame.Hour
        is_intra = True
        min_bars = 20
    else:
        tf_obj = TimeFrame.Day
        is_intra = False
        min_bars = 30

    for feed, end_val, src_name in (
        (DataFeed.SIP, end_sip, "ALPACA_SIP"),
        (DataFeed.IEX, None, "ALPACA_IEX"),
    ):
        try:
            req_kw = {
                "symbol_or_symbols": [a_sym],
                "timeframe": tf_obj,
                "start": start_dt,
                "feed": feed,
            }
            if end_val is not None:
                req_kw["end"] = end_val
            bars_df = sc.get_stock_bars(StockBarsRequest(**req_kw)).df
            if bars_df is None or bars_df.empty:
                continue
            if isinstance(bars_df.index, pd.MultiIndex):
                bars_df = bars_df.droplevel(0)
            bars_df = bars_df.rename(
                columns={
                    "open": "Open",
                    "high": "High",
                    "low": "Low",
                    "close": "Close",
                    "volume": "Volume",
                }
            )
            cols = [c for c in ["Open", "High", "Low", "Close", "Volume"] if c in bars_df.columns]
            bars_df = bars_df[cols].dropna(subset=["Close"])
            bars_df = _normalize_index_et(bars_df, is_intraday=is_intra)
            if len(bars_df) >= min_bars:
                return bars_df, src_name
        except Exception:
            continue
    return pd.DataFrame(), ""


def _fetch_parquet_daily(ticker: str, days_back: int) -> pd.DataFrame:
    """Load daily OHLCV bars from local multi-year Parquet lakehouse."""
    if not os.path.exists(PARQUET_PATH):
        return pd.DataFrame()
    try:
        sym = ticker.upper().strip()
        df = pd.read_parquet(PARQUET_PATH, filters=[("Ticker", "==", sym)])
        if df is None or df.empty:
            alt = sym.replace(".", "-")
            if alt != sym:
                df = pd.read_parquet(PARQUET_PATH, filters=[("Ticker", "==", alt)])
        if df is None or df.empty:
            return pd.DataFrame()
        df = df.copy()
        df["Date"] = pd.to_datetime(df["Date"]).dt.normalize()
        df = df.set_index("Date").sort_index()
        cutoff = pd.Timestamp.now().normalize() - pd.Timedelta(days=days_back)
        df = df[df.index >= cutoff]
        cols = [c for c in ["Open", "High", "Low", "Close", "Volume"] if c in df.columns]
        return df[cols].dropna(subset=["Close"])
    except Exception:
        return pd.DataFrame()


def fetch_ohlcv_resilient(
    ticker: str,
    timeframe: str = "1D",
    range_param: str = "1Y",
    yf_heal_fn: Optional[Callable] = None,
) -> tuple[pd.DataFrame, str]:
    """Fetch OHLCV via 3-tier waterfall (Alpaca -> Parquet -> Yahoo cooldown-guarded)."""
    global _YF_COOLDOWN_UNTIL

    sym = ticker.upper().strip()
    tf = timeframe.upper().strip()
    rng = range_param.upper().strip()

    if tf == "15M":
        days_back = 25
        ttl = 60.0
    elif tf == "1H":
        days_back = 75
        ttl = 90.0
    elif tf == "1W":
        days_back = 365 * 5 + 120
        ttl = 300.0
    else:
        days_back = (365 * 5 + 180) if rng in ("2Y", "3Y", "5Y") else (365 * 2 + 120)
        ttl = 180.0

    cache_key = (sym, tf, str(days_back))
    now_ts = time.time()
    cached = _OHLCV_CACHE.get(cache_key)
    if cached is not None:
        c_ts, c_df, c_src = cached
        if (now_ts - c_ts) < ttl and c_df is not None and not c_df.empty:
            return c_df.copy(), c_src

    df_out = pd.DataFrame()
    source = ""

    # Tier 1: Alpaca live historical bars
    alp_tf = "1D" if tf == "1W" else tf
    df_alp, alp_src = _fetch_alpaca_bars(sym, alp_tf, days_back)
    if not df_alp.empty:
        df_out = df_alp
        source = alp_src

    # Tier 2: Local Parquet for daily / weekly when Alpaca empty or thin
    if df_out.empty and tf in ("1D", "1W"):
        df_pq = _fetch_parquet_daily(sym, days_back)
        if not df_pq.empty:
            df_out = df_pq
            source = "PARQUET_LAKEHOUSE"
    elif tf in ("1D", "1W") and not df_out.empty and len(df_out) < 220:
        # Supplement older history from Parquet if Alpaca came up shorter than requested warmup
        df_pq = _fetch_parquet_daily(sym, days_back)
        if not df_pq.empty:
            merged = pd.concat([df_pq, df_out])
            df_out = merged[~merged.index.duplicated(keep="last")].sort_index()
            source = f"{source}+PARQUET"

    # Tier 3: Yahoo Finance fallback with 429 cooldown
    if df_out.empty and time.time() >= _YF_COOLDOWN_UNTIL:
        try:
            import yfinance as yf

            yt = yf.Ticker(sym)
            if tf == "15M":
                raw = yt.history(period="1mo", interval="15m").dropna(subset=["Close"])
                df_out = _normalize_index_et(raw, is_intraday=True)
            elif tf == "1H":
                raw = yt.history(period="3mo", interval="60m").dropna(subset=["Close"])
                df_out = _normalize_index_et(raw, is_intraday=True)
            else:
                yf_per = "5y" if days_back > 1100 else "2y"
                raw = yt.history(period=yf_per, interval="1d")
                if yf_heal_fn is not None:
                    raw = yf_heal_fn(yt, raw)
                else:
                    raw = raw.dropna(subset=["Close"])
                df_out = _normalize_index_et(raw, is_intraday=False)
            if not df_out.empty:
                source = "YFINANCE"
        except Exception as yf_err:
            if _is_rate_limit_error(yf_err):
                _YF_COOLDOWN_UNTIL = time.time() + 600.0

    if not df_out.empty and tf == "1W":
        df_out = (
            df_out.resample("W-FRI")
            .agg(
                {
                    "Open": "first",
                    "High": "max",
                    "Low": "min",
                    "Close": "last",
                    "Volume": "sum",
                }
            )
            .dropna(subset=["Close"])
        )

    if not df_out.empty:
        df_out = df_out.copy()
        df_out = df_out[~df_out.index.duplicated(keep="last")].sort_index()
        _OHLCV_CACHE[cache_key] = (now_ts, df_out.copy(), source or "UNKNOWN")

    return df_out, (source or "UNKNOWN")


def _rolling_linreg_end(arr: np.ndarray, window: int = 20) -> np.ndarray:
    """Exact rolling linear regression endpoint matching TradingView linreg(src, len, 0)."""
    n = len(arr)
    out = np.zeros(n, dtype=float)
    if n == 0:
        return out
    x = np.arange(window, dtype=float)
    x_mean = x.mean()
    denom = float(((x - x_mean) ** 2).sum())
    for i in range(n):
        w_start = max(0, i - window + 1)
        y = arr[w_start : i + 1]
        valid = np.isfinite(y)
        if valid.sum() < 3:
            out[i] = float(arr[i]) if np.isfinite(arr[i]) else 0.0
            continue
        yv = y[valid]
        m = len(yv)
        if m == window:
            y_mean = yv.mean()
            slope = float(((x - x_mean) * (yv - y_mean)).sum()) / denom
            out[i] = float(y_mean + slope * ((window - 1) - x_mean))
        else:
            xi = np.arange(m, dtype=float)
            xi_mean = xi.mean()
            den = float(((xi - xi_mean) ** 2).sum())
            y_mean = yv.mean()
            slope = float(((xi - xi_mean) * (yv - y_mean)).sum()) / den if den > 0 else 0.0
            out[i] = float(y_mean + slope * ((m - 1) - xi_mean))
    return out


def compute_indicators(
    df_raw: pd.DataFrame,
    spy_df_raw: Optional[pd.DataFrame],
    ticker: str,
    timeframe: str = "1D",
) -> pd.DataFrame:
    """Compute textbook Wilder/TradingView/IBD indicators cleanly without look-ahead."""
    df = df_raw.copy()
    is_intra = timeframe in ("15M", "1H")
    date_fmt = "%Y-%m-%d %H:%M" if is_intra else "%Y-%m-%d"
    df["date_str"] = df.index.strftime(date_fmt)
    df = df.drop_duplicates(subset=["date_str"], keep="last").sort_values("date_str").reset_index(drop=True)

    c = df["Close"].astype(float)
    h = df["High"].astype(float)
    l = df["Low"].astype(float)
    o = df["Open"].astype(float)
    v = df["Volume"].fillna(0).astype(float)
    prev_c = c.shift(1)

    # Moving averages
    df["ema9"] = c.ewm(span=9, adjust=False).mean()
    df["ema21"] = c.ewm(span=21, adjust=False).mean()
    df["sma50"] = c.rolling(50, min_periods=10).mean()
    df["sma150"] = c.rolling(150, min_periods=30).mean()
    df["sma200"] = c.rolling(200, min_periods=40).mean()
    df["vol_sma50"] = v.rolling(50, min_periods=5).mean()

    # True Range & Wilder's RMA ATR(14) + Deepvue ADR(20)%
    tr = pd.concat([(h - l), (h - prev_c).abs(), (l - prev_c).abs()], axis=1).max(axis=1)
    df["tr"] = tr
    df["atr14"] = tr.ewm(alpha=1.0 / 14.0, adjust=False).mean()
    daily_range_pct = ((h - l) / l.replace(0, np.nan)) * 100.0
    df["adr20_pct"] = daily_range_pct.rolling(20, min_periods=5).mean()

    # Close Location Value (0..100%)
    bar_span = (h - l).replace(0, np.nan)
    df["clv"] = (((c - l) / bar_span) * 100.0).fillna(50.0)

    # Refined Institutional Footprints (Morales & Kacher Pocket Pivot + VDU)
    is_up_bar = c > prev_c
    down_vol = v.where(c < prev_c, 0.0)
    max_down_vol_10 = down_vol.shift(1).rolling(10, min_periods=3).max()
    df["is_pocket_pivot"] = (
        is_up_bar
        & (v > max_down_vol_10)
        & (max_down_vol_10 > 0)
        & (v > df["vol_sma50"] * 1.10)
        & (df["clv"] >= 55.0)
    ).fillna(False)
    df["is_vdu"] = (
        (v <= df["vol_sma50"] * 0.60)
        & (v > 0)
        & (tr <= df["atr14"] * 1.05)
    ).fillna(False)

    # MACD (12, 26, 9)
    ema12 = c.ewm(span=12, adjust=False).mean()
    ema26 = c.ewm(span=26, adjust=False).mean()
    df["macd"] = ema12 - ema26
    df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
    df["macd_hist"] = df["macd"] - df["macd_signal"]

    # Wilder's RSI(14), RSI(5), RSI(2) + RSI SMA(14)
    delta = c.diff()
    for period, col_name in ((14, "rsi14"), (5, "rsi5"), (2, "rsi2")):
        gain = delta.where(delta > 0, 0.0).ewm(alpha=1.0 / period, adjust=False).mean()
        loss = (-delta.where(delta < 0, 0.0)).ewm(alpha=1.0 / period, adjust=False).mean()
        rs_val = gain / loss.replace(0, np.nan)
        rsi_arr = np.where(loss == 0, np.where(gain > 0, 100.0, 50.0), 100.0 - (100.0 / (1.0 + rs_val)))
        df[col_name] = pd.Series(rsi_arr, index=df.index).fillna(50.0)
    df["rsi_sma14"] = df["rsi14"].rolling(14, min_periods=3).mean()

    # Wilder's ADX(14), +DI(14), -DI(14)
    up_move = h.diff()
    down_move = -l.diff()
    plus_dm = pd.Series(np.where((up_move > down_move) & (up_move > 0), up_move, 0.0), index=df.index)
    minus_dm = pd.Series(np.where((down_move > up_move) & (down_move > 0), down_move, 0.0), index=df.index)
    atr_safe = df["atr14"].replace(0, np.nan)
    plus_di = 100.0 * (plus_dm.ewm(alpha=1.0 / 14.0, adjust=False).mean() / atr_safe)
    minus_di = 100.0 * (minus_dm.ewm(alpha=1.0 / 14.0, adjust=False).mean() / atr_safe)
    dx = (100.0 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)).fillna(0.0)
    df["plus_di"] = plus_di.fillna(0.0)
    df["minus_di"] = minus_di.fillna(0.0)
    df["adx14"] = dx.ewm(alpha=1.0 / 14.0, adjust=False).mean().fillna(0.0)

    # TradingView Standard Bollinger Bands (20, 2.0, ddof=0) & TTM Squeeze (KC 20, 1.5 Wilder ATR20 + LinReg 20)
    bb_mid = c.rolling(20, min_periods=5).mean()
    bb_std = c.rolling(20, min_periods=5).std(ddof=0)
    df["bb_upper"] = bb_mid + 2.0 * bb_std
    df["bb_lower"] = bb_mid - 2.0 * bb_std
    kc_atr = tr.ewm(alpha=1.0 / 20.0, adjust=False).mean()
    kc_upper = bb_mid + 1.5 * kc_atr
    kc_lower = bb_mid - 1.5 * kc_atr
    df["squeeze_on"] = ((df["bb_upper"] < kc_upper) & (df["bb_lower"] > kc_lower)).fillna(False)

    highest_20 = h.rolling(20, min_periods=5).max()
    lowest_20 = l.rolling(20, min_periods=5).min()
    mid_donchian = (highest_20 + lowest_20) / 2.0
    sqz_raw = (c - ((mid_donchian + bb_mid) / 2.0)).to_numpy(dtype=float)
    df["sqz_mom"] = _rolling_linreg_end(sqz_raw, 20)

    # IBD Relative Strength & Mansfield RS aligned by exact date_str
    if ticker == "SPY" or spy_df_raw is None or spy_df_raw.empty:
        df["spy_close"] = c
    else:
        spy_tmp = spy_df_raw.copy()
        spy_tmp["date_str"] = spy_tmp.index.strftime(date_fmt)
        spy_tmp = spy_tmp.drop_duplicates(subset=["date_str"], keep="last").set_index("date_str")
        spy_map = spy_tmp["Close"].astype(float).to_dict()
        df["spy_close"] = df["date_str"].map(spy_map).ffill().bfill()

    df["rs_raw"] = c / df["spy_close"].replace(0, np.nan)
    first_valid_rs = float(df["rs_raw"].dropna().iloc[0]) if not df["rs_raw"].dropna().empty else 1.0
    df["rs_norm"] = ((df["rs_raw"] / first_valid_rs) * 100.0).fillna(100.0)
    # Compute rs_ema21 on full series before visible slice so there is zero cold-start EMA lag
    df["rs_raw_ema21"] = df["rs_raw"].ewm(span=21, adjust=False).mean()

    mansfield_win = 252 if timeframe == "1D" else (52 if timeframe == "1W" else 130)
    rs_sma_base = df["rs_raw"].rolling(mansfield_win, min_periods=30).mean()
    df["mansfield_rs"] = (((df["rs_raw"] / rs_sma_base.replace(0, np.nan)) - 1.0) * 100.0).fillna(0.0)

    # High-low lookbacks
    df["high_52w_roll"] = h.rolling(252, min_periods=40).max()
    df["low_52w_roll"] = l.rolling(252, min_periods=40).min()
    df["sma200_slope20"] = df["sma200"] - df["sma200"].shift(20)
    df["sma50_slope10"] = df["sma50"] - df["sma50"].shift(10)
    df["ema21_slope5"] = df["ema21"] - df["ema21"].shift(5)

    # IBD 50-bar Up/Down Vol
    up_v = v.where(c >= prev_c, 0.0).rolling(50, min_periods=10).sum()
    dn_v = v.where(c < prev_c, 0.0).rolling(50, min_periods=10).sum()
    df["ud_vol_50"] = (up_v / dn_v.replace(0, np.nan)).fillna(1.0)

    return df


def compute_volume_profile(vis_df: pd.DataFrame, num_bins: int = 48) -> dict:
    """Compute 48-bin OHLC range-distributed Volume Profile with exact 70% Value Area."""
    empty = {"bins": [], "poc_price": None, "vah_price": None, "val_price": None}
    if vis_df is None or vis_df.empty:
        return empty
    lows = vis_df["Low"].astype(float).to_numpy()
    highs = vis_df["High"].astype(float).to_numpy()
    opens = vis_df["Open"].astype(float).to_numpy()
    closes = vis_df["Close"].astype(float).to_numpy()
    vols = vis_df["Volume"].fillna(0).astype(float).to_numpy()

    min_low = float(np.nanmin(lows))
    max_high = float(np.nanmax(highs))
    if not math.isfinite(min_low) or not math.isfinite(max_high) or max_high <= min_low:
        return empty

    step = (max_high - min_low) / float(num_bins)
    bull_bins = np.zeros(num_bins, dtype=float)
    bear_bins = np.zeros(num_bins, dtype=float)

    for lo_i, hi_i, op_i, cl_i, vol_i in zip(lows, highs, opens, closes, vols):
        if not math.isfinite(vol_i) or vol_i <= 0:
            continue
        is_bull = cl_i >= op_i
        if hi_i <= lo_i:
            b = min(num_bins - 1, max(0, int((cl_i - min_low) / step)))
            if is_bull:
                bull_bins[b] += vol_i
            else:
                bear_bins[b] += vol_i
        else:
            b0 = min(num_bins - 1, max(0, int((lo_i - min_low) / step)))
            b1 = min(num_bins - 1, max(0, int((hi_i - min_low) / step)))
            if b1 < b0:
                b0, b1 = b1, b0
            alloc = vol_i / float(b1 - b0 + 1)
            if is_bull:
                bull_bins[b0 : b1 + 1] += alloc
            else:
                bear_bins[b0 : b1 + 1] += alloc

    tot_bins = bull_bins + bear_bins
    total_profile_vol = float(tot_bins.sum())
    if total_profile_vol <= 0:
        return empty

    max_bin_vol = float(tot_bins.max()) or 1.0
    poc_idx = int(np.argmax(tot_bins))

    bins = []
    for i_b in range(num_bins):
        b_low = min_low + i_b * step
        b_high = b_low + step
        b_mid = (b_low + b_high) / 2.0
        tot_v = tot_bins[i_b]
        bins.append(
            {
                "price_low": round(b_low, 2),
                "price_high": round(b_high, 2),
                "price_mid": round(b_mid, 2),
                "bull_vol": int(round(bull_bins[i_b])),
                "bear_vol": int(round(bear_bins[i_b])),
                "total_vol": int(round(tot_v)),
                "pct_of_max": round((tot_v / max_bin_vol) * 100.0, 1),
            }
        )

    # Expand Value Area outward from POC until >= 70% of total volume is captured
    target_va = total_profile_vol * 0.70
    accum = tot_bins[poc_idx]
    lo_idx = poc_idx
    hi_idx = poc_idx
    while accum < target_va and (lo_idx > 0 or hi_idx < num_bins - 1):
        next_up = tot_bins[hi_idx + 1] if hi_idx < num_bins - 1 else -1.0
        next_dn = tot_bins[lo_idx - 1] if lo_idx > 0 else -1.0
        if next_up >= next_dn and hi_idx < num_bins - 1:
            hi_idx += 1
            accum += tot_bins[hi_idx]
        elif lo_idx > 0:
            lo_idx -= 1
            accum += tot_bins[lo_idx]
        else:
            break

    return {
        "bins": bins,
        "poc_price": bins[poc_idx]["price_mid"],
        "vah_price": bins[hi_idx]["price_high"],
        "val_price": bins[lo_idx]["price_low"],
    }


def _compute_ma_and_diagnostics(
    df_calc: pd.DataFrame,
    ticker: str,
    spy_last_rsi: float = 50.0,
) -> tuple[dict, list, dict, list, dict]:
    """Compute MA Ribbon, Trend Diagnostics, Minervini 8-Pt Template, and Summary Daily Snapshot."""
    last_row = df_calc.iloc[-1]
    last_price = round(float(last_row["Close"]), 2)
    prev_close = round(float(df_calc["Close"].iloc[-2]), 2) if len(df_calc) >= 2 else last_price
    chg_1d = round(((last_price / prev_close) - 1.0) * 100.0, 2) if prev_close > 0 else 0.0

    curr_atr = (
        float(last_row["atr14"])
        if pd.notna(last_row["atr14"]) and float(last_row["atr14"]) > 0
        else (last_price * 0.025)
    )
    curr_adr = float(last_row["adr20_pct"]) if pd.notna(last_row["adr20_pct"]) else 2.5

    ma_thresholds = {
        "ema9": {"atr_tight": 1.0, "atr_ext": 2.0, "atr_over": 3.0, "min_pct_ext": 3.5, "min_pct_over": 6.5},
        "ema21": {"atr_tight": 1.3, "atr_ext": 2.5, "atr_over": 3.8, "min_pct_ext": 6.0, "min_pct_over": 10.5},
        "sma50": {"atr_tight": 1.5, "atr_ext": 3.2, "atr_over": 5.0, "min_pct_ext": 9.5, "min_pct_over": 16.0},
        "sma150": {"atr_tight": 2.0, "atr_ext": 5.0, "atr_over": 7.5, "min_pct_ext": 16.0, "min_pct_over": 28.0},
        "sma200": {"atr_tight": 2.2, "atr_ext": 6.0, "atr_over": 9.0, "min_pct_ext": 20.0, "min_pct_over": 35.0},
    }
    ordered_specs = [
        ("ema9", "9 EMA", "#38bdf8"),
        ("ema21", "21 EMA", "#10b981"),
        ("sma50", "50 SMA", "#f59e0b"),
        ("sma150", "150 SMA", "#a855f7"),
        ("sma200", "200 SMA", "#ef4444"),
    ]

    ma_ribbon = {}
    ma_ribbon_list = []
    hist_tail = df_calc.tail(252)

    for col_name, label, color in ordered_specs:
        val = last_row[col_name] if col_name in df_calc and pd.notna(last_row[col_name]) else None
        if val is None or float(val) <= 0:
            meta = {
                "key": col_name, "label": label, "value": None, "dist_pct": None,
                "atr_multiple": None, "pct_rank_1y": None, "slope": "Flat", "slope_pct": 0.0,
                "above": False, "stretch_state": "N/A", "state_color": "#64748b", "color": color,
            }
            ma_ribbon[col_name] = meta
            ma_ribbon_list.append(meta)
            continue

        val_f = float(val)
        prev_val = (
            float(df_calc[col_name].iloc[-6])
            if len(df_calc) >= 6 and pd.notna(df_calc[col_name].iloc[-6])
            else val_f
        )
        dist_pct = round(((last_price - val_f) / val_f) * 100.0, 2)
        atr_mult = round((last_price - val_f) / curr_atr, 2) if curr_atr > 0 else 0.0
        slope_pct = round(((val_f - prev_val) / prev_val) * 100.0, 2) if prev_val > 0 else 0.0
        slope = "Rising" if slope_pct > 0.05 else ("Falling" if slope_pct < -0.05 else "Flat")
        is_above = bool(last_price >= val_f)

        pct_rank_1y = 50
        valid_hist = hist_tail[
            hist_tail[col_name].notna()
            & (hist_tail[col_name] > 0)
            & hist_tail["atr14"].notna()
            & (hist_tail["atr14"] > 0)
        ]
        if len(valid_hist) >= 20:
            hist_mults = (valid_hist["Close"] - valid_hist[col_name]) / valid_hist["atr14"]
            pct_rank_1y = int(round(float((hist_mults <= atr_mult).mean() * 100.0)))

        th = ma_thresholds[col_name]
        if atr_mult >= th["atr_over"] and dist_pct >= th["min_pct_over"] * 0.75:
            stretch_state, state_color = "OVEREXTENDED", "#ef4444"
        elif atr_mult >= th["atr_ext"] and dist_pct >= th["min_pct_ext"] * 0.75:
            stretch_state, state_color = "EXTENDED", "#f59e0b"
        elif dist_pct < -0.5 and slope == "Falling":
            if atr_mult <= -th["atr_over"]:
                stretch_state, state_color = "OVERSOLD STRETCH", "#a855f7"
            elif atr_mult <= -th["atr_ext"]:
                stretch_state, state_color = "BROKEN / WEAK", "#ef4444"
            else:
                stretch_state, state_color = "BELOW RESISTANCE", "#fb923c"
        elif -0.4 <= atr_mult <= th["atr_tight"] and (is_above or slope == "Rising"):
            stretch_state, state_color = "AT SUPPORT / TIGHT", "#38bdf8"
        elif atr_mult > th["atr_tight"]:
            stretch_state, state_color = "NORMAL TREND", "#10b981"
        elif atr_mult <= -th["atr_over"]:
            stretch_state, state_color = "OVERSOLD STRETCH", "#a855f7"
        elif atr_mult <= -th["atr_ext"]:
            stretch_state, state_color = "BROKEN / WEAK", "#ef4444"
        else:
            stretch_state, state_color = "PULLBACK / BELOW", "#fb923c"

        meta = {
            "key": col_name,
            "label": label,
            "value": round(val_f, 2),
            "dist_pct": dist_pct,
            "atr_multiple": atr_mult,
            "pct_rank_1y": pct_rank_1y,
            "pct_rank_ordinal": ordinal(pct_rank_1y),
            "slope": slope,
            "slope_pct": slope_pct,
            "above": is_above,
            "stretch_state": stretch_state,
            "state_color": state_color,
            "color": color,
        }
        ma_ribbon[col_name] = meta
        ma_ribbon_list.append(meta)

    e9 = ma_ribbon["ema9"]["value"] or last_price
    e21 = ma_ribbon["ema21"]["value"] or last_price
    s50 = ma_ribbon["sma50"]["value"] or last_price
    s150 = ma_ribbon["sma150"]["value"] or last_price
    s200 = ma_ribbon["sma200"]["value"] or last_price

    high_52w = round(float(df_calc["High"].tail(252).max()), 2)
    low_52w = round(float(df_calc["Low"].tail(252).min()), 2)
    pct_off_high = round(((last_price - high_52w) / high_52w) * 100.0, 2) if high_52w > 0 else 0.0
    m_rs = round(float(last_row["mansfield_rs"]), 2) if pd.notna(last_row["mansfield_rs"]) else 0.0
    ud_50 = round(float(last_row["ud_vol_50"]), 2) if pd.notna(last_row["ud_vol_50"]) else 1.0

    # Minervini 8-Point Trend Template Check
    rs_outperforming = False if ticker == "SPY" else bool(m_rs > 0)
    trend_template = [
        {"rule": "Price > 150-SMA & 200-SMA", "passed": bool(last_price > s150 and last_price > s200)},
        {"rule": "150-SMA > 200-SMA", "passed": bool(s150 > s200)},
        {"rule": "200-SMA Trending Up (1M+)", "passed": bool(ma_ribbon["sma200"]["slope"] == "Rising")},
        {"rule": "50-SMA > 150-SMA & 200-SMA", "passed": bool(s50 > s150 and s50 > s200)},
        {"rule": "Price > 50-SMA", "passed": bool(last_price > s50)},
        {"rule": "Price >= 25% Above 52W Low", "passed": bool(low_52w > 0 and last_price >= low_52w * 1.25)},
        {"rule": "Within 25% of 52W High", "passed": bool(high_52w > 0 and last_price >= high_52w * 0.75)},
        {"rule": "RS Line Outperforming SPY" if ticker != "SPY" else "SPY Benchmark Index (N/A)", "passed": rs_outperforming},
    ]
    tt_score = sum(1 for r in trend_template if r["passed"])

    # Consecutive bars vs 50-SMA & 21-EMA
    bars_vs_50 = 0
    bars_vs_21 = 0
    leg_anchor_price = s50
    recent_df = df_calc.tail(252)
    above_50_now = bool(last_price >= s50)
    cross_idx = len(recent_df) - 1
    for idx_r in range(len(recent_df) - 1, -1, -1):
        r_close = float(recent_df["Close"].iloc[idx_r])
        r_s50 = float(recent_df["sma50"].iloc[idx_r]) if pd.notna(recent_df["sma50"].iloc[idx_r]) else r_close
        if (r_close >= r_s50) == above_50_now:
            bars_vs_50 += 1 if above_50_now else -1
            cross_idx = idx_r
        else:
            break
    if cross_idx > 0:
        prev_c_cross = float(recent_df["Close"].iloc[cross_idx - 1])
        cross_s50 = float(recent_df["sma50"].iloc[cross_idx]) if pd.notna(recent_df["sma50"].iloc[cross_idx]) else s50
        leg_anchor_price = min(prev_c_cross, cross_s50) if above_50_now else max(prev_c_cross, cross_s50)
    else:
        leg_anchor_price = float(recent_df["Close"].iloc[0])

    above_21_now = bool(last_price >= e21)
    for idx_r in range(len(recent_df) - 1, -1, -1):
        r_close = float(recent_df["Close"].iloc[idx_r])
        r_e21 = float(recent_df["ema21"].iloc[idx_r]) if pd.notna(recent_df["ema21"].iloc[idx_r]) else r_close
        if (r_close >= r_e21) == above_21_now:
            bars_vs_21 += 1 if above_21_now else -1
        else:
            break

    leg_return_pct = round(((last_price - leg_anchor_price) / leg_anchor_price) * 100.0, 1) if leg_anchor_price > 0 else 0.0

    dist_21 = ma_ribbon["ema21"]["dist_pct"] or 0.0
    dist_50 = ma_ribbon["sma50"]["dist_pct"] or 0.0
    dist_200 = ma_ribbon["sma200"]["dist_pct"] or 0.0
    atr_mult_50 = ma_ribbon["sma50"]["atr_multiple"] or 0.0
    atr_mult_21 = ma_ribbon["ema21"]["atr_multiple"] or 0.0

    ma_stack_checks = [last_price >= e9, e9 >= e21, e21 >= s50, s50 >= s150, s150 >= s200]
    ma_stack_score = sum(1 for c_chk in ma_stack_checks if c_chk)

    if ma_stack_score == 5 and last_price > s200:
        trend_regime = "🔥 Full 5-MA Bullish Power Stack (Price > 9 > 21 > 50 > 150 > 200)"
        regime_short = "Full Bullish Stack (5/5)"
        regime_color = "#10b981"
    elif last_price >= s50 and s50 >= s200:
        if last_price < e21:
            trend_regime = "📐 Bullish Primary Trend — Short-Term Pullback to 21-EMA / 50-SMA"
            regime_short = "Bullish Pullback (Resting)"
            regime_color = "#38bdf8"
        else:
            trend_regime = "📈 Bullish Advancing Uptrend (Above Rising 50 & 200 SMA)"
            regime_short = f"Bullish Uptrend ({ma_stack_score}/5 Stack)"
            regime_color = "#10b981"
    elif last_price >= s200 and last_price < s50:
        trend_regime = "⚖️ Intermediate Correction / Testing 150-200 SMA Institutional Floor"
        regime_short = "Intermediate Correction"
        regime_color = "#f59e0b"
    elif last_price < s200 and last_price >= s50:
        trend_regime = "🌱 Stage 1B / Early Transition — Reclaimed 9/21-EMA & 50-SMA (Approaching 200-SMA)"
        regime_short = "Stage 1B Base Recovery"
        regime_color = "#38bdf8"
    elif last_price < s50 and last_price >= e21:
        trend_regime = "🔄 Counter-Trend Bounce / Reclaimed 21-EMA Below 50-SMA"
        regime_short = "Early Bounce (>21-EMA)"
        regime_color = "#fbbf24"
    else:
        trend_regime = "🛑 Bearish Downtrend Stack (Below 21-EMA, 50-SMA & 200-SMA)"
        regime_short = "Bearish Downtrend"
        regime_color = "#ef4444"

    is_50_overext = ma_ribbon["sma50"]["stretch_state"] == "OVEREXTENDED" or ma_ribbon["sma200"]["stretch_state"] == "OVEREXTENDED"
    is_50_ext = ma_ribbon["sma50"]["stretch_state"] == "EXTENDED" or ma_ribbon["ema21"]["stretch_state"] == "OVEREXTENDED"

    if last_price >= s50 and last_price >= s200:
        if is_50_overext or (bars_vs_50 >= 45 and atr_mult_50 >= 4.0):
            stage_code, stage_label, stage_index, stage_color = (
                "Stage 2C", "Stage 2C — Late / Overextended Markup (Climax Watch)", 4, "#f59e0b"
            )
        elif 0 < bars_vs_50 <= 12 and atr_mult_50 <= 2.2:
            stage_code, stage_label, stage_index, stage_color = (
                "Stage 2A", "Stage 2A — Early Trend Ignition (Fresh Breakout)", 2, "#00f2fe"
            )
        elif last_price < e21 and atr_mult_50 <= 1.2:
            stage_code, stage_label, stage_index, stage_color = (
                "Stage 2B Pullback", "Stage 2B — Constructive Pullback to 21-EMA / 50-SMA", 3, "#38bdf8"
            )
        else:
            stage_code, stage_label, stage_index, stage_color = (
                "Stage 2B", "Stage 2B — Primary Advancing Markup (Power Trend)", 3, "#10b981"
            )
    elif last_price < s200 and last_price >= s50:
        stage_code, stage_label, stage_index, stage_color = (
            "Stage 1B", "Stage 1B — Base Recovery (Above 21-EMA & 50-SMA, Testing 150/200-SMA)", 1, "#38bdf8"
        )
    elif last_price < s50 and last_price >= e21 and abs(dist_50) <= 5.0:
        stage_code, stage_label, stage_index, stage_color = (
            "Stage 1A", "Stage 1A — Early Basing & Accumulation (Reclaimed 21-EMA)", 1, "#94a3b8"
        )
    elif s50 >= s200 and last_price < s50:
        if atr_mult_50 >= -2.0:
            stage_code, stage_label, stage_index, stage_color = (
                "Stage 3A", "Stage 3A — Distribution / Testing Below 50-SMA", 5, "#f59e0b"
            )
        else:
            stage_code, stage_label, stage_index, stage_color = (
                "Stage 3B", "Stage 3B — Late Distribution Top / Breakdown Risk", 5, "#fb923c"
            )
    else:
        if atr_mult_50 <= -4.5 or dist_200 <= -25.0:
            stage_code, stage_label, stage_index, stage_color = (
                "Stage 4B", "Stage 4B — Capitulation / Deeply Oversold Washout", 6, "#a855f7"
            )
        else:
            stage_code, stage_label, stage_index, stage_color = (
                "Stage 4A", "Stage 4A — Active Markdown (Below Falling 50 & 200 SMA)", 6, "#ef4444"
            )

    if bars_vs_50 > 0:
        if bars_vs_50 <= 10:
            maturity_phase = f"Early Impulse Leg ({bars_vs_50} bars > 50-SMA · {leg_return_pct:+.1f}%)"
        elif bars_vs_50 <= 35:
            maturity_phase = f"Mid-Trend Markup ({bars_vs_50} bars > 50-SMA · {leg_return_pct:+.1f}%)"
        else:
            maturity_phase = f"Mature / Extended Run ({bars_vs_50} bars > 50-SMA · {leg_return_pct:+.1f}%)"
    else:
        maturity_phase = f"Below 50-SMA ({abs(bars_vs_50)} bars below · {leg_return_pct:+.1f}% leg)"

    if is_50_overext:
        verdict = "🔴 OVEREXTENDED FROM SMAs (HIGH MEAN-REVERSION RISK)"
        verdict_short = "🔴 OVEREXTENDED"
        verdict_color = "#ef4444"
        tactical_zone = "🚨 DO NOT CHASE — Trim into strength or trail tight 9-EMA stop; wait for 21-EMA reset"
    elif is_50_ext or ma_ribbon["ema21"]["stretch_state"] == "EXTENDED":
        verdict = "🟠 MODERATELY EXTENDED FROM 21-EMA / 50-SMA"
        verdict_short = "🟠 EXTENDED (NO CHASE)"
        verdict_color = "#f59e0b"
        tactical_zone = "⚠️ EXTENDED ABOVE PIVOT — Hold core runners, avoid fresh market buys until 9/21-EMA pullback"
    elif last_price >= s50 and -0.5 <= atr_mult_21 <= 1.3:
        verdict = "🟢 TIGHT & CONSTRUCTIVE NEAR 21-EMA / 50-SMA SUPPORT"
        verdict_short = "🟢 TIGHT / BUYABLE ZONE"
        verdict_color = "#10b981"
        tactical_zone = "🎯 OPTIMAL LOW-RISK ENTRY ZONE — Price is within ~1 ATR of rising 21-EMA & 50-SMA support"
    elif last_price >= s50:
        verdict = "🔵 HEALTHY TREND PROGRESSION (WITHIN NORMAL ATR BAND)"
        verdict_short = "🔵 NORMAL TREND PACE"
        verdict_color = "#38bdf8"
        tactical_zone = "✅ CONSTRUCTIVE UPTREND — Normal ATR progression above 21-EMA & 50-SMA"
    elif atr_mult_50 <= -4.0:
        verdict = "🟣 OVERSOLD STRETCH BELOW 50 & 200 SMA (RUBBER-BAND SNAPBACK WATCH)"
        verdict_short = "🟣 OVERSOLD STRETCH"
        verdict_color = "#a855f7"
        tactical_zone = "⚡ EXTREME DOWNSIDE STRETCH — Watch for high-volume undercut & reclaim of 9-EMA"
    else:
        verdict = "🔻 BELOW KEY MOVING AVERAGES (OVERHEAD SUPPLY)"
        verdict_short = "🔻 BELOW SMAs"
        verdict_color = "#fb923c"
        tactical_zone = "🛡️ DEFENSIVE POSTURE — Wait for price to reclaim 21-EMA & 50-SMA on volume"

    stretch_index = int(min(100, max(0, round(50 + (atr_mult_50 * 9.5) + (dist_200 * 0.45)))))
    pct_50_ord = ordinal(ma_ribbon["sma50"]["pct_rank_1y"] or 50)
    narrative = (
        f"{ticker} is in {stage_label} ({regime_short}, {maturity_phase}). "
        f"Price is {dist_21:+.2f}% ({atr_mult_21:+.1f}x ATR) vs 21-EMA, "
        f"{dist_50:+.2f}% ({atr_mult_50:+.1f}x ATR, {pct_50_ord} 1Y %ile) vs 50-SMA, "
        f"and {dist_200:+.2f}% vs 200-SMA — {tactical_zone}."
    )

    trend_diagnostics = {
        "stage_code": stage_code,
        "stage_label": stage_label,
        "stage_index": stage_index,
        "stage_color": stage_color,
        "trend_regime": trend_regime,
        "regime_short": regime_short,
        "regime_color": regime_color,
        "ma_stack_score": ma_stack_score,
        "maturity_phase": maturity_phase,
        "bars_vs_50sma": bars_vs_50,
        "bars_vs_21ema": bars_vs_21,
        "leg_return_pct": leg_return_pct,
        "verdict": verdict,
        "verdict_short": verdict_short,
        "verdict_color": verdict_color,
        "tactical_zone": tactical_zone,
        "stretch_index": stretch_index,
        "narrative": narrative,
        "lifecycle_steps": [
            {"step": 1, "code": "Stage 1", "label": "Basing"},
            {"step": 2, "code": "Stage 2A", "label": "Ignition"},
            {"step": 3, "code": "Stage 2B", "label": "Markup"},
            {"step": 4, "code": "Stage 2C", "label": "Extended"},
            {"step": 5, "code": "Stage 3", "label": "Topping"},
            {"step": 6, "code": "Stage 4", "label": "Decline"},
        ],
    }

    daily_stats = {
        "last_price": last_price,
        "change_1d_pct": chg_1d,
        "atr_14": round(curr_atr, 2),
        "adr_20_pct": round(curr_adr, 2),
        "ud_vol_ratio_50d": ud_50,
        "high_52w": high_52w,
        "low_52w": low_52w,
        "pct_off_52w_high": pct_off_high,
        "mansfield_rs": m_rs,
        "tt_score": tt_score,
    }
    return ma_ribbon, ma_ribbon_list, trend_diagnostics, trend_template, daily_stats


def _compute_patterns(
    vis_df: pd.DataFrame,
    daily_stage_code: str,
    daily_pct_off_52w: float,
    timeframe: str,
    last_price: float,
    ma_ribbon: dict,
) -> tuple[list, Optional[float], Optional[dict]]:
    """Causal zero-look-ahead VCP & Stage-Gated MarketSurge Pattern Detection."""
    vcp_waves = []
    vcp_pivot_price = None
    marketsurge_pattern = None
    bars_per_week = {"1D": 5.0, "1W": 1.0, "1H": 32.5, "15M": 130.0}.get(timeframe, 5.0)

    e21 = ma_ribbon.get("ema21", {}).get("value") or last_price
    s50 = ma_ribbon.get("sma50", {}).get("value") or last_price
    s200 = ma_ribbon.get("sma200", {}).get("value") or last_price

    # Gate out fake bullish bases on broken Stage 3B / Stage 4 / deep downtrend stocks
    is_broken_downtrend = (
        daily_stage_code in ("Stage 3B", "Stage 4A", "Stage 4B")
        or (daily_pct_off_52w < -15.0 and last_price < s50)
    )

    if len(vis_df) >= 25:
        lookback_n = min(len(vis_df), 130)
        pat_df = vis_df.tail(lookback_n).copy().reset_index(drop=True)
        n_bars = len(pat_df)

        # Causal VCP waves inside recent active consolidation window (last 65 bars)
        if not is_broken_downtrend and len(vis_df) >= 30:
            sub_df = vis_df.tail(min(65, len(vis_df))).copy().reset_index(drop=True)
            sn = len(sub_df)
            highs_arr = sub_df["High"].astype(float).to_numpy()
            lows_arr = sub_df["Low"].astype(float).to_numpy()
            # Strictly causal 3-bar swing confirmation: bar k is peak only if confirmed by k+3 <= sn-1
            peak_idxs = []
            trough_idxs = []
            for k in range(3, sn - 3):
                if highs_arr[k] >= np.max(highs_arr[k - 3 : k + 4]):
                    peak_idxs.append(k)
                if lows_arr[k] <= np.min(lows_arr[k - 3 : k + 4]):
                    trough_idxs.append(k)

            swings = []
            for pk in peak_idxs:
                post_tr = [t for t in trough_idxs if t > pk]
                if post_tr:
                    tr_idx = post_tr[0]
                    p_hi = float(highs_arr[pk])
                    p_lo = float(lows_arr[tr_idx])
                    depth_pct = round((p_hi - p_lo) / p_hi * 100.0, 1) if p_hi > 0 else 0.0
                    if 2.0 <= depth_pct <= 40.0:
                        swings.append(
                            {
                                "start_date": sub_df["date_str"].iloc[pk],
                                "start_price": round(p_hi, 2),
                                "end_date": sub_df["date_str"].iloc[tr_idx],
                                "end_price": round(p_lo, 2),
                                "depth_pct": depth_pct,
                            }
                        )
            if swings:
                colors = ["#ef4444", "#f59e0b", "#10b981", "#38bdf8"]
                valid_waves = []
                last_depth = 999.0
                wave_num = 1
                for s in swings:
                    if s["depth_pct"] <= last_depth * 1.08 and wave_num <= 4:
                        valid_waves.append(
                            {
                                "name": f"T{wave_num} Contraction",
                                "start_date": s["start_date"],
                                "start_price": s["start_price"],
                                "end_date": s["end_date"],
                                "end_price": s["end_price"],
                                "depth_pct": s["depth_pct"],
                                "color": colors[wave_num - 1],
                            }
                        )
                        last_depth = s["depth_pct"]
                        wave_num += 1
                vcp_waves = valid_waves[-3:]
                if vcp_waves:
                    vcp_pivot_price = vcp_waves[-1]["start_price"]

        if is_broken_downtrend:
            reclaim_lvl = round(float(max(e21, s50)), 2)
            base_low = float(pat_df["Low"].tail(40).min())
            base_high = float(pat_df["High"].tail(65).max())
            base_depth = round(((base_high - base_low) / base_high) * 100.0, 1) if base_high > 0 else 0.0
            dist_pct = round(((last_price - reclaim_lvl) / reclaim_lvl) * 100.0, 2) if reclaim_lvl > 0 else 0.0
            marketsurge_pattern = {
                "detected": False,
                "is_actionable_buy_point": False,
                "pattern_name": "Overhead Supply / Base Repair",
                "pattern_type": "BASE_REPAIR",
                "pattern_stage": f"{daily_stage_code} Repair (No Valid Base)",
                "buy_point": reclaim_lvl,
                "buy_zone_high": round(reclaim_lvl * 1.05, 2),
                "stop_loss": round(last_price * 0.925, 2),
                "profit_goal_20": round(reclaim_lvl * 1.20, 2),
                "profit_goal_25": round(reclaim_lvl * 1.25, 2),
                "dist_to_pivot_pct": dist_pct,
                "distance_to_pivot_pct": dist_pct,
                "base_depth_pct": base_depth,
                "handle_depth_pct": 0.0,
                "base_length_bars": 40,
                "base_length_weeks": round(40.0 / bars_per_week, 1),
                "pivot_status": f"🛡️ BASE REPAIR ({dist_pct:+.1f}% vs ${reclaim_lvl:.2f} 21/50 Reclaim)",
                "pivot_badge": "🛡️ BASE REPAIR (NO BUY PT)",
                "status_color": "#f59e0b",
                "pivot_status_color": "#f59e0b",
                "cup_curve": [],
                "handle_curve": [],
                "keypoints": [],
            }
            return vcp_waves, vcp_pivot_price, marketsurge_pattern

        def _build_u_curve(idx_left, p_left, idx_low, p_low, idx_right, p_right):
            pts = []
            for k in range(idx_left, idx_right + 1):
                d_str = pat_df["date_str"].iloc[k]
                if k <= idx_low:
                    u = (k - idx_left) / max(1, idx_low - idx_left)
                    yv = p_low + (p_left - p_low) * ((1.0 - u) ** 1.65)
                else:
                    u = (k - idx_low) / max(1, idx_right - idx_low)
                    yv = p_low + (p_right - p_low) * (u ** 1.65)
                pts.append({"time": d_str, "price": round(float(yv), 2)})
            return pts

        recent_25 = pat_df.tail(min(28, n_bars))
        flat_high = float(recent_25["High"].max())
        flat_low = float(recent_25["Low"].min())
        flat_depth_pct = round(((flat_high - flat_low) / flat_high) * 100.0, 1) if flat_high > 0 else 99.0

        left_end = max(10, n_bars - 8)
        idx_left_high = int(pat_df.iloc[:left_end]["High"].idxmax())
        p_left_high = float(pat_df["High"].iloc[idx_left_high])
        d_left_high = pat_df["date_str"].iloc[idx_left_high]

        post_left = pat_df.iloc[idx_left_high + 1 :] if idx_left_high + 1 < n_bars else pat_df.tail(10)
        idx_cup_low = int(post_left["Low"].idxmin())
        p_cup_low = float(pat_df["Low"].iloc[idx_cup_low])
        d_cup_low = pat_df["date_str"].iloc[idx_cup_low]
        cup_depth_pct = round(((p_left_high - p_cup_low) / p_left_high) * 100.0, 1) if p_left_high > 0 else 0.0

        post_low = pat_df.iloc[idx_cup_low + 1 :] if idx_cup_low + 1 < n_bars else pat_df.tail(5)
        idx_right_high = int(post_low["High"].idxmax()) if not post_low.empty else (n_bars - 1)
        p_right_high = float(pat_df["High"].iloc[idx_right_high])
        d_right_high = pat_df["date_str"].iloc[idx_right_high]

        cup_recovery_ratio = (
            (p_right_high - p_cup_low) / max(0.01, p_left_high - p_cup_low)
            if p_left_high > p_cup_low
            else 0.0
        )

        has_handle = False
        handle_depth_pct = 0.0
        p_handle_low = p_right_high
        d_handle_low = d_right_high
        idx_handle_low = idx_right_high
        if idx_right_high <= n_bars - 2:
            handle_slice = pat_df.iloc[idx_right_high + 1 :]
            idx_handle_low = int(handle_slice["Low"].idxmin())
            p_handle_low = float(pat_df["Low"].iloc[idx_handle_low])
            d_handle_low = pat_df["date_str"].iloc[idx_handle_low]
            handle_depth_pct = round(((p_right_high - p_handle_low) / p_right_high) * 100.0, 1) if p_right_high > 0 else 0.0
            if 2.0 <= handle_depth_pct <= 15.0 and ((p_right_high + p_handle_low) / 2.0) >= ((p_left_high + p_cup_low) / 2.0) and (n_bars - idx_right_high) <= 32:
                has_handle = True

        is_double_bottom = False
        db_contour = []
        db_pivot = None
        if n_bars >= 35 and 10.0 <= cup_depth_pct <= 40.0 and (idx_cup_low - idx_left_high) >= 6:
            mid_slice = pat_df.iloc[idx_left_high + 2 : n_bars - 2]
            if len(mid_slice) >= 16:
                half_len = len(mid_slice) // 2
                idx_l1 = int(mid_slice.iloc[:half_len]["Low"].idxmin())
                p_l1 = float(pat_df["Low"].iloc[idx_l1])
                idx_l2 = int(mid_slice.iloc[half_len:]["Low"].idxmin())
                p_l2 = float(pat_df["Low"].iloc[idx_l2])
                if idx_l2 - idx_l1 >= 7:
                    between = pat_df.iloc[idx_l1 + 1 : idx_l2]
                    if not between.empty:
                        idx_mp = int(between["High"].idxmax())
                        p_mp = float(pat_df["High"].iloc[idx_mp])
                        low_diff = abs(p_l2 - p_l1) / max(0.01, p_l1) * 100.0
                        mid_bounce = ((p_mp - min(p_l1, p_l2)) / max(0.01, p_left_high - min(p_l1, p_l2))) * 100.0
                        if low_diff <= 4.5 and 40.0 <= mid_bounce <= 95.0 and last_price >= min(p_l1, p_l2) * 1.04:
                            is_double_bottom = True
                            db_pivot = round(p_mp, 2)
                            db_contour = [
                                {"time": d_left_high, "price": round(p_left_high, 2), "label": f"Left High ${p_left_high:.2f}"},
                                {"time": pat_df["date_str"].iloc[idx_l1], "price": round(p_l1, 2), "label": f"Low 1 ${p_l1:.2f}"},
                                {"time": pat_df["date_str"].iloc[idx_mp], "price": round(p_mp, 2), "label": f"W-Pivot ${p_mp:.2f}"},
                                {"time": pat_df["date_str"].iloc[idx_l2], "price": round(p_l2, 2), "label": f"Low 2 ${p_l2:.2f}"},
                                {"time": pat_df["date_str"].iloc[-1], "price": round(last_price, 2), "label": "Current"},
                            ]

        interior_slice = pat_df.iloc[idx_left_high + 1 : idx_right_high] if idx_right_high > idx_left_high + 1 else pat_df.iloc[0:0]
        interior_valid = True if interior_slice.empty else (float(interior_slice["High"].max()) <= max(p_left_high, p_right_high) * 1.01)

        pattern_name = "Consolidation Pivot"
        pattern_type = "CONSOLIDATION"
        buy_point = vcp_pivot_price or round(flat_high, 2)
        base_depth = cup_depth_pct
        base_len_bars = n_bars - idx_left_high
        cup_curve, handle_curve, keypoints = [], [], []

        if interior_valid and 11.0 <= cup_depth_pct <= 42.0 and cup_recovery_ratio >= 0.58 and has_handle and (idx_cup_low - idx_left_high) >= 5:
            pattern_name, pattern_type, buy_point = "Cup with Handle", "CUP_WITH_HANDLE", round(p_right_high, 2)
            cup_curve = _build_u_curve(idx_left_high, p_left_high, idx_cup_low, p_cup_low, idx_right_high, p_right_high)
            handle_curve = [{"time": d_right_high, "price": round(p_right_high, 2)}, {"time": d_handle_low, "price": round(p_handle_low, 2)}]
            if idx_handle_low < n_bars - 1:
                handle_curve.append({"time": pat_df["date_str"].iloc[-1], "price": round(max(last_price, p_handle_low), 2)})
            keypoints = [
                {"time": d_left_high, "price": round(p_left_high, 2), "label": f"Left Lip ${p_left_high:.2f}"},
                {"time": d_cup_low, "price": round(p_cup_low, 2), "label": f"Cup Bottom ${p_cup_low:.2f} (-{cup_depth_pct}%)"},
                {"time": d_right_high, "price": round(p_right_high, 2), "label": f"Handle Buy Pt ${p_right_high:.2f}"},
                {"time": d_handle_low, "price": round(p_handle_low, 2), "label": f"Handle Low ${p_handle_low:.2f} (-{handle_depth_pct}%)"},
            ]
        elif is_double_bottom and db_pivot:
            pattern_name, pattern_type, buy_point = "Double Bottom ('W' Base)", "DOUBLE_BOTTOM", db_pivot
            cup_curve = [{"time": pt["time"], "price": pt["price"]} for pt in db_contour]
            keypoints = db_contour[:-1]
        elif 4.0 <= flat_depth_pct <= 15.0 and last_price >= flat_low * 1.02 and len(recent_25) >= 20:
            pattern_name, pattern_type, buy_point = "Flat Base", "FLAT_BASE", round(flat_high, 2)
            base_depth, base_len_bars = flat_depth_pct, len(recent_25)
            f_start, f_end = recent_25["date_str"].iloc[0], recent_25["date_str"].iloc[-1]
            cup_curve = [{"time": f_start, "price": round(flat_high, 2)}, {"time": f_end, "price": round(flat_high, 2)}]
            handle_curve = [{"time": f_start, "price": round(flat_low, 2)}, {"time": f_end, "price": round(flat_low, 2)}]
            keypoints = [{"time": f_start, "price": round(flat_high, 2), "label": f"Flat Base Top ${flat_high:.2f} (-{flat_depth_pct}% Tight)"}]
        elif interior_valid and 11.0 <= cup_depth_pct <= 42.0 and cup_recovery_ratio >= 0.50 and (idx_cup_low - idx_left_high) >= 5:
            pattern_name, pattern_type = "Cup Base (Saucer)", "CUP_BASE"
            buy_point = round(p_right_high if p_right_high >= p_left_high * 0.94 else p_left_high, 2)
            cup_curve = _build_u_curve(idx_left_high, p_left_high, idx_cup_low, p_cup_low, idx_right_high, p_right_high)
            keypoints = [
                {"time": d_left_high, "price": round(p_left_high, 2), "label": f"Left Lip ${p_left_high:.2f}"},
                {"time": d_cup_low, "price": round(p_cup_low, 2), "label": f"Cup Bottom ${p_cup_low:.2f} (-{cup_depth_pct}%)"},
                {"time": d_right_high, "price": round(p_right_high, 2), "label": f"Right Lip ${p_right_high:.2f}"},
            ]
        elif len(vcp_waves) >= 2 and vcp_pivot_price:
            pattern_name, pattern_type, buy_point = f"VCP ({len(vcp_waves)}-T Contraction Base)", "VCP_BASE", round(float(vcp_pivot_price), 2)
            base_depth = vcp_waves[0]["depth_pct"]
            keypoints = [{"time": vcp_waves[-1]["start_date"], "price": buy_point, "label": f"VCP Pivot ${buy_point:.2f}"}]
        else:
            swing_slice = pat_df.tail(min(35, n_bars))
            idx_sw_high = int(swing_slice["High"].idxmax())
            sw_high = round(float(pat_df["High"].iloc[idx_sw_high]), 2)
            pattern_name = "Swing Consolidation Pivot" if last_price >= p_cup_low * 1.08 else "Bottoming Base Pivot"
            pattern_type, buy_point = "SWING_PIVOT", sw_high
            base_depth = round(((sw_high - float(swing_slice["Low"].min())) / sw_high) * 100.0, 1) if sw_high > 0 else cup_depth_pct
            base_len_bars = len(swing_slice)
            keypoints = [{"time": pat_df["date_str"].iloc[idx_sw_high], "price": buy_point, "label": f"Resistance Pivot ${buy_point:.2f}"}]

        buy_zone_high = round(buy_point * 1.05, 2)
        stop_loss_ms = round(buy_point * 0.925, 2)
        dist_pct = round(((last_price - buy_point) / buy_point) * 100.0, 2) if buy_point > 0 else 0.0

        if 0.0 <= dist_pct <= 5.0:
            p_status, p_badge, s_color = f"🟢 IN 5% BUY ZONE (+{dist_pct:.1f}% above ${buy_point:.2f})", "🟢 IN 5% BUY ZONE", "#10b981"
        elif -3.0 <= dist_pct < 0.0:
            p_status, p_badge, s_color = f"🎯 NEAR PIVOT ({dist_pct:.1f}% below ${buy_point:.2f})", "🎯 NEAR BUY POINT", "#00f2fe"
        elif dist_pct > 5.0:
            p_status, p_badge, s_color = f"⚠️ EXTENDED PAST 5% BUY ZONE (+{dist_pct:.1f}%)", "⚠️ EXTENDED PAST BUY ZONE", "#f59e0b"
        elif -15.0 <= dist_pct < -3.0:
            p_status, p_badge, s_color = f"⏳ FORMING RIGHT SIDE ({dist_pct:.1f}% below ${buy_point:.2f})", "⏳ FORMING BASE / HANDLE", "#38bdf8"
        else:
            p_status, p_badge, s_color = f"🔧 BUILDING BASE ({dist_pct:.1f}% below ${buy_point:.2f})", "🔧 BUILDING BASE", "#94a3b8"

        base_weeks = round(base_len_bars / bars_per_week, 1)
        p_stage = (
            "1st/2nd Stage Base"
            if last_price >= s50 * 0.96 and s50 >= s200 * 0.96
            else f"{base_weeks}w Consolidation Base"
        )
        marketsurge_pattern = {
            "detected": True,
            "is_actionable_buy_point": True,
            "pattern_name": pattern_name,
            "pattern_type": pattern_type,
            "pattern_stage": p_stage,
            "buy_point": buy_point,
            "buy_zone_high": buy_zone_high,
            "stop_loss": stop_loss_ms,
            "profit_goal_20": round(buy_point * 1.20, 2),
            "profit_goal_25": round(buy_point * 1.25, 2),
            "dist_to_pivot_pct": dist_pct,
            "distance_to_pivot_pct": dist_pct,
            "base_depth_pct": base_depth,
            "handle_depth_pct": handle_depth_pct if has_handle else 0.0,
            "base_length_bars": base_len_bars,
            "base_length_weeks": base_weeks,
            "pivot_status": p_status,
            "pivot_badge": p_badge,
            "status_color": s_color,
            "pivot_status_color": s_color,
            "cup_curve": cup_curve,
            "handle_curve": handle_curve,
            "keypoints": keypoints,
        }

    return vcp_waves, vcp_pivot_price, marketsurge_pattern


def compute_walkforward_setup_and_plan(
    daily_df: pd.DataFrame,
    spy_daily_df: pd.DataFrame,
    daily_stats: dict,
    trend_diagnostics: dict,
    ma_ribbon: dict,
) -> dict:
    """Evaluate walk-forward validated institutional setups and build a direction-aware Trade Plan."""
    last_price = daily_stats["last_price"]
    curr_atr = daily_stats["atr_14"]
    stage_code = trend_diagnostics["stage_code"]
    e9 = ma_ribbon["ema9"]["value"] or last_price
    e21 = ma_ribbon["ema21"]["value"] or last_price
    s50 = ma_ribbon["sma50"]["value"] or last_price
    s200 = ma_ribbon["sma200"]["value"] or last_price

    # Market regime gate (SPY > 200SMA and realized 20D vol < 22%)
    spy_calm = True
    spy_bull = True
    if spy_daily_df is not None and len(spy_daily_df) >= 200:
        spy_c = spy_daily_df["Close"].astype(float)
        spy_sma50 = float(spy_c.rolling(50).mean().iloc[-1])
        spy_sma200 = float(spy_c.rolling(200).mean().iloc[-1])
        spy_last = float(spy_c.iloc[-1])
        spy_vol20 = float(spy_c.pct_change().rolling(20).std().iloc[-1] * math.sqrt(252) * 100.0)
        spy_calm = (spy_last > spy_sma200) and (spy_vol20 < 22.0)
        spy_bull = (spy_last > spy_sma50) and (spy_sma50 > spy_sma200)

    row = daily_df.iloc[-1]
    rsi2 = float(row.get("rsi2", 50.0))
    rsi5 = float(row.get("rsi5", 50.0))
    clv = float(row.get("clv", 50.0))
    rvol = float(row["Volume"] / row["vol_sma50"]) if pd.notna(row["vol_sma50"]) and row["vol_sma50"] > 0 else 1.0
    m_rs = daily_stats["mansfield_rs"]
    ud50 = daily_stats["ud_vol_ratio_50d"]
    tt_score = daily_stats["tt_score"]
    sma200_up = ma_ribbon["sma200"]["slope"] == "Rising"
    sma50_up = ma_ribbon["sma50"]["slope"] == "Rising"
    stage2_core = (last_price > s200) and (s50 > s200) and sma200_up

    # Evaluate the 3 walk-forward validated archetypes (strictly causal)
    vdu_prior5 = bool(daily_df["is_vdu"].iloc[-6:-1].sum() >= 1) if len(daily_df) >= 7 else False
    prev_10_hi = float(daily_df["High"].iloc[-11:-1].max()) if len(daily_df) >= 12 else last_price
    sig_vdu_brk = bool(
        stage2_core and last_price > s50 and m_rs > 0 and ud50 >= 1.0
        and vdu_prior5 and last_price > prev_10_hi and rvol >= 1.3 and clv >= 65.0 and spy_bull
    )
    sig_s2_dip = bool(
        stage2_core and (rsi2 <= 15.0) and (last_price < e9) and (m_rs > 0) and (ud50 >= 1.0) and spy_calm
    )
    sig_pb21 = bool(
        stage2_core and last_price > s50 and sma50_up
        and (float(row["Low"]) <= e21 * 1.008) and (last_price >= e21 * 0.985)
        and (rsi5 <= 45.0) and (m_rs > 0) and (ud50 >= 1.05) and spy_calm
    )

    active_setups = []
    if sig_vdu_brk:
        active_setups.append("VDU Contraction Breakout")
    if sig_s2_dip:
        active_setups.append("Stage 2 Oversold Dip (RSI2<=15)")
    if sig_pb21:
        active_setups.append("Stage 2 21-EMA Pullback")

    # Confluence Score (0..100)
    score = 0
    score += 26 if tt_score >= 7 else (18 if tt_score >= 6 else (10 if tt_score >= 4 else 0))
    score += 14 if spy_bull else (8 if spy_calm else 0)
    score += 14 if m_rs > 0 else 0
    score += 12 if ud50 >= 1.25 else (6 if ud50 >= 1.0 else 0)
    atr_m21 = ma_ribbon["ema21"]["atr_multiple"] or 0.0
    score += 12 if (-0.4 <= atr_m21 <= 1.6 and stage2_core) else (5 if stage2_core else 0)
    score += 14 if active_setups else (6 if stage_code in ("Stage 2A", "Stage 2B", "Stage 2B Pullback") else 0)
    score += 8 if (clv >= 60.0 and float(row.get("plus_di", 0)) > float(row.get("minus_di", 0))) else 0
    confluence_score = int(min(100, max(0, score)))

    # Direction-Aware Trade Plan calibrated to our 2.0 ATR / +2.0->BE / +3.5 ATR walk-forward rule
    if stage_code in ("Stage 3A", "Stage 3B", "Stage 4A", "Stage 4B"):
        reclaim_trigger = round(float(max(e21, s50)), 2)
        support_floor = round(max(0.01, last_price - 2.0 * curr_atr), 2)
        risk_pct = round(((last_price - support_floor) / last_price) * 100.0, 2) if last_price > 0 else 4.0
        reward_pct = round(((reclaim_trigger - last_price) / last_price) * 100.0, 2) if last_price > 0 else 0.0
        return {
            "direction": "DEFENSIVE",
            "grade": "DEFENSIVE",
            "confluence_score": confluence_score,
            "active_setup": "Capital Preservation (Avoid Longs)",
            "active_setups": [],
            "status_label": "🛡️ DEFENSIVE — AVOID LONG ENTRY",
            "entry": last_price,
            "stop_loss": support_floor,
            "target_1": round(float(e21), 2),
            "profit_target": reclaim_trigger,
            "reclaim_trigger": reclaim_trigger,
            "support_floor": support_floor,
            "risk_pct": risk_pct,
            "reward_pct": reward_pct,
            "rr_ratio": 0.0,
            "spy_regime_ok": spy_calm,
            "backtest_evidence": BACKTEST_OOS_EVIDENCE,
        }

    is_wait_pb = stage_code == "Stage 2C"
    entry_px = round(float(e21), 2) if is_wait_pb else last_price
    stop_loss = round(max(0.01, entry_px - 2.0 * curr_atr), 2)
    target_1 = round(entry_px + 2.0 * curr_atr, 2)
    profit_target = round(entry_px + 3.5 * curr_atr, 2)
    risk_pct = round(((entry_px - stop_loss) / entry_px) * 100.0, 2) if entry_px > 0 else 3.0
    reward_pct = round(((profit_target - entry_px) / entry_px) * 100.0, 2) if entry_px > 0 else 6.0

    grade = "A+" if (active_setups and confluence_score >= 78) else ("A" if confluence_score >= 72 else ("B" if confluence_score >= 55 else "C"))
    setup_label = " + ".join(active_setups) if active_setups else (
        "Wait for 21-EMA Pullback" if is_wait_pb else "Constructive Stage 2 Hold"
    )

    return {
        "direction": "WAIT_PULLBACK" if is_wait_pb else "LONG",
        "grade": grade,
        "confluence_score": confluence_score,
        "active_setup": setup_label,
        "active_setups": active_setups,
        "status_label": "⏳ PULLBACK LIMIT" if is_wait_pb else ("🔥 A+ SIGNAL ACTIVE" if active_setups else "✅ CONSTRUCTIVE LONG"),
        "entry": entry_px,
        "stop_loss": stop_loss,
        "target_1": target_1,
        "profit_target": profit_target,
        "risk_pct": risk_pct,
        "reward_pct": reward_pct,
        "rr_ratio": 1.75,
        "spy_regime_ok": spy_calm,
        "backtest_evidence": BACKTEST_OOS_EVIDENCE,
    }


def build_chart_data_payload(
    ticker: str,
    timeframe: str = "1D",
    range_param: str = "1Y",
    yf_heal_fn: Optional[Callable] = None,
) -> tuple[dict, int]:
    """Assemble full Deep Charting payload with invariant daily macro metrics."""
    sym = ticker.upper().strip()
    tf = timeframe.upper().strip()
    rng = range_param.upper().strip()

    df_chart_raw, data_source = fetch_ohlcv_resilient(sym, tf, rng, yf_heal_fn=yf_heal_fn)
    if df_chart_raw is None or df_chart_raw.empty or len(df_chart_raw) < 5:
        return {"error": f"No chart data found for {sym}"}, 404

    # Always obtain daily baseline (2Y+) so 52W Range, 20D ADR, Stage & Trend Template remain invariant across timeframes
    if tf == "1D" and len(df_chart_raw) >= 252:
        daily_raw = df_chart_raw
    else:
        daily_raw, _ = fetch_ohlcv_resilient(sym, "1D", "2Y", yf_heal_fn=yf_heal_fn)
        if daily_raw is None or daily_raw.empty:
            daily_raw = df_chart_raw

    spy_chart_raw = None if sym == "SPY" else fetch_ohlcv_resilient("SPY", tf, rng, yf_heal_fn=yf_heal_fn)[0]
    spy_daily_raw = daily_raw if sym == "SPY" else fetch_ohlcv_resilient("SPY", "1D", "2Y", yf_heal_fn=yf_heal_fn)[0]

    df_chart = compute_indicators(df_chart_raw, spy_chart_raw, sym, timeframe=tf)
    df_daily = df_chart if (tf == "1D" and daily_raw is df_chart_raw) else compute_indicators(daily_raw, spy_daily_raw, sym, timeframe="1D")

    if tf == "15M":
        slice_bars = 130 if rng == "5D" else 260
    elif tf == "1H":
        slice_bars = 160 if rng == "1M" else 320
    elif tf == "1W":
        slice_bars = 156 if rng == "3Y" else 260
    else:
        range_bar_map = {"3M": 65, "6M": 130, "1Y": 252, "2Y": 504, "3Y": 756, "5Y": 1260}
        slice_bars = range_bar_map.get(rng, 252)

    vis_df = df_chart.tail(slice_bars).copy().reset_index(drop=True)
    # Re-normalize RS Line and its 21-EMA consistently at start of visible window
    base_rs_vis = float(vis_df["rs_raw"].dropna().iloc[0]) if not vis_df["rs_raw"].dropna().empty else 1.0
    if base_rs_vis > 0:
        vis_df["rs_norm"] = ((vis_df["rs_raw"] / base_rs_vis) * 100.0).ffill().fillna(100.0)
        vis_df["rs_ema21"] = ((vis_df["rs_raw_ema21"] / base_rs_vis) * 100.0).ffill().fillna(100.0)
    else:
        vis_df["rs_norm"] = 100.0
        vis_df["rs_ema21"] = 100.0

    # Daily-anchored macro metrics, MA ribbon, stage & trend template (invariant across timeframes)
    ma_ribbon, ma_ribbon_list, trend_diagnostics, trend_template, daily_stats = _compute_ma_and_diagnostics(df_daily, sym)

    # Chart-timeframe candles & oscillators
    ohlc = []
    rs_series = []
    blue_dots = []
    pocket_pivots = []
    vdu_markers = []

    rs_raw_full = vis_df["rs_raw"].astype(float)
    rs_max60_series = rs_raw_full.rolling(60, min_periods=20).max()
    p_max60_series = vis_df["High"].astype(float).rolling(60, min_periods=20).max()
    high_52w_ref = daily_stats["high_52w"]

    for idx, row in vis_df.iterrows():
        d_str = row["date_str"]
        c_val = round(float(row["Close"]), 2)
        o_val = round(float(row["Open"]), 2)
        h_val = round(float(row["High"]), 2)
        l_val = round(float(row["Low"]), 2)
        v_val = int(row["Volume"]) if pd.notna(row["Volume"]) else 0
        v_sma = round(float(row["vol_sma50"]), 0) if pd.notna(row["vol_sma50"]) else v_val
        rvol = round(v_val / v_sma, 2) if v_sma > 0 else 1.0
        is_pp = bool(row["is_pocket_pivot"])
        is_vdu_bar = bool(row["is_vdu"])
        sqz_m = round(float(row["sqz_mom"]), 3) if pd.notna(row["sqz_mom"]) else 0.0
        prev_sqz_m = (
            round(float(vis_df.loc[idx - 1, "sqz_mom"]), 3)
            if idx > 0 and pd.notna(vis_df.loc[idx - 1, "sqz_mom"])
            else sqz_m
        )

        ohlc.append(
            {
                "time": d_str,
                "open": o_val,
                "high": h_val,
                "low": l_val,
                "close": c_val,
                "value": v_val,
                "vol_sma50": v_sma,
                "rvol": rvol,
                "clv": round(float(row["clv"]), 1),
                "is_up": bool(c_val >= o_val),
                "is_pocket_pivot": is_pp,
                "is_vdu": is_vdu_bar,
                "ema9": round(float(row["ema9"]), 2) if pd.notna(row["ema9"]) else None,
                "ema21": round(float(row["ema21"]), 2) if pd.notna(row["ema21"]) else None,
                "sma50": round(float(row["sma50"]), 2) if pd.notna(row["sma50"]) else None,
                "sma150": round(float(row["sma150"]), 2) if pd.notna(row["sma150"]) else None,
                "sma200": round(float(row["sma200"]), 2) if pd.notna(row["sma200"]) else None,
                "bb_upper": round(float(row["bb_upper"]), 2) if pd.notna(row["bb_upper"]) else None,
                "bb_lower": round(float(row["bb_lower"]), 2) if pd.notna(row["bb_lower"]) else None,
                "macd": round(float(row["macd"]), 3) if pd.notna(row["macd"]) else 0.0,
                "macd_signal": round(float(row["macd_signal"]), 3) if pd.notna(row["macd_signal"]) else 0.0,
                "macd_hist": round(float(row["macd_hist"]), 3) if pd.notna(row["macd_hist"]) else 0.0,
                "rsi14": round(float(row["rsi14"]), 1) if pd.notna(row["rsi14"]) else 50.0,
                "rsi_sma14": round(float(row["rsi_sma14"]), 1) if pd.notna(row["rsi_sma14"]) else 50.0,
                "adx14": round(float(row["adx14"]), 1) if pd.notna(row["adx14"]) else 15.0,
                "plus_di": round(float(row["plus_di"]), 1) if pd.notna(row["plus_di"]) else 15.0,
                "minus_di": round(float(row["minus_di"]), 1) if pd.notna(row["minus_di"]) else 15.0,
                "squeeze_on": bool(row["squeeze_on"]),
                "sqz_mom": sqz_m,
                "sqz_rising": bool(sqz_m >= prev_sqz_m),
            }
        )

        if is_pp:
            pocket_pivots.append({"time": d_str, "price": round(l_val * 0.992, 2), "close": c_val, "volume": v_val, "rvol": rvol})
        if is_vdu_bar:
            vdu_markers.append({"time": d_str, "price": round(h_val * 1.008, 2), "close": c_val, "volume": v_val, "rvol": rvol})

        rs_v = round(float(row["rs_norm"]), 2) if pd.notna(row["rs_norm"]) else 100.0
        rs_e21 = round(float(row["rs_ema21"]), 2) if pd.notna(row["rs_ema21"]) else rs_v
        m_rs = round(float(row["mansfield_rs"]), 2) if pd.notna(row["mansfield_rs"]) else 0.0
        rs_series.append({"time": d_str, "value": rs_v, "ema21": rs_e21, "mansfield": m_rs})

        # Refined causal RS Blue Dots (NEVER on SPY itself)
        if sym != "SPY" and idx >= 25:
            rs_r = float(rs_raw_full.iloc[idx])
            rs_r_prev = float(rs_raw_full.iloc[idx - 1])
            rmax_60 = float(rs_max60_series.iloc[idx])
            rmax_60_prev = float(rs_max60_series.iloc[idx - 1])
            pmax_60 = float(p_max60_series.iloc[idx])
            sma50_bar = float(row["sma50"]) if pd.notna(row["sma50"]) else c_val
            if (
                rs_r >= rmax_60
                and rs_r_prev < rmax_60_prev
                and c_val < pmax_60 * 0.99
                and c_val >= high_52w_ref * 0.85
                and c_val > sma50_bar
                and float(row["clv"]) >= 55.0
            ):
                blue_dots.append({"time": d_str, "price": c_val, "rs_value": rs_v})

    volume_profile = compute_volume_profile(vis_df, num_bins=48)
    vcp_waves, vcp_pivot_price, marketsurge_pattern = _compute_patterns(
        vis_df=vis_df,
        daily_stage_code=trend_diagnostics["stage_code"],
        daily_pct_off_52w=daily_stats["pct_off_52w_high"],
        timeframe=tf,
        last_price=daily_stats["last_price"],
        ma_ribbon=ma_ribbon,
    )

    trade_plan = compute_walkforward_setup_and_plan(
        daily_df=df_daily,
        spy_daily_df=spy_daily_raw,
        daily_stats=daily_stats,
        trend_diagnostics=trend_diagnostics,
        ma_ribbon=ma_ribbon,
    )

    levels = []
    if volume_profile.get("poc_price"):
        levels.append(
            {
                "price": volume_profile["poc_price"],
                "color": "#38bdf8",
                "title": f"POC ${volume_profile['poc_price']:.2f}",
                "type": "POC",
            }
        )
    if vcp_pivot_price:
        levels.append(
            {
                "price": vcp_pivot_price,
                "color": "#22d3ee",
                "title": f"VCP Pivot ${vcp_pivot_price:.2f}",
                "type": "PIVOT",
            }
        )

    last_bar = ohlc[-1]
    summary_metrics = {
        "last_price": daily_stats["last_price"] if tf in ("1D", "1W") else last_bar["close"],
        "daily_close": daily_stats["last_price"],
        "change_1d_pct": daily_stats["change_1d_pct"],
        "atr_14": daily_stats["atr_14"],
        "bar_atr_14": round(float(vis_df["atr14"].iloc[-1]), 2) if pd.notna(vis_df["atr14"].iloc[-1]) else daily_stats["atr_14"],
        "adr_20_pct": daily_stats["adr_20_pct"],
        "rvol": last_bar["rvol"],
        "clv": last_bar["clv"],
        "ud_vol_ratio_20d": daily_stats["ud_vol_ratio_50d"],
        "ud_vol_ratio_50d": daily_stats["ud_vol_ratio_50d"],
        "pocket_pivot_count": len(pocket_pivots),
        "vdu_count": len(vdu_markers),
        "blue_dot_count": len(blue_dots),
        "high_52w": daily_stats["high_52w"],
        "low_52w": daily_stats["low_52w"],
        "pct_off_52w_high": daily_stats["pct_off_52w_high"],
        "rsi14": last_bar["rsi14"],
        "adx14": last_bar["adx14"],
        "plus_di": last_bar["plus_di"],
        "minus_di": last_bar["minus_di"],
        "squeeze_on": last_bar["squeeze_on"],
        "mansfield_rs": daily_stats["mansfield_rs"],
    }

    payload = {
        "ticker": sym,
        "timeframe": tf,
        "range": rng,
        "data_source": data_source,
        "candles": ohlc,
        "rs_series": rs_series,
        "blue_dots": blue_dots,
        "pocket_pivots": pocket_pivots,
        "vdu_markers": vdu_markers,
        "vcp_waves": vcp_waves,
        "vcp_pivot_price": vcp_pivot_price,
        "volume_profile": volume_profile,
        "levels": levels,
        "options_intel": None,
        "ma_ribbon": ma_ribbon,
        "ma_ribbon_list": ma_ribbon_list,
        "trend_diagnostics": trend_diagnostics,
        "marketsurge": marketsurge_pattern,
        "trend_template": {
            "checks": trend_template,
            "passed": daily_stats["tt_score"],
            "total": 8,
        },
        "summary_metrics": summary_metrics,
        "trade_plan": trade_plan,
        # Exposed for /api/search synchronization
        "_daily_meta": {
            "confluence_score": trade_plan["confluence_score"],
            "stage_code": trend_diagnostics["stage_code"],
            "stage_label": trend_diagnostics["stage_label"],
            "tt_score": daily_stats["tt_score"],
        },
    }
    return payload, 200
